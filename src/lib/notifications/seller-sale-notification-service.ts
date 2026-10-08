import crypto from "crypto";
import { db } from "@/db";
import { orders, orderItems, products, telegramBots, stores } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export interface SaleNotificationResult {
  success: boolean;
  notified?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export function formatBrtDateTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute} (BRT)`;
}

export function formatBRL(amount: number | string): string {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return num
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    .replace(/\s/g, " ");
}

export class SellerSaleNotificationService {
  /**
   * Sends Telegram sale notification message to the seller's configured Telegram ID.
   *
   * CONCURRENCY & LEASE STRATEGY:
   * - Uses an atomic tokenized claim lock (`seller_notification_claim_token` crypto UUID).
   * - Claim lease duration: 5 minutes (INTERVAL '5 minutes'). This aligns comfortably above HTTP request/retry timeouts
   *   to prevent active, in-flight background tasks from losing their claim prematurely.
   * - Prevents normal concurrent duplicate notifications (e.g. parallel webhook triggers).
   *
   * RETRY & FAILURE HANDLING:
   * - Deterministic local/network errors BEFORE sending to Telegram safely release the claim token, allowing immediate retry.
   * - Confirmation: Marks `seller_notification_sent_at` ONLY upon positive confirmation from the Telegram API.
   *
   * NETWORK BOUNDARY LIMITATION (No Exactly-Once Guarantee):
   * - PostgreSQL controls local state; Telegram is an external API without distributed transaction / 2PC support.
   * - If a network drop or crash occurs after Telegram accepts the request but before HTTP response/Postgres update,
   *   a rare duplication could occur upon lease expiry. This is documented and accepted per standard distributed systems design.
   */
  static async notifySellerOfSale(orderId: string): Promise<SaleNotificationResult> {
    const claimToken = crypto.randomUUID();
    let claimAcquired = false;

    try {
      // 1. Initial quick check
      const initialOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });

      if (!initialOrder) {
        return { success: false, error: `Order ${orderId} not found.` };
      }

      if (initialOrder.status !== "paid") {
        return { success: true, skipped: true, reason: "Order is not paid." };
      }

      if (initialOrder.sellerNotificationSentAt) {
        return { success: true, skipped: true, reason: "Notification already sent for this order." };
      }

      // 2. ATOMIC TOKENIZED CLAIM LOCK against concurrent executions (Lease: 5 minutes)
      const claimResult = await db.execute(sql`
        UPDATE orders
        SET seller_notification_claimed_at = NOW(),
            seller_notification_claim_token = ${claimToken}
        WHERE id = ${orderId}
          AND seller_notification_sent_at IS NULL
          AND (
            seller_notification_claimed_at IS NULL 
            OR seller_notification_claimed_at < NOW() - INTERVAL '5 minutes'
          )
        RETURNING id
      `);

      let updated = false;
      if (Array.isArray(claimResult)) {
        updated = claimResult.length > 0;
      } else if (Array.isArray((claimResult as any)?.rows)) {
        updated = (claimResult as any).rows.length > 0;
      } else {
        const rowCount = Number((claimResult as any)?.rowCount ?? (claimResult as any)?.affectedRows ?? 0);
        updated = rowCount > 0;
      }

      if (!updated) {
        console.log(`[SellerSaleNotificationService] Order ${orderId} already sent or claimed by another process. Skipping.`);
        return { success: true, skipped: true, reason: "Already claimed or sent by another execution." };
      }

      claimAcquired = true;

      // 3. Fetch Full Order Details
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
          customer: true,
          items: true,
        },
      });

      if (!order || order.status !== "paid") {
        await this.releaseClaimLock(orderId, claimToken);
        return { success: false, error: "Order not valid or not paid after acquiring claim lock." };
      }

      // 4. Fetch Store & Check Seller Telegram Notification ID
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, order.storeId),
      });

      if (!store || !store.telegramNotificationId || !store.telegramNotificationId.trim()) {
        await this.releaseClaimLock(orderId, claimToken);
        return { success: true, skipped: true, reason: "Store has no Telegram notification ID configured." };
      }

      // 5. Fetch Items and Product details
      const items = order.items || (await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      }));

      const productTitles: string[] = [];
      let targetBotId: string | null = null;

      for (const item of items) {
        const prod = await db.query.products.findFirst({
          where: and(eq(products.id, item.productId), eq(products.storeId, order.storeId)),
        });
        if (prod) {
          productTitles.push(prod.title);
          if (!targetBotId && prod.botId) {
            targetBotId = prod.botId;
          }
        }
      }

      const productNames = productTitles.length > 0 ? productTitles.join(", ") : "Produto";

      // 6. Resolve Telegram Bot for Store deterministically
      let botRecord = null;
      if (targetBotId) {
        botRecord = await db.query.telegramBots.findFirst({
          where: and(eq(telegramBots.id, targetBotId), eq(telegramBots.storeId, order.storeId)),
        });
      }

      if (!botRecord) {
        botRecord = await db.query.telegramBots.findFirst({
          where: and(eq(telegramBots.storeId, order.storeId), eq(telegramBots.status, "active")),
          orderBy: [asc(telegramBots.createdAt)],
        });
      }

      if (!botRecord || !botRecord.tokenEncrypted) {
        await this.releaseClaimLock(orderId, claimToken);
        console.warn(`[SellerSaleNotificationService] No active bot found for store ${order.storeId}. Cannot send notification.`);
        return { success: true, skipped: true, reason: "No active bot found for store." };
      }

      const botToken = decrypt(botRecord.tokenEncrypted);
      const botName = botRecord.displayName || (botRecord.username ? `@${botRecord.username}` : "Bot Telegram");

      // 7. Format Customer Details
      const customer = order.customer;
      const customerNameParts = [customer?.firstName, customer?.lastName].filter(Boolean);
      const customerName = customerNameParts.length > 0
        ? customerNameParts.join(" ")
        : (customer?.username ? `@${customer.username}` : "Cliente");
      const customerTelegramUserId = customer?.telegramUserId || "N/A";

      // 8. Format Amount & Date
      const formattedAmount = formatBRL(order.total);
      const confirmedDate = order.paidAt || order.updatedAt || new Date();
      const formattedDate = formatBrtDateTime(new Date(confirmedDate));

      // 9. Construct Message Text (Exactly matching required model)
      const messageText = 
`🛒 Nova venda realizada!

