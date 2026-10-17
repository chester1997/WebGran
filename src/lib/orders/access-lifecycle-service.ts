import { db } from "@/db";
import { accesses, products, stores, telegramBots, telegramCustomers, productVideoAssignments, productVideos, orders } from "@/db/schema";
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

    // Strict server-side verification: if this access was created from an order, verify the order is legitimately paid
    if (accessRecord.orderId) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, accessRecord.orderId),
      });

      if (!order || order.status !== 'paid' || !order.paymentMethod || !order.paymentId) {
        return {
          success: false,
          status: 'FAILED',
          destinationType: 'ERROR',
          destinationUrl: null,
          expiresAt: accessRecord.expiresAt,
          error: "Acesso bloqueado: o pagamento deste pedido não foi aprovado pelo gateway de pagamento.",
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
    const telegramChatId = (product?.deliveryValue ? String(product.deliveryValue).trim() : null) || (accessRecord.telegramChatId ? String(accessRecord.telegramChatId).trim() : null);

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

    // 1. Resolve Bot strictly isolated by store and product association
    let bot = null;

    if (product?.botId) {
      // Regra 1: Se product.botId estiver definido, resolver EXCLUSIVAMENTE esse bot validando id e storeId
      bot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, product.botId),
          eq(telegramBots.storeId, store.id)
        )
      });

      if (!bot) {
        return {
          success: false,
          status: 'FAILED',
          destinationType: 'ERROR',
          destinationUrl: null,
          expiresAt: accessRecord.expiresAt,
          error: "Bot vinculado ao produto não foi encontrado ou não pertence a esta loja."
        };
      }

      if (bot.status !== 'active') {
        return {
          success: false,
          status: 'FAILED',
          destinationType: 'ERROR',
          destinationUrl: null,
          expiresAt: accessRecord.expiresAt,
          error: "Bot vinculado ao produto não está ativo nesta loja."
        };
      }
    } else {
      // Regra 2: Somente se product.botId for nulo, selecionar bot ativo da mesma loja
      bot = store.bots?.find((b: any) => b.status === 'active') || await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.storeId, store.id),
          eq(telegramBots.status, 'active')
        )
      }) || store.bots?.[0] || await db.query.telegramBots.findFirst({
        where: eq(telegramBots.storeId, store.id)
      });

      if (!bot) {
        return {
          success: false,
          status: 'FAILED',
          destinationType: 'ERROR',
          destinationUrl: null,
          expiresAt: accessRecord.expiresAt,
          error: "Nenhum bot do Telegram está configurado para esta loja."
        };
      }
    }

    if (!bot || !bot.tokenEncrypted) {
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        error: "Token do bot não configurado."
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

    // 3. Buyer is NOT a member: Check if existing invite link is valid and commercial access authorized
    const hasExplicitlyValidInvite = Boolean(
      accessRecord.inviteLink && 
      accessRecord.inviteExpiresAt && 
      accessRecord.inviteExpiresAt.getTime() > now.getTime()
    );

    // Se não houver validade registrada para o convite, preserva o link existente se o acesso comercial estiver autorizado
    const hasUnexpiredAccessWithoutInviteDate = Boolean(
      accessRecord.inviteLink &&
      !accessRecord.inviteExpiresAt &&
      (isLifetime || (accessRecord.expiresAt && accessRecord.expiresAt.getTime() > now.getTime()))
    );

    if (hasExplicitlyValidInvite || hasUnexpiredAccessWithoutInviteDate) {
      return {
        success: true,
        status: 'ACTIVE',
        destinationType: 'INVITE',
        destinationUrl: accessRecord.inviteLink!,
        expiresAt: accessRecord.expiresAt,
        membershipStatus: memberStatusStr,
        telegramUserId: customer?.telegramUserId || undefined,
      };
    }

    // 4. Invite is missing or expired, but Access IS VALID (now < Access.expiresAt or LIFETIME): Generate FRESH single-use invite
    let freshInviteLink: string;
    let freshInviteExpiresAt: Date | null = null;

    try {
      const expireDateTimestamp = accessRecord.expiresAt ? Math.floor(accessRecord.expiresAt.getTime() / 1000) : undefined;
      const inviteObj = await TelegramDeliveryService.createTelegramInvite(
        botToken,
        telegramChatId,
        product?.title || "Acesso",
        accessRecord.orderId || undefined,
        expireDateTimestamp
      );
      freshInviteLink = inviteObj.inviteLink;
      if (inviteObj.expireDate) {
        freshInviteExpiresAt = new Date(inviteObj.expireDate * 1000);
      }
    } catch (inviteErr: any) {
      const errMsg = inviteErr.message || "Erro desconhecido ao gerar convite no Telegram.";
      console.error(`[AccessLifecycleService] Failed to generate Telegram invite for access ${accessRecord.id}:`, errMsg);
      return {
        success: false,
        status: 'FAILED',
        destinationType: 'ERROR',
        destinationUrl: null,
        expiresAt: accessRecord.expiresAt,
        error: `Não foi possível gerar o link de acesso ao grupo: ${errMsg}`
      };
    }

    await db.update(accesses).set({
      inviteLink: freshInviteLink,
      inviteExpiresAt: freshInviteExpiresAt,
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
