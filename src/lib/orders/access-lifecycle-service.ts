import { db } from "@/db";
import { accesses, products, stores, telegramBots, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramDeliveryService } from "@/lib/delivery/telegram-delivery-service";
import { formatAccessExpirationBR } from "./expiration-service";

export interface AccessResolutionResult {
  success: boolean;
  status: 'MEMBER' | 'INVITE_VALID' | 'INVITE_RENEWED' | 'EXPIRED' | 'FAILED';
  url?: string;
  message?: string;
  isMember?: boolean;
  canRepurchase?: boolean;
  productSlug?: string;
  error?: string;
}

export class AccessLifecycleService {
  /**
   * Resolves the exact content destination URL or renews single-use invite link dynamically based on real Telegram membership & access validity.
   */
  static async resolveAccessContent(accessId: string, storeSlug: string): Promise<AccessResolutionResult> {
    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, storeSlug),
      with: {
        bots: true
      }
    });

    if (!store) {
      return { success: false, status: 'FAILED', error: "Loja não encontrada." };
    }

    const accessRecord = await db.query.accesses.findFirst({
      where: and(
        eq(accesses.id, accessId),
        eq(accesses.storeId, store.id)
      ),
      with: {
        product: true,
        customer: true,
      }
    });

    if (!accessRecord) {
      return { success: false, status: 'FAILED', error: "Acesso não encontrado." };
    }

    const now = new Date();
    const isLifetime = accessRecord.product?.duration === 'lifetime' || !accessRecord.expiresAt;

    // 1. Check if access is expired
    if (!isLifetime && accessRecord.expiresAt && accessRecord.expiresAt.getTime() <= now.getTime()) {
      if (accessRecord.status !== 'EXPIRED') {
        await db.update(accesses).set({
          status: 'EXPIRED',
          deliveryStatus: 'EXPIRED',
          expiredAt: now,
          updatedAt: now,
        }).where(eq(accesses.id, accessRecord.id));
      }

      return {
        success: false,
        status: 'EXPIRED',
        message: "🔴 Seu acesso expirou.",
        canRepurchase: true,
        productSlug: accessRecord.product?.slug,
      };
    }

    const product = accessRecord.product;
    const customer = accessRecord.customer;
    const telegramChatId = product?.deliveryValue ? String(product.deliveryValue).trim() : null;

    if (!telegramChatId) {
      return { success: false, status: 'FAILED', error: "Produto sem destino configurado." };
    }

    // External link delivery
    if (product?.deliveryType === 'external' || telegramChatId.startsWith('http://') || telegramChatId.startsWith('https://')) {
      return {
        success: true,
        status: 'MEMBER',
        url: telegramChatId,
        isMember: true,
      };
    }

    const bot = store.bots?.[0] || await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });

    if (!bot || !bot.tokenEncrypted) {
      return { success: false, status: 'FAILED', error: "Bot da loja não encontrado." };
    }

    const botToken = decrypt(bot.tokenEncrypted);

    // 2. Check if buyer IS ALREADY A MEMBER of the Telegram group/channel
    let isAlreadyMember = false;
    if (customer?.telegramUserId) {
      isAlreadyMember = await TelegramDeliveryService.checkBuyerMembership(
        botToken,
        telegramChatId,
        customer.telegramUserId
      );
    }

    if (isAlreadyMember) {
      const cleanedId = telegramChatId.replace('-100', '');
      const directChannelUrl = `https://t.me/c/${cleanedId}`;
      console.log(`[AccessLifecycleService] Buyer ${customer?.telegramUserId} is ALREADY a member of ${telegramChatId}. Returning direct channel URL.`);
      return {
        success: true,
        status: 'MEMBER',
        url: directChannelUrl,
        isMember: true,
      };
    }

    // 3. Buyer is NOT a member: Check if existing invite link is valid
    const hasValidInvite = accessRecord.inviteLink && 
      accessRecord.inviteExpiresAt && 
      accessRecord.inviteExpiresAt.getTime() > now.getTime();

    if (hasValidInvite && accessRecord.inviteLink) {
      return {
        success: true,
        status: 'INVITE_VALID',
        url: accessRecord.inviteLink,
        isMember: false,
      };
    }

    // 4. Invite is missing or expired, but Access IS VALID (now < Access.expiresAt or LIFETIME): Generate FRESH single-use invite
    const expireDateTimestamp = accessRecord.expiresAt ? Math.floor(accessRecord.expiresAt.getTime() / 1000) : undefined;
    
    const inviteObj = await TelegramDeliveryService.createTelegramInvite(
      botToken,
      telegramChatId,
      product?.title || "Acesso",
      accessRecord.orderId || undefined,
      expireDateTimestamp
    );

    const freshInviteLink = inviteObj.inviteLink;

    // Default invite expiration: access.expiresAt or 7 days from now if lifetime
    const inviteExpirationDate = accessRecord.expiresAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.update(accesses).set({
      inviteLink: freshInviteLink,
      inviteExpiresAt: inviteExpirationDate,
      status: 'ACTIVE',
      deliveryStatus: 'DELIVERED',
      deliveryError: null,
      updatedAt: now,
    }).where(eq(accesses.id, accessRecord.id));

    console.log(`[AccessLifecycleService] Fresh invite link generated for Access ${accessRecord.id}: ${freshInviteLink}`);

    return {
      success: true,
      status: 'INVITE_RENEWED',
      url: freshInviteLink,
      isMember: false,
    };
  }
}