📦 Produto: ${productNames}
👤 Cliente: ${customerName} (ID: ${customerTelegramUserId})
💰 Valor: ${formattedAmount}
🤖 Bot: ${botName}
📅 Data: ${formattedDate}`;

      // 10. Send Telegram Message
      const botService = new TelegramBotService(botToken);
      await botService.sendMessage(store.telegramNotificationId.trim(), messageText);

      // 11. Confirm Permanent Success ONLY IF current claimToken still matches (prevents stale overwrites if thread hung)
      await db.execute(sql`
        UPDATE orders
        SET seller_notification_sent_at = NOW(),
            seller_notification_claimed_at = NULL,
            seller_notification_claim_token = NULL
        WHERE id = ${orderId}
          AND seller_notification_claim_token = ${claimToken}
      `);

      console.log(`[SellerSaleNotificationService] Notification sent successfully for order ${order.id} to Telegram ID ${store.telegramNotificationId}`);

      return { success: true, notified: true };
    } catch (err: any) {
      console.error("[SellerSaleNotificationService] Error sending seller notification:", err?.message || err);
      if (claimAcquired) {
        // Release claim lock safely if this process still holds the token
        await this.releaseClaimLock(orderId, claimToken);
      }
      return { success: false, error: err?.message || "Failed to send notification" };
    }
  }

  private static async releaseClaimLock(orderId: string, claimToken: string): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE orders
        SET seller_notification_claimed_at = NULL,
            seller_notification_claim_token = NULL
        WHERE id = ${orderId}
          AND seller_notification_claim_token = ${claimToken}
      `);
    } catch (releaseErr) {
      console.error(`[SellerSaleNotificationService] Failed to release claim lock for order ${orderId}:`, releaseErr);
    }
  }
}
