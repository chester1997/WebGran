import { db } from "@/db";
import { accesses, products, stores, telegramBotChats, telegramBots, telegramCustomers } from "@/db/schema";
import { eq, and, or, lte, inArray, isNotNull, asc } from "drizzle-orm";
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
 * Scans all accesses where now >= expiresAt (and duration != LIFETIME):
 * 1. Sets commercial status = EXPIRED regardless of Telegram connectivity.
 * 2. Attempts Telegram revocation using strictly isolated bot credentials.
 * 3. Records revocationStatus = SUCCESS | FAILED | SKIPPED_NOT_MEMBER.
 * 4. Retries pending/failed Telegram revocations on future runs without restoring commercial status.
 */
export async function processExpiredAccesses(opts: { limit?: number; budgetMs?: number } = {}): Promise<ExpiredProcessResult> {
  const now = new Date();
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : Infinity;
  // Uma nova tentativa só pega o que ninguém mexeu nos últimos 2 minutos (evita duas execuções no mesmo acesso)
  const retryBefore = new Date(now.getTime() - 2 * 60_000);
  console.log(`[processExpiredAccesses] Scanning for expired accesses at ${now.toISOString()}...`);

  const expiredAccesses = await db.query.accesses.findMany({
    where: and(
      isNotNull(accesses.expiresAt),
      lte(accesses.expiresAt, now),
      or(
        eq(accesses.status, 'ACTIVE'),
        and(
          eq(accesses.status, 'EXPIRED'),
          inArray(accesses.revocationStatus, ['FAILED', 'PENDING']),
          lte(accesses.updatedAt, retryBefore)
        )
      )
    ),
    orderBy: [asc(accesses.expiresAt)],
    ...(opts.limit ? { limit: opts.limit } : {}),
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
    if (Date.now() > deadline) break;

    // Reserva o acesso antes de mexer no Telegram: se outra execução já pegou, pula.
    const claimed = await db
      .update(accesses)
      .set({ status: 'EXPIRED', deliveryStatus: 'EXPIRED', expiredAt: acc.expiredAt || now, revocationStatus: 'PENDING', updatedAt: new Date() })
      .where(acc.status === 'ACTIVE' ? and(eq(accesses.id, acc.id), eq(accesses.status, 'ACTIVE')) : and(eq(accesses.id, acc.id), eq(accesses.status, 'EXPIRED'), lte(accesses.updatedAt, retryBefore)))
      .returning({ id: accesses.id });
    if (!claimed.length) continue;

    let revocationStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED_NOT_MEMBER' = 'PENDING';
    let revocationError: string | undefined = undefined;
    let botResolutionFailed = false;

    try {
      const telegramChatId = acc.telegramChatId || acc.product?.deliveryValue;
      // Cliente da Loja Web ("web:<id>") não tem conta do Telegram: não há o que remover do grupo.
      const rawTgUserId = acc.customer?.telegramUserId;
      const telegramUserId = rawTgUserId && !String(rawTgUserId).startsWith('web:') ? rawTgUserId : null;
      const isExternalDelivery = acc.deliveryType === 'external' || acc.product?.deliveryType === 'external';
      const requiresTelegramRevocation = Boolean(
        !isExternalDelivery &&
        telegramChatId &&
        telegramUserId &&
        !telegramChatId.startsWith('http://') &&
        !telegramChatId.startsWith('https://')
      );

      if (requiresTelegramRevocation) {
        let storeBot = null;
        if (acc.product?.botId) {
          // 1. Se acc.product.botId estiver preenchido, busque exclusivamente esse bot ativo no escopo da loja
          storeBot = await db.query.telegramBots.findFirst({
            where: and(
              eq(telegramBots.id, acc.product.botId),
              eq(telegramBots.storeId, acc.storeId),
              eq(telegramBots.status, 'active')
            )
          });
          if (!storeBot) {
            botResolutionFailed = true;
            throw new Error("Bot vinculado ao produto não foi encontrado ou não está ativo nesta loja.");
          }
        } else {
          // 2. Loja Geral: primeiro o bot que é admin desse grupo/canal; senão, um bot ativo da loja
          const chatLink = await db.query.telegramBotChats.findFirst({
            where: and(
              eq(telegramBotChats.storeId, acc.storeId),
              eq(telegramBotChats.telegramChatId, String(telegramChatId)),
              eq(telegramBotChats.isActive, true)
            ),
            columns: { botId: true },
          });
          if (chatLink) {
            storeBot = await db.query.telegramBots.findFirst({
              where: and(
                eq(telegramBots.id, chatLink.botId),
                eq(telegramBots.storeId, acc.storeId),
                eq(telegramBots.status, 'active')
              )
            });
          }
          if (!storeBot) {
            storeBot = await db.query.telegramBots.findFirst({
              where: and(
                eq(telegramBots.storeId, acc.storeId),
                eq(telegramBots.status, 'active')
              )
            });
          }
          if (!storeBot) {
            botResolutionFailed = true;
            throw new Error("Nenhum bot ativo foi encontrado para esta loja.");
          }
        }

        if (!storeBot.tokenEncrypted) {
          botResolutionFailed = true;
          throw new Error("Bot ativo não possui token de autenticação configurado.");
        }

        const botToken = decrypt(storeBot.tokenEncrypted);
        const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");

        // 1. Check if user is currently in channel
        const isMember = await TelegramDeliveryService.checkBuyerMembership(botToken, telegramChatId!, telegramUserId!);

        if (!isMember) {
          revocationStatus = 'SKIPPED_NOT_MEMBER';
          console.log(`[processExpiredAccesses] User ${telegramUserId} already left channel ${telegramChatId}. Skipped revocation.`);
        } else {
          // 2. User IS in channel: execute ban & unban to revoke access
          const botService = new TelegramBotService(botToken);
          try {
            await botService.banChatMember(telegramChatId!, telegramUserId!);
            await botService.unbanChatMember(telegramChatId!, telegramUserId!);
            revocationStatus = 'SUCCESS';
            console.log(`[processExpiredAccesses] Successfully revoked Telegram user ${telegramUserId} from chat ${telegramChatId}.`);
          } catch (botErr: any) {
            revocationStatus = 'FAILED';
            revocationError = `Erro Telegram API: ${botErr.message}`;
            console.warn(`[processExpiredAccesses] Revocation failed for access ${acc.id}:`, revocationError);
          }
        }
      } else {
        // Entrega externa ou que não envolve canal do Telegram: revogação não aplicável
        revocationStatus = 'SKIPPED_NOT_MEMBER';
      }
    } catch (err: any) {
      revocationStatus = 'FAILED';
      revocationError = err.message || "Erro na remoção do Telegram.";
    }

    // 1. Estado comercial do acesso: validade expirou -> marca como EXPIRED no sistema
    // 2. Revogação no Telegram: reflete SUCCESS, SKIPPED_NOT_MEMBER ou FAILED (permitindo retry seguro)
    await db.update(accesses).set({
      status: 'EXPIRED',
      deliveryStatus: 'EXPIRED',
      expiredAt: acc.expiredAt || now,
      revocationStatus,
      revocationError: revocationError || null,
      revokedAt: revocationStatus === 'SUCCESS' ? (acc.revokedAt || now) : (acc.revokedAt || null),
      updatedAt: new Date(),
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

let lastTick = 0;
/**
 * Passada curta e frequente (fila dos fluxos / webhook): no máximo uma vez por minuto por instância.
 * Assim um plano Diário sai do grupo minutos depois de vencer, sem esperar o job diário.
 */
export async function tickExpiredAccesses(): Promise<number> {
  if (Date.now() - lastTick < 60_000) return 0;
  lastTick = Date.now();
  const r = await processExpiredAccesses({ limit: 25, budgetMs: 10_000 });
  return r.processedCount;
}
