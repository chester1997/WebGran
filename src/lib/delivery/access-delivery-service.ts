import { db } from "@/db";
import { accesses, orders, orderItems, products, telegramCustomers, telegramBots, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramDeliveryService } from "./telegram-delivery-service";

export interface DeliveryResult {
  accessId: string;
  status: 'ACTIVE' | 'FAILED';
  deliveryStatus: 'DELIVERED' | 'FAILED';
  inviteLink?: string;
  error?: string;
}

export class AccessDeliveryService {
  /**
   * Processes access delivery for all items in an approved Order.
   * Ensures STRICT IDEMPOTENCY: checks if Access already exists for storeId + customerId + productId + orderId.
   */
  static async processOrderDelivery(orderId: string): Promise<DeliveryResult[]> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        customer: true,
        items: true,
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'paid') {
      console.warn(`[AccessDeliveryService] Order ${orderId} is not in 'paid' status. Skipping delivery.`);
      return [];
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, order.storeId)
    });

    // Multi-tenant check: Get bot strictly bound to this store
    const bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, order.storeId)
    });

    const items = order.items || await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id)
    });

    const results: DeliveryResult[] = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, item.productId), eq(products.storeId, order.storeId))
      });

      if (!product) {
        console.error(`[AccessDeliveryService] Product ${item.productId} not found for store ${order.storeId}`);
        continue;
      }

      // IDEMPOTENCY CHECK
      // Check if an Access record already exists for storeId + customerId + productId + orderId
      const existingAccess = await db.query.accesses.findFirst({
        where: and(
          eq(accesses.storeId, order.storeId),
          eq(accesses.customerId, order.customerId),
          eq(accesses.productId, product.id),
          eq(accesses.orderId, order.id)
        )
      });

      if (existingAccess && existingAccess.status === 'ACTIVE' && existingAccess.deliveryStatus === 'DELIVERED') {
        console.log(`[AccessDeliveryService] Access already DELIVERED for order ${order.id}, product ${product.id}. Idempotent skip.`);
        results.push({
          accessId: existingAccess.id,
          status: 'ACTIVE',
          deliveryStatus: 'DELIVERED',
          inviteLink: existingAccess.inviteLink || undefined,
        });
        continue;
      }

      // Create or reuse pending/failed access record
      let accessRecord = existingAccess;
      if (!accessRecord) {
        const inserted = await db.insert(accesses).values({
          storeId: order.storeId,
          customerId: order.customerId,
          productId: product.id,
          orderId: order.id,
          deliveryType: product.deliveryType || 'telegram',
          telegramChatId: product.deliveryValue,
          status: 'PENDING',
          deliveryStatus: 'PENDING',
        }).returning();
        accessRecord = inserted[0];
      }

      // Execute Delivery
      const deliveryRes = await AccessDeliveryService.executeSingleDelivery(
        accessRecord,
        product,
        order.customer,
        bot,
        store?.slug
      );

      results.push(deliveryRes);
    }

    return results;
  }

  /**
   * Safe retry mechanism for a failed Access delivery without repeating payments or creating duplicate Access records.
   */
  static async retryAccessDelivery(accessId: string, sellerStoreId: string): Promise<DeliveryResult> {
    const accessRecord = await db.query.accesses.findFirst({
      where: and(eq(accesses.id, accessId), eq(accesses.storeId, sellerStoreId)),
      with: {
        customer: true,
        product: true,
      }
    });

    if (!accessRecord) {
      throw new Error("Acesso não encontrado ou sem permissão.");
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, sellerStoreId)
    });

    const bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, sellerStoreId)
    });

    return AccessDeliveryService.executeSingleDelivery(
      accessRecord,
      accessRecord.product,
      accessRecord.customer,
      bot,
      store?.slug
    );
  }

  private static async executeSingleDelivery(
    accessRecord: any,
    product: any,
    customer: any,
    bot: any,
    storeSlug?: string
  ): Promise<DeliveryResult> {
    try {
      if (!bot) {
        throw new Error("Nenhum bot do Telegram está vinculado a esta loja.");
      }

      const telegramChatId = product.deliveryValue ? String(product.deliveryValue).trim() : null;

      if (!telegramChatId || telegramChatId === "null" || telegramChatId === "") {
        throw new Error("Produto sem telegramChatId configurado.");
      }

      const { calculateAccessExpiration } = await import("@/lib/orders/expiration-service");
      const paidAtDate = order?.paidAt || accessRecord.grantedAt || new Date();
      const accessExpiresAt = calculateAccessExpiration(product.duration, paidAtDate);

      const botToken = decrypt(bot.tokenEncrypted);
      let deliveryUrl = accessRecord.inviteLink || '';
      let isAlreadyMember = false;

      if (product.deliveryType === 'telegram' || product.deliveryType === 'TELEGRAM_CHAT') {
        if (telegramChatId.startsWith('http://') || telegramChatId.startsWith('https://')) {
          deliveryUrl = telegramChatId;
        } else {
          // 1. Validate Bot Admin Permissions in Target Chat
          const permCheck = await TelegramDeliveryService.validateBotAndChatPermission(botToken, telegramChatId, bot.botId);
          if (!permCheck.success) {
            throw new Error(`Validação do Telegram Chat (${telegramChatId}) falhou: ${permCheck.error}`);
          }

          // 2. Check if Buyer is Already a Member of the Group/Channel
          if (customer?.telegramUserId) {
            isAlreadyMember = await TelegramDeliveryService.checkBuyerMembership(
              botToken,
              telegramChatId,
              customer.telegramUserId
            );
          }

          if (isAlreadyMember) {
            console.log(`[AccessDeliveryService] Customer ${customer?.telegramUserId} is ALREADY a member of chat ${telegramChatId}.`);
            const cleanedId = telegramChatId.replace('-100', '');
            deliveryUrl = `https://t.me/c/${cleanedId}/1`;
          } else if (!deliveryUrl) {
            // 3. Generate Single-Use Invite Link for New Buyer if no existing link
            const expireTimestamp = accessExpiresAt ? Math.floor(accessExpiresAt.getTime() / 1000) : undefined;
            const invite = await TelegramDeliveryService.createTelegramInvite(
              botToken,
              telegramChatId,
              product.title,
              accessRecord.orderId,
              expireTimestamp
            );
            deliveryUrl = invite.inviteLink;
          }
        }
      } else {
        deliveryUrl = telegramChatId;
      }

      // 4. Send Automated Notification Message to Buyer (Idempotent: check confirmationSentAt)
      let confirmationSent = Boolean(accessRecord.confirmationSentAt);

      if (!confirmationSent && customer && customer.telegramUserId) {
        try {
          let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
          if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
          const appUrl = rawAppUrl.replace(/\/+$/, "");
          const redirectUrl = accessRecord?.id ? `${appUrl}/api/telegram/access/redirect?accessId=${accessRecord.id}${storeSlug ? `&storeSlug=${storeSlug}` : ''}` : deliveryUrl;

          await TelegramDeliveryService.sendPaymentConfirmationMessage(
            botToken,
            customer.telegramUserId,
            product.title,
            redirectUrl,
            isAlreadyMember,
            false,
            storeSlug
          );
          confirmationSent = true;
        } catch (msgErr: any) {
          console.error(`[AccessDeliveryService] Erro ao enviar mensagem no bot para ${customer.telegramUserId}:`, msgErr.message);
        }
      }

      const now = new Date();

      // 5. Save Access Record as ACTIVE and DELIVERED with real grantedAt & expiresAt
      await db.update(accesses).set({
        status: 'ACTIVE',
        deliveryStatus: 'DELIVERED',
        inviteLink: deliveryUrl,
        deliveryError: null,
        grantedAt: accessRecord.grantedAt || paidAtDate,
        expiresAt: accessExpiresAt,
        confirmationSentAt: confirmationSent ? (accessRecord.confirmationSentAt || now) : null,
        updatedAt: now,
      }).where(eq(accesses.id, accessRecord.id));

      // 6. Structured Audit Log (Section 20)
      console.log(JSON.stringify({
        event: "ACCESS_DELIVERY_SUCCESS",
        orderId: accessRecord.orderId,
        accessId: accessRecord.id,
        storeId: accessRecord.storeId,
        productId: product.id,
        telegramUserId: customer?.telegramUserId,
        telegramChatId: telegramChatId,
        botId: bot?.id || bot?.botId,
        paymentStatus: "paid",
        accessStatus: "ACTIVE",
        deliveryStatus: "DELIVERED",
        confirmationMessageSent: confirmationSent
      }));

      return {
        accessId: accessRecord.id,
        status: 'ACTIVE',
        deliveryStatus: 'DELIVERED',
        inviteLink: deliveryUrl,
      };
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido na entrega de acesso.";
      console.error(`[AccessDeliveryService] Delivery failed for access ${accessRecord.id}:`, errorMsg);

      let confirmationSent = Boolean(accessRecord.confirmationSentAt);

      // Attempt sending failed notification to buyer if not sent yet
      if (!confirmationSent && customer && customer.telegramUserId && bot) {
        try {
          const botToken = decrypt(bot.tokenEncrypted);
          await TelegramDeliveryService.sendPaymentConfirmationMessage(
            botToken,
            customer.telegramUserId,
            product.title,
            "",
            false,
            true,
            storeSlug
          );
          confirmationSent = true;
        } catch {
          // Non-blocking fallback
        }
      }

      const now = new Date();

      // Mark Access as FAILED
      await db.update(accesses).set({
        status: 'FAILED',
        deliveryStatus: 'FAILED',
        deliveryError: errorMsg,
        confirmationSentAt: confirmationSent ? (accessRecord.confirmationSentAt || now) : null,
        updatedAt: now,
      }).where(eq(accesses.id, accessRecord.id));

      // Structured Audit Log (Section 20)
      console.log(JSON.stringify({
        event: "ACCESS_DELIVERY_FAILED",
        orderId: accessRecord.orderId,
        accessId: accessRecord.id,
        storeId: accessRecord.storeId,
        productId: product?.id,
        telegramUserId: customer?.telegramUserId,
        telegramChatId: product?.deliveryValue,
        botId: bot?.id || bot?.botId,
        paymentStatus: "paid",
        accessStatus: "FAILED",
        deliveryStatus: "FAILED",
        confirmationMessageSent: confirmationSent,
        error: errorMsg
      }));

      return {
        accessId: accessRecord.id,
        status: 'FAILED',
        deliveryStatus: 'FAILED',
        error: errorMsg,
      };
    }
  }
}
