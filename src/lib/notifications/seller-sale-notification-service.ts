import crypto from "crypto";
import { db } from "@/db";
import {
  orders,
  orderItems,
  products,
  telegramBots,
  stores,
  botSaleNotificationRecipients,
  orderBotNotificationDeliveries
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";
import { BUSINESS_TIMEZONE } from "@/lib/analytics/timezone-utils";
import { isOrderNetConfirmed } from "@/lib/payments/split-reconciliation-service";

export interface SaleNotificationResult {
  success: boolean;
  notified?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export function formatBrtDateTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
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

      // 4. Fetch Store
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, order.storeId),
      });

      if (!store) {
        await this.releaseClaimLock(orderId, claimToken);
        return { success: false, error: "Store not found for this order." };
      }

      // 5. Fetch Items and Product details
      const items = order.items || (await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      }));

      const productTitles: string[] = [];
      let targetBotId: string | null = null;

      for (const item of items) {
        if (item.productId) {
          const prod = await db.query.products.findFirst({
            where: and(eq(products.id, item.productId), eq(products.storeId, order.storeId)),
          });
          if (prod) {
            productTitles.push(prod.title);
            if (!targetBotId && prod.botId) {
              targetBotId = prod.botId;
            }
          }
        } else if (item.comboSnapshot && typeof item.comboSnapshot === 'object') {
          const snapshot = item.comboSnapshot as { title?: string };
          if (snapshot.title) {
            productTitles.push(snapshot.title);
          }
        }
      }

      const productNames = productTitles.length > 0 ? productTitles.join(", ") : "Produto";

      // 6. Resolve Telegram Bot for Store deterministically
      let botRecord = null;
      if (targetBotId) {
        botRecord = await db.query.telegramBots.findFirst({
          where: and(
            eq(telegramBots.id, targetBotId),
            eq(telegramBots.storeId, order.storeId),
            eq(telegramBots.status, "active")
          ),
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

      // 7. Resolve Active Notification Recipients for THIS specific bot
      let recipients = await db.query.botSaleNotificationRecipients.findMany({
        where: and(
          eq(botSaleNotificationRecipients.botId, botRecord.id),
          eq(botSaleNotificationRecipients.status, "active")
        ),
      });

      // Fallback: If no recipients configured for this bot yet, check store-level legacy ID
      if (recipients.length === 0 && store.telegramNotificationId && store.telegramNotificationId.trim()) {
        const fallbackChatId = store.telegramNotificationId.trim();
        if (String(botRecord.botId).trim() !== fallbackChatId) {
          recipients = [
            {
              id: "legacy",
              storeId: store.id,
              botId: botRecord.id,
              telegramChatId: fallbackChatId,
              displayName: "Lojista Principal",
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any,
          ];
        }
      }

      if (recipients.length === 0) {
        await this.releaseClaimLock(orderId, claimToken);
        console.warn(`[SellerSaleNotificationService] No active recipients found for bot ${botRecord.id}. Skipping.`);
        return { success: true, skipped: true, reason: "No active notification recipients configured for this bot." };
      }

      // Filter out recipients whose chat ID is the bot's own numeric ID
      const validRecipients = recipients.filter(
        (r) => String(r.telegramChatId).trim() !== String(botRecord.botId).trim()
      );

      if (validRecipients.length === 0) {
        await this.releaseClaimLock(orderId, claimToken);
        return {
          success: false,
          error: "O Telegram ID configurado pertence ao próprio bot. Bots não podem enviar mensagens para outros bots.",
        };
      }

      const botToken = decrypt(botRecord.tokenEncrypted);
      const botName = botRecord.displayName || (botRecord.username ? `@${botRecord.username}` : "Bot Telegram");

      // 8. Format Customer Details (Sem CPF, e-mail ou telefone)
      const customer = order.customer;
      const customerNameParts = [customer?.firstName, customer?.lastName].filter(Boolean);
      const customerName = customerNameParts.length > 0
        ? customerNameParts.join(" ")
        : (customer?.username ? `@${customer.username}` : "Cliente");

      // 9. Format Amounts & ID (com fallback rigoroso para netAmount)
      const grossAmount = formatBRL(order.total);

      let netAmountNum: number;
      const totalNum = Number(order.total || 0);
      const platformFeeNum = Number(order.platformFee || 0);
      const parsedNet = order.netAmount != null ? Number(order.netAmount) : 0;

      if (parsedNet > 0) {
        netAmountNum = parsedNet;
      } else if (totalNum === 0) {
        netAmountNum = 0;
      } else {
        netAmountNum = Math.max(0, totalNum - platformFeeNum);
      }

      const netAmount = formatBRL(netAmountNum);
      const isNetConfirmed = isOrderNetConfirmed(order);

      const netStatusSuffix = isNetConfirmed ? " (confirmado)" : " (estimado)";
      const netAmountDisplay = `${netAmount}${netStatusSuffix}`;
      const shortOrderId = `#${order.id.slice(0, 8)}`;
      const confirmedDate = order.paidAt || order.updatedAt || new Date();
      const formattedDate = formatBrtDateTime(new Date(confirmedDate));

      // 10. Construct Message Text
      const messageText =
        `🛒 Nova venda realizada!

📦 Produto: ${productNames}
👤 Cliente: ${customerName}
💰 Valor Bruto: ${grossAmount}
💵 Valor Líquido: ${netAmountDisplay}
🆔 Pedido: ${shortOrderId}
🤖 Bot: ${botName}
📅 Data: ${formattedDate}`;

      const botService = new TelegramBotService(botToken);

      // 11. LEDGER INDIVIDUAL DE ENTREGAS: Inicializar registros de entrega para cada destinatário
      for (const recipient of validRecipients) {
        const recipientUuid = recipient.id && recipient.id !== "legacy" ? recipient.id : null;
        try {
          await db.execute(sql`
            INSERT INTO order_bot_notification_deliveries (
              order_id,
              bot_id,
              recipient_id,
              telegram_chat_id,
              status,
              created_at,
              updated_at
            ) VALUES (
              ${order.id},
              ${botRecord.id},
              ${recipientUuid},
              ${recipient.telegramChatId},
              'pending',
              NOW(),
              NOW()
            )
            ON CONFLICT (order_id, bot_id, recipient_id) DO NOTHING
          `);
        } catch (insertErr) {
          // Non-critical if delivery already initialized
        }
      }

      // 12. Processamento granular com lock atômico por entrega
      let deliveredCount = 0;
      let failedCount = 0;

      for (const recipient of validRecipients) {
        const recipientUuid = recipient.id && recipient.id !== "legacy" ? recipient.id : null;
        const deliveryWorkerToken = crypto.randomUUID();

        // Tentar adquirir o lock exclusivo desta entrega (impedindo workers concorrentes)
        const claimResult = await db.execute(sql`
          UPDATE order_bot_notification_deliveries
          SET status = 'claiming',
              claim_token = ${deliveryWorkerToken},
              claimed_at = NOW(),
              attempts = attempts + 1,
              updated_at = NOW()
          WHERE order_id = ${order.id}
            AND bot_id = ${botRecord.id}
            AND (
              recipient_id = ${recipientUuid}
              OR (recipient_id IS NULL AND telegram_chat_id = ${recipient.telegramChatId})
            )
            AND status != 'delivered'
            AND (
              status = 'pending'
              OR status = 'failed'
              OR claimed_at < NOW() - INTERVAL '3 minutes'
            )
          RETURNING id, attempts
        `);

        let claimedDeliveryId: string | null = null;
        if (Array.isArray(claimResult) && claimResult.length > 0) {
          claimedDeliveryId = (claimResult[0] as any).id;
        } else if (Array.isArray((claimResult as any)?.rows) && (claimResult as any).rows.length > 0) {
          claimedDeliveryId = (claimResult as any).rows[0].id;
        }

        if (!claimedDeliveryId) {
          // Se não adquiriu, verifica se já foi entregue anteriormente (não duplicar!)
          const checkDelivered = await db.execute(sql`
            SELECT id FROM order_bot_notification_deliveries
            WHERE order_id = ${order.id}
              AND bot_id = ${botRecord.id}
              AND (
                recipient_id = ${recipientUuid}
                OR (recipient_id IS NULL AND telegram_chat_id = ${recipient.telegramChatId})
              )
              AND status = 'delivered'
            LIMIT 1
          `);
          const isDelivered = Array.isArray(checkDelivered)
            ? checkDelivered.length > 0
            : Boolean((checkDelivered as any)?.rows?.length > 0);

          if (isDelivered) {
            deliveredCount++;
          }
          continue; // Já entregue ou sendo processado por outro worker!
        }

        // Envio com tratamento de erros (403, 401, 429, 5xx com backoff)
        let sendSuccess = false;
        let lastError: any = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await botService.sendMessage(recipient.telegramChatId, messageText);
            sendSuccess = true;
            break;
          } catch (err: any) {
            lastError = err;
            const code = err?.code || (err as any)?.statusCode;
            const errMsg = String(err?.message || err);

            // 403: Bot bloqueado pelo usuário
            if (code === 403 || errMsg.includes("403") || errMsg.toLowerCase().includes("blocked") || errMsg.toLowerCase().includes("user is deactivated")) {
              if (recipient.id && recipient.id !== "legacy") {
                await db
                  .update(botSaleNotificationRecipients)
                  .set({ status: "blocked", updatedAt: new Date() })
                  .where(eq(botSaleNotificationRecipients.id, recipient.id));
              }
              break; // Não retenta 403
            }

            // 401: Token do bot inválido
            if (code === 401 || errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized")) {
              await db
                .update(telegramBots)
                .set({ status: "invalid_token", updatedAt: new Date() })
                .where(eq(telegramBots.id, botRecord.id));
              break; // Não retenta 401
            }

            // 429: Too Many Requests (Rate limit do Telegram)
            if (code === 429 || errMsg.includes("429")) {
              const retryAfterSec = Number((err as any)?.parameters?.retry_after || 2);
              if (retryAfterSec <= 3 && attempt === 1) {
                await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
                continue;
              }
              break;
            }

            // 5xx: Erro transitório no Telegram - retry com backoff exponencial
            if (attempt === 1 && (code >= 500 || errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("500"))) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
          }
        }

        if (sendSuccess) {
          await db.execute(sql`
            UPDATE order_bot_notification_deliveries
            SET status = 'delivered',
                sent_at = NOW(),
                claim_token = NULL,
                claimed_at = NULL,
                error_message = NULL,
                updated_at = NOW()
            WHERE id = ${claimedDeliveryId}
              AND claim_token = ${deliveryWorkerToken}
          `);
          deliveredCount++;
        } else {
          const errorStr = String(lastError?.message || lastError || "Falha na entrega");
          await db.execute(sql`
            UPDATE order_bot_notification_deliveries
            SET status = 'failed',
                claim_token = NULL,
                claimed_at = NULL,
                error_message = ${errorStr.slice(0, 500)},
                updated_at = NOW()
            WHERE id = ${claimedDeliveryId}
              AND claim_token = ${deliveryWorkerToken}
          `);
          failedCount++;
        }
      }

      // 13. FINALIZAÇÃO GLOBAL DO PEDIDO: Apenas se TODAS as entregas foram concluídas com sucesso
      const totalExpected = validRecipients.length;

      const checkDeliveries = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'delivered')::int as delivered_count
        FROM order_bot_notification_deliveries
        WHERE order_id = ${order.id}
          AND bot_id = ${botRecord.id}
      `);

      let totalInDb = 0;
      let deliveredInDb = 0;
      if (Array.isArray(checkDeliveries) && checkDeliveries.length > 0) {
        totalInDb = Number((checkDeliveries[0] as any).total || 0);
        deliveredInDb = Number((checkDeliveries[0] as any).delivered_count || 0);
      } else if (Array.isArray((checkDeliveries as any)?.rows) && (checkDeliveries as any).rows.length > 0) {
        totalInDb = Number((checkDeliveries as any).rows[0].total || 0);
        deliveredInDb = Number((checkDeliveries as any).rows[0].delivered_count || 0);
      }

      const allCompleted = totalInDb > 0 && deliveredInDb >= totalExpected;

      if (allCompleted) {
        // Todas as entregas esperadas foram confirmadas! Marcar conclusão global do pedido
        await db.execute(sql`
          UPDATE orders
          SET seller_notification_sent_at = NOW(),
              seller_notification_claimed_at = NULL,
              seller_notification_claim_token = NULL
          WHERE id = ${orderId}
            AND seller_notification_claim_token = ${claimToken}
        `);

        console.log(`[SellerSaleNotificationService] All ${deliveredInDb}/${totalExpected} deliveries completed. Order ${order.id} finalized globally.`);
        return { success: true, notified: true };
      } else {
        // Entregas pendentes ou com falha. Liberar o claim lock global para que a retentativa processe somente as pendentes
        await db.execute(sql`
          UPDATE orders
          SET seller_notification_claimed_at = NULL,
              seller_notification_claim_token = NULL
          WHERE id = ${orderId}
            AND seller_notification_claim_token = ${claimToken}
        `);

        console.warn(`[SellerSaleNotificationService] Partial delivery for order ${order.id}: ${deliveredCount}/${totalExpected} delivered. Remaining will be retried.`);
        return {
          success: false,
          notified: deliveredCount > 0,
          error: `Entrega parcial: ${deliveredCount}/${totalExpected} destinatários notificados. Pendentes serão retentados.`,
        };
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to send notification";
      const sanitizedError = errorMsg.replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot<REDACTED>");
      console.error("[SellerSaleNotificationService] Error sending seller notification:", sanitizedError);
      if (claimAcquired) {
        // Release claim lock safely if this process still holds the token
        await this.releaseClaimLock(orderId, claimToken);
      }
      return { success: false, error: sanitizedError };
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
