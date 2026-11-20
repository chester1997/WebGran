import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Bloqueio de clientes por loja (store_id + telegram_user_id).
 *
 * Usa a tabela própria `customer_blocks` (migration drizzle/0023_customer_blocks.sql)
 * e NÃO altera `telegram_customers`. Todas as leituras são "fail-open": se a tabela
 * ainda não existir no banco, ninguém é tratado como bloqueado e o bot, o Mini App
 * e o checkout seguem funcionando exatamente como antes.
 */

export const BLOCKED_CUSTOMER_MESSAGE = "Seu acesso a esta loja foi bloqueado pelo vendedor.";

export interface CustomerBlock {
  telegramUserId: string;
  reason: string | null;
  blockedAt: string;
}

function rowsOf(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  return ((result as any)?.rows as any[]) || [];
}

/** Erro de tabela inexistente no Postgres (42P01). */
export function isMissingTableError(err: unknown): boolean {
  const e = err as any;
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || e?.cause?.message || "");
  return code === "42P01" || /relation "customer_blocks" does not exist/i.test(msg);
}

export class CustomerBlockService {
  /** true se o usuário do Telegram está bloqueado nesta loja. Fail-open. */
  static async isTelegramUserBlocked(storeId: string | null | undefined, telegramUserId: string | number | null | undefined): Promise<boolean> {
    if (!storeId || telegramUserId === null || telegramUserId === undefined || telegramUserId === "") return false;
    try {
      const res = await db.execute(sql`
        SELECT true AS blocked FROM customer_blocks
        WHERE store_id = ${storeId} AND telegram_user_id = ${String(telegramUserId)}
        LIMIT 1
      `);
      return rowsOf(res)[0]?.blocked === true;
    } catch (err) {
      if (!isMissingTableError(err)) console.error("[CustomerBlock] Falha ao checar bloqueio (liberando):", (err as any)?.message);
      return false;
    }
  }

  /** Mesma checagem a partir do id interno do cliente (telegram_customers.id). Fail-open. */
  static async isCustomerIdBlocked(storeId: string | null | undefined, customerId: string | null | undefined): Promise<boolean> {
    if (!storeId || !customerId) return false;
    try {
      const res = await db.execute(sql`
        SELECT true AS blocked FROM customer_blocks cb
        JOIN telegram_customers tc
          ON tc.store_id = cb.store_id AND tc.telegram_user_id = cb.telegram_user_id
        WHERE cb.store_id = ${storeId} AND tc.id = ${customerId}
        LIMIT 1
      `);
      return rowsOf(res)[0]?.blocked === true;
    } catch (err) {
      if (!isMissingTableError(err)) console.error("[CustomerBlock] Falha ao checar bloqueio por cliente (liberando):", (err as any)?.message);
      return false;
    }
  }

  /** Lista os bloqueios da loja. `available: false` quando a tabela ainda não existe. */
  static async listBlocks(storeId: string): Promise<{ available: boolean; blocks: CustomerBlock[] }> {
    try {
      const res = await db.execute(sql`
        SELECT telegram_user_id, reason, blocked_at
        FROM customer_blocks
        WHERE store_id = ${storeId}
      `);
      return {
        available: true,
        blocks: rowsOf(res).map((r) => ({
          telegramUserId: String(r.telegram_user_id),
          reason: r.reason ?? null,
          blockedAt: new Date(r.blocked_at).toISOString(),
        })),
      };
    } catch (err) {
      if (!isMissingTableError(err)) console.error("[CustomerBlock] Falha ao listar bloqueios:", (err as any)?.message);
      return { available: false, blocks: [] };
    }
  }

  static async block(params: { storeId: string; telegramUserId: string; reason?: string | null; blockedBy: string }): Promise<void> {
    const reason = params.reason?.trim().slice(0, 300) || null;
    await db.execute(sql`
      INSERT INTO customer_blocks (store_id, telegram_user_id, reason, blocked_by, blocked_at)
      VALUES (${params.storeId}, ${params.telegramUserId}, ${reason}, ${params.blockedBy}, NOW())
      ON CONFLICT (store_id, telegram_user_id)
      DO UPDATE SET reason = EXCLUDED.reason, blocked_by = EXCLUDED.blocked_by, blocked_at = NOW()
    `);
  }

  static async unblock(params: { storeId: string; telegramUserId: string }): Promise<void> {
    await db.execute(sql`
      DELETE FROM customer_blocks
      WHERE store_id = ${params.storeId} AND telegram_user_id = ${params.telegramUserId}
    `);
  }
}
