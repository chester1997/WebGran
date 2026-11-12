import { db } from "@/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

export const RATE_LIMIT_CONFIG = {
  NORMAL_LIMIT: 60, // Limite padrão distribuído no Neon/PostgreSQL (req/min)
  FALLBACK_LIMIT: 15, // Limite conservador durante contingência em memória (req/min)
  WINDOW_SECONDS: 60,
};

// Fallback em memória (contingência local por container Vercel)
export const inMemoryFallback = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  fallback: boolean;
  source: "neon_postgres" | "memory_contingency";
}

/**
 * Executa checagem síncrona no mapa em memória durante indisponibilidade do banco.
 * A execução no event loop do Node.js é sequencial por container, prevenindo race conditions locais.
 */
export function checkFallbackRateLimit(
  key: string,
  limit: number = RATE_LIMIT_CONFIG.FALLBACK_LIMIT,
  windowMs: number = RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = inMemoryFallback.get(key);

  if (!entry || now > entry.resetAt) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Rate Limiter persistente e distribuído no Neon/PostgreSQL com contingência conservadora
 * 
 * - Proteção Principal: Neon PostgreSQL via INSERT ... ON CONFLICT DO UPDATE (concurrency-safe e distribuído).
 * - Proteção de Contingência: Fallback em memória com limite 4x mais conservador (15 req/min).
 * - Privacidade Estrita: Chave gerada com hash SHA-256 do IP e contexto da loja (sem persistir IPs ou tokens).
 * - Auto-recuperação: Cada requisição tenta o Neon primeiro; quando o banco reestabelece, o controle persistente retorna imediatamente.
 */
export async function checkTelegramAuthRateLimit(
  clientIp: string,
  storeSlug: string = "general",
  customDb?: any
): Promise<RateLimitResult> {
  const ipHash = crypto.createHash("sha256").update(clientIp || "unknown").digest("hex").slice(0, 16);
  const rateLimitKey = `tg_auth:${storeSlug}:${ipHash}`;
  const targetDb = customDb || db;

  try {
    const result = await targetDb.execute(sql`
      INSERT INTO "auth_rate_limits" ("key", "count", "reset_at", "updated_at")
      VALUES (${rateLimitKey}, 1, NOW() + (${RATE_LIMIT_CONFIG.WINDOW_SECONDS} || ' seconds')::interval, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET 
        "count" = CASE 
          WHEN "auth_rate_limits"."reset_at" <= NOW() THEN 1 
          ELSE "auth_rate_limits"."count" + 1 
        END,
        "reset_at" = CASE 
          WHEN "auth_rate_limits"."reset_at" <= NOW() THEN NOW() + (${RATE_LIMIT_CONFIG.WINDOW_SECONDS} || ' seconds')::interval 
          ELSE "auth_rate_limits"."reset_at" 
        END,
        "updated_at" = NOW()
      RETURNING "count", "reset_at";
    `);

    // Limpeza assíncrona não-bloqueante (2% das requisições)
    if (Math.random() < 0.02) {
      targetDb.execute(sql`DELETE FROM "auth_rate_limits" WHERE "reset_at" < NOW() - INTERVAL '10 minutes'`).catch(() => {});
    }

    const rows = Array.isArray(result) ? result : (result as any)?.rows;
    const row = rows?.[0];
    if (row) {
      const count = Number(row.count);
      if (count > RATE_LIMIT_CONFIG.NORMAL_LIMIT) {
        const retryAfter = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
        return { allowed: false, retryAfter, fallback: false, source: "neon_postgres" };
      }
    }

    return { allowed: true, fallback: false, source: "neon_postgres" };
  } catch (dbErr: any) {
    // Log seguro da contingência sem expor tokens, chaves ou IPs
    const errorCode = dbErr?.code || dbErr?.name || "DB_UNAVAILABLE";
    console.warn(
      `[TelegramAuthRateLimiter:CONTINGENCY] Neon inacessível (${errorCode}) para contexto loja=${storeSlug}. Ativando fallback conservador em memória (limite=${RATE_LIMIT_CONFIG.FALLBACK_LIMIT}/min).`
    );

    const fallbackResult = checkFallbackRateLimit(rateLimitKey);
    return {
      allowed: fallbackResult.allowed,
      retryAfter: fallbackResult.retryAfter,
      fallback: true,
      source: "memory_contingency",
    };
  }
}

