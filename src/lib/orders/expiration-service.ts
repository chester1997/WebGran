import { db } from "@/db";
import { accesses, products, stores, telegramBots, telegramCustomers } from "@/db/schema";
import { eq, and, lte, inArray, isNotNull } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export type ProductDurationType = 
  | 'daily' | 'DAILY'
  | 'weekly' | 'WEEKLY'
  | 'biweekly' | 'BIWEEKLY'
  | 'monthly' | 'MONTHLY'
  | 'quarterly' | 'QUARTERLY'
  | 'semiannual' | 'SEMIANNUAL'
  | 'annual' | 'ANNUAL' | 'yearly' | 'YEARLY'
  | 'lifetime' | 'LIFETIME';

/**
 * Calculates the exact backend access expiration date based on the product duration type and baseline paidAt timestamp.
 */
export function calculateAccessExpiration(
  duration: string | null | undefined,
  paidAt?: Date | string | null
): Date | null {
  if (!duration) return null;

  const normalized = duration.trim().toLowerCase();
  if (normalized === 'lifetime' || normalized === 'vitalicio' || normalized === 'vitalício') {
    return null;
  }

  const start = paidAt ? new Date(paidAt) : new Date();
  const result = new Date(start);

  switch (normalized) {
    case 'daily':
    case 'diario':
    case 'diário':
      result.setDate(result.getDate() + 1);
      return result;

    case 'weekly':
    case 'semanal':
      result.setDate(result.getDate() + 7);
      return result;

    case 'biweekly':
    case 'quinzena':
    case 'quinzenal':
      result.setDate(result.getDate() + 14);
      return result;

    case 'monthly':
    case 'mensal': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 1);
      // Handle day-of-month overflow (e.g. Jan 31 + 1 month -> Feb 28)
      if (result.getMonth() !== (currentMonth + 1) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'quarterly':
    case 'trimestral': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 3);
      if (result.getMonth() !== (currentMonth + 3) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'semiannual':
    case 'semestral': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 6);
      if (result.getMonth() !== (currentMonth + 6) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'annual':
    case 'yearly':
    case 'anual': {
      result.setFullYear(result.getFullYear() + 1);
      return result;
    }

    default:
      return null;
  }
}

/**
 * Formats access expiration details for Brazilian UI rendering (Meus Acessos & Admin).
 */
export function formatAccessExpirationBR(expiresAt: Date | string | null, status?: string) {
  if (!expiresAt) {
    return {
      isLifetime: true,
      isExpired: false,
      dateFormatted: "Acesso vitalício",
      daysRemaining: null,
      badgeText: "Acesso vitalício",
      badgeType: "LIFETIME" as const
    };
  }

  const expDate = new Date(expiresAt);
  const now = new Date();
  const day = String(expDate.getDate()).padStart(2, '0');
  const month = String(expDate.getMonth() + 1).padStart(2, '0');
  const year = expDate.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = status === 'EXPIRED' || diffMs <= 0;

  if (isExpired) {
    return {
      isLifetime: false,
      isExpired: true,
      dateFormatted: `Expirou em ${dateStr}`,
      daysRemaining: 0,
      badgeText: `Expirou em ${dateStr}`,
      badgeType: "EXPIRED" as const
    };
  }

  return {
    isLifetime: false,
    isExpired: false,
    dateFormatted: `Expira em ${dateStr}`,
    daysRemaining: diffDays > 0 ? diffDays : 0,
    badgeText: `Expira em ${dateStr}`,
    badgeType: "ACTIVE" as const
  };
}

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
