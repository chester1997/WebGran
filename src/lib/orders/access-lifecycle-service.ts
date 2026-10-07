import { db } from "@/db";
import { accesses, products, stores, telegramBots, telegramCustomers, productVideoAssignments, productVideos } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

export interface AccessDestinationResult {
  success: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'FAILED';
  destinationType: 'DIRECT_CHAT' | 'INVITE' | 'EXPIRED' | 'ERROR' | 'PRODUCT_VIDEO';
  destinationUrl: string | null;
  expiresAt: Date | null;
  membershipStatus?: string;
  telegramUserId?: string;
  message?: string;
  canRepurchase?: boolean;
  productSlug?: string;
  error?: string;
}

export class AccessLifecycleService {
  /**
   * Resolves the exact content destination URL or renews single-use invite link dynamically based on real Telegram membership & access validity.
   * Returns a structured AccessDestinationResult object.
   */
  static async resolveAccessDestination(accessId: string, storeSlug?: string, expectedTelegramUserId?: string): Promise<AccessDestinationResult> {
    const accessRecord = await db.query.accesses.findFirst({
      where: eq(accesses.id, accessId),
      with: {
        product: true,
        customer: true,
        store: {
          with: {
            bots: true
          }
        }
      }
    });

    if (!accessRecord) {
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: null,
        error: "Acesso não encontrado."
      };
    }

