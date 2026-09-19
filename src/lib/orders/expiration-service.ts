import { db } from "@/db";
import { accesses, products, stores, telegramBots, telegramCustomers } from "@/db/schema";
import { eq, and, lte, inArray, isNotNull } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export {
  calculateAccessExpiration,
  formatAccessExpirationBR,
  type ProductDurationType
} from "./expiration-utils";

export interface ExpiredProcessResult {
  processedCount: number;
  results: Array<{
    accessId: string;
    storeId: string;
    customerId: string;
    productId: string;
    revokedFromTelegram: boolean;
    error?: string;
  }>;
}

/**
 * Backend Service Job: processExpiredAccesses()
 * Scans all ACTIVE accesses where now >= expiresAt (and duration != LIFETIME), revokes Telegram member access, and marks status = EXPIRED.
 */
export async function processExpiredAccesses(): Promise<ExpiredProcessResult> {
  const now = new Date();
  console.log(`[processExpiredAccesses] Scanning for expired accesses at ${now.toISOString()}...`);

  const expiredAccesses = await db.query.accesses.findMany({
    where: and(
      eq(accesses.status, 'ACTIVE'),
      isNotNull(accesses.expiresAt),
      lte(accesses.expiresAt, now)
    ),
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

  console.log(`[processExpiredAccesses] Found ${expiredAccesses.length} accesses to expire.`);
  const results: ExpiredProcessResult['results'] = [];

  for (const acc of expiredAccesses) {
    let revocationStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED_NOT_MEMBER' = 'PENDING';
    let revocationError: string | undefined = undefined;

    try {
      const storeBot = acc.store?.bots?.[0] || await db.query.telegramBots.findFirst({
        where: eq(telegramBots.storeId, acc.storeId)
      });

      const telegramChatId = acc.telegramChatId || acc.product?.deliveryValue;
      const telegramUserId = acc.customer?.telegramUserId;

      if (storeBot && storeBot.tokenEncrypted && telegramChatId && telegramUserId && !telegramChatId.startsWith('http://') && !telegramChatId.startsWith('https://')) {
        const botToken = decrypt(storeBot.tokenEncrypted);
        const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");

        // 1. Check if user is currently in channel
        const isMember = await TelegramDeliveryService.checkBuyerMembership(botToken, telegramChatId, telegramUserId);

        if (!isMember) {
          revocationStatus = 'SKIPPED_NOT_MEMBER';
          console.log(`[processExpiredAccesses] User ${telegramUserId} already left channel ${telegramChatId}. Skipped revocation.`);
        } else {
          // 2. User IS in channel: execute ban & unban to revoke access
          const botService = new TelegramBotService(botToken);
          try {
            await botService.banChatMember(telegramChatId, telegramUserId);
            await botService.unbanChatMember(telegramChatId, telegramUserId);
            revocationStatus = 'SUCCESS';
            console.log(`[processExpiredAccesses] Successfully revoked Telegram user ${telegramUserId} from chat ${telegramChatId}.`);
          } catch (botErr: any) {
            revocationStatus = 'FAILED';
            revocationError = `Erro Telegram API: ${botErr.message}`;
            console.warn(`[processExpiredAccesses] Revocation failed for access ${acc.id}:`, revocationError);
          }
        }
      } else {
        revocationStatus = 'SKIPPED_NOT_MEMBER';
      }
    } catch (err: any) {
      revocationStatus = 'FAILED';
      revocationError = err.message || "Erro na remoção do Telegram.";
    }

    // Update Access status to EXPIRED in Neon DB (Idempotent)
    await db.update(accesses).set({
      status: 'EXPIRED',
      deliveryStatus: 'EXPIRED',
      expiredAt: now,
      revocationStatus,
      revocationError: revocationError || null,
      revokedAt: revocationStatus === 'SUCCESS' ? now : null,
      updatedAt: now,
    }).where(eq(accesses.id, acc.id));

    results.push({
      accessId: acc.id,
      storeId: acc.storeId,
      customerId: acc.customerId,
      productId: acc.productId,
      revokedFromTelegram: revocationStatus === 'SUCCESS',
      error: revocationError
    });
  }

  return {
    processedCount: results.length,
    results
  };
}