    const store = accessRecord.store;
    if (storeSlug && store.slug !== storeSlug) {
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        error: "Acesso não pertence a esta loja."
      };
    }

    if (expectedTelegramUserId && accessRecord.customer?.telegramUserId) {
      if (accessRecord.customer.telegramUserId !== String(expectedTelegramUserId)) {
        return {
          success: false,
          status: 'FAILED',
          destinationType: 'ERROR',
          destinationUrl: null,
          expiresAt: accessRecord.expiresAt,
          error: "Acesso não autorizado para este usuário."
        };
      }
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
        destinationType: 'EXPIRED',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        message: "🔴 Seu acesso expirou.",
        canRepurchase: true,
        productSlug: accessRecord.product?.slug,
      };
    }

    const product = accessRecord.product;
    const customer = accessRecord.customer;
    const telegramChatId = product?.deliveryValue ? String(product.deliveryValue).trim() : null;

    if (product?.deliveryType === 'product_video') {
      let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
      if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
      const appUrl = rawAppUrl.replace(/\/+$/, "");
      const effectiveStoreSlug = storeSlug || store?.slug || "";

      // 1. Find assigned videos for this product ordered by position ASC
      const assignments = db.query.productVideoAssignments?.findMany
        ? await db.query.productVideoAssignments.findMany({
            where: and(
              eq(productVideoAssignments.storeId, accessRecord.storeId),
              eq(productVideoAssignments.productId, product.id)
            ),
            orderBy: [asc(productVideoAssignments.position)],
            with: {
              video: true
            }
          })
        : [];

      const validAssignedVideos = (assignments || [])
        .map(a => a?.video)
        .filter((v): v is NonNullable<typeof v> => Boolean(v && v.status === "READY" && v.active));

      let firstVideoId = validAssignedVideos[0]?.id;

      // 2. Fallback: check legacy productVideos table
      if (!firstVideoId && db.query.productVideos?.findFirst) {
        const legacyVideo = await db.query.productVideos.findFirst({
          where: and(
            eq(productVideos.storeId, accessRecord.storeId),
            eq(productVideos.productId, product.id),
            eq(productVideos.status, "READY"),
            eq(productVideos.active, true)
          ),
          orderBy: [asc(productVideos.position)]
        });
        if (legacyVideo) {
          firstVideoId = legacyVideo.id;
        }
      }

      // Safe fallback if product has no assigned videos
      const destinationUrl = firstVideoId
        ? `${appUrl}/miniapp/${effectiveStoreSlug}/video/${firstVideoId}`
        : `${appUrl}/miniapp/${effectiveStoreSlug}/accesses`;

      return {
        success: true,
        status: 'ACTIVE',
        destinationType: 'PRODUCT_VIDEO',
        destinationUrl: destinationUrl,
        expiresAt: accessRecord.expiresAt,
      };
    }

    if (!telegramChatId) {
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        error: "Produto sem destino configurado."
      };
    }

    // External link delivery
    if (product?.deliveryType === 'external' || telegramChatId.startsWith('http://') || telegramChatId.startsWith('https://')) {
      return {
        success: true,
        status: 'ACTIVE',
        destinationType: 'DIRECT_CHAT',
        destinationUrl: telegramChatId,
        expiresAt: accessRecord.expiresAt,
      };
    }

    const bot = store.bots?.[0] || await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });

    if (!bot || !bot.tokenEncrypted) {
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        error: "Bot da loja não encontrado."
      };
    }

    const botToken = decrypt(bot.tokenEncrypted);

    // 2. Check if buyer IS ALREADY A MEMBER of the Telegram group/channel
    let isAlreadyMember = false;
    let memberStatusStr = "NOT_MEMBER";
    if (customer?.telegramUserId) {
      isAlreadyMember = await TelegramDeliveryService.checkBuyerMembership(
        botToken,
        telegramChatId,
        customer.telegramUserId
      );
      if (isAlreadyMember) {
        memberStatusStr = "MEMBER";
      }
    }

    if (isAlreadyMember) {
      let directChannelUrl = telegramChatId;
      if (telegramChatId.startsWith('-100')) {
        const cleanedId = telegramChatId.replace('-100', '');
        directChannelUrl = `https://t.me/c/${cleanedId}/1`;
      } else if (telegramChatId.startsWith('@')) {
        directChannelUrl = `https://t.me/${telegramChatId.replace('@', '')}`;
      }
      console.log(`[AccessLifecycleService] Buyer ${customer?.telegramUserId} is ALREADY a member of ${telegramChatId}. Returning direct channel URL.`);
      return {
        success: true,
        status: 'ACTIVE',
        destinationType: 'DIRECT_CHAT',
        destinationUrl: directChannelUrl,
        expiresAt: accessRecord.expiresAt,
        membershipStatus: memberStatusStr,
        telegramUserId: customer?.telegramUserId || undefined,
      };
    }

    // 3. Buyer is NOT a member: Check if existing invite link is valid
    const hasValidInvite = accessRecord.inviteLink && 
      accessRecord.inviteExpiresAt && 
      accessRecord.inviteExpiresAt.getTime() > now.getTime();

    if (hasValidInvite && accessRecord.inviteLink) {
      return {
        success: true,
        status: 'ACTIVE',
        destinationType: 'INVITE',
        destinationUrl: accessRecord.inviteLink,
        expiresAt: accessRecord.expiresAt,
        membershipStatus: memberStatusStr,
        telegramUserId: customer?.telegramUserId || undefined,
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
      status: 'ACTIVE',
      destinationType: 'INVITE',
      destinationUrl: freshInviteLink,
      expiresAt: accessRecord.expiresAt,
      membershipStatus: memberStatusStr,
      telegramUserId: customer?.telegramUserId || undefined,
    };
  }

  /**
   * Alias for backward compatibility with previous APIs.
   */
  static async resolveAccessContent(accessId: string, storeSlug: string): Promise<AccessResolutionResult> {
    const res = await this.resolveAccessDestination(accessId, storeSlug);
    if (!res.success) {
      if (res.status === 'EXPIRED') {
        return {
          success: false,
          status: 'EXPIRED',
          message: res.message || "🔴 Seu acesso expirou.",
          canRepurchase: true,
          productSlug: res.productSlug,
        };
      }
      return {
        success: false,
        status: 'FAILED',
        error: res.error || "Falha ao resolver acesso."
      };
    }

    return {
      success: true,
      status: res.destinationType === 'DIRECT_CHAT' ? 'MEMBER' : 'INVITE_VALID',
      url: res.destinationUrl || undefined,
      isMember: res.destinationType === 'DIRECT_CHAT',
    };
  }
}
