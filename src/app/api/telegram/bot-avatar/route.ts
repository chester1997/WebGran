import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

interface CachedAvatar {
  buffer: Buffer;
  contentType: string;
  fileUniqueId?: string;
  etag: string;
  expiresAt: number;
}

// In-memory cache for bot avatar images: bot.id (UUID) -> CachedAvatar
const avatarCache = new Map<string, CachedAvatar>();
// In-flight promises to deduplicate concurrent requests for the same bot
const inFlightRequests = new Map<string, Promise<CachedAvatar | null>>();
// Negative cache for bots that genuinely don't have a photo on Telegram (prevents Telegram spam)
const negativeCache = new Map<string, number>();

// Cache TTL: 3 minutos em memória para verificação leve de alterações no Telegram
const CACHE_TTL_MS = 3 * 60 * 1000;
// Negative cache TTL: 3 minutos (re-tentável via &r=1)
const NEGATIVE_TTL_MS = 3 * 60 * 1000;

/**
 * Função utilitária para invalidar cache do avatar de um bot
 */
export function invalidateBotAvatarCache(botIdentifier: string) {
  avatarCache.delete(botIdentifier);
  negativeCache.delete(botIdentifier);
}

export async function GET(req: NextRequest) {
  await connection();
  try {
    const searchParams = req.nextUrl.searchParams;
    const botIdParam = searchParams.get("botId");
    const forceRefresh = !!searchParams.get("r");

    let targetBotId = botIdParam;

    // Se botId não foi passado diretamente, resolve via store do seller atual
    if (!targetBotId) {
      const store = await getCurrentStore().catch(() => null);
      if (store) {
        const foundBot = await db.query.telegramBots.findFirst({
          where: eq(telegramBots.storeId, store.id),
        });
        if (foundBot) {
          targetBotId = foundBot.id;
        }
      }
    }

    if (!targetBotId) {
      return new NextResponse("Bot não identificado", { status: 400 });
    }

    // Suporte defensivo a botId tanto por UUID (telegramBots.id) quanto por ID numérico (telegramBots.botId)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetBotId);
    const bot = await db.query.telegramBots.findFirst({
      where: isUuid
        ? eq(telegramBots.id, targetBotId)
        : eq(telegramBots.botId, targetBotId),
    });

    if (!bot) {
      return new NextResponse("Bot não encontrado", { status: 404 });
    }

    const internalBotId = bot.id;
    const now = Date.now();

    // 1. Verifica cache em memória válido
    const cached = avatarCache.get(internalBotId);
    if (cached && now < cached.expiresAt && !forceRefresh) {
      // Suporte a requisição condicional (ETag 304 Not Modified)
      const ifNoneMatch = req.headers.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            "ETag": cached.etag,
            "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
          },
        });
      }

      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          "Content-Type": cached.contentType,
          "ETag": cached.etag,
          "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
        },
      });
    }

    // 2. Verifica cache negativo para evitar flood à API do Telegram
    const negExpiry = negativeCache.get(internalBotId);
    if (negExpiry && now < negExpiry && !forceRefresh) {
      return new NextResponse("Foto do bot indisponível", { status: 404 });
    }

    // 3. Deduplicação de requisições concorrentes (Request Coalescing)
    let fetchPromise = inFlightRequests.get(internalBotId);
    if (!fetchPromise) {
      fetchPromise = (async (): Promise<CachedAvatar | null> => {
        let photoDetails: { url: string; fileId: string; fileUniqueId: string } | null = null;

        try {
          const token = decrypt(bot.tokenEncrypted);
          const botService = new TelegramBotService(token);
          photoDetails = await botService.getProfilePhotoDetails().catch(() => null);
        } catch (decryptErr) {
          console.warn("[BOT AVATAR] Erro ao descriptografar token do bot:", decryptErr);
        }

        // Caso o bot não tenha foto no Telegram:
        if (!photoDetails) {
          negativeCache.set(internalBotId, Date.now() + NEGATIVE_TTL_MS);
          avatarCache.delete(internalBotId);

          // Atualiza banco se anteriormente apontava para uma foto
          if (bot.photoUrl !== null) {
            db.update(telegramBots)
              .set({ photoUrl: null, updatedAt: new Date() })
              .where(eq(telegramBots.id, internalBotId))
              .catch(() => {});
          }
          return null;
        }

        // Verifica se a imagem no Telegram é idêntica à do cache existente (mesmo fileUniqueId)
        const existingCache = avatarCache.get(internalBotId);
        if (
          existingCache &&
          existingCache.fileUniqueId &&
          existingCache.fileUniqueId === photoDetails.fileUniqueId
        ) {
          // A foto não mudou no Telegram! Estende o TTL sem baixar novamente os bytes
          existingCache.expiresAt = Date.now() + CACHE_TTL_MS;
          negativeCache.delete(internalBotId);

          // Sincroniza photoUrl no banco se necessário
          if (bot.photoUrl !== photoDetails.url) {
            db.update(telegramBots)
              .set({ photoUrl: photoDetails.url, updatedAt: new Date() })
              .where(eq(telegramBots.id, internalBotId))
              .catch(() => {});
          }
          return existingCache;
        }

        // A foto é nova ou não estava em cache: baixa os bytes da imagem do Telegram
        const res = await fetch(photoDetails.url, {
          signal: AbortSignal.timeout(10000),
        }).catch(() => null);

        if (!res || !res.ok) {
          // Se falhou o download da foto fresca, mas temos cache antigo, re-utiliza o antigo
          if (existingCache) {
            return existingCache;
          }
          negativeCache.set(internalBotId, Date.now() + NEGATIVE_TTL_MS);
          return null;
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Identificação e sanitização do Content-Type
        let contentType = res.headers.get("content-type") || "image/jpeg";
        if (contentType.includes("octet-stream") || !contentType.startsWith("image/")) {
          if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            contentType = "image/jpeg";
          } else if (
            buffer.length > 4 &&
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47
          ) {
            contentType = "image/png";
          } else {
            contentType = "image/jpeg";
          }
        }

        const etag = `"${internalBotId.slice(0, 8)}-${photoDetails.fileUniqueId || photoDetails.fileId}"`;

        const newCached: CachedAvatar = {
          buffer,
          contentType,
          fileUniqueId: photoDetails.fileUniqueId,
          etag,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };

        avatarCache.set(internalBotId, newCached);
        negativeCache.delete(internalBotId);

        // Atualização atômica assíncrona do photoUrl no banco de dados
        if (bot.photoUrl !== photoDetails.url) {
          db.update(telegramBots)
            .set({ photoUrl: photoDetails.url, updatedAt: new Date() })
            .where(eq(telegramBots.id, internalBotId))
            .catch(() => {});
        }

        return newCached;
      })().finally(() => {
        inFlightRequests.delete(internalBotId);
      });

      inFlightRequests.set(internalBotId, fetchPromise);
    }

    const result = await fetchPromise;

    if (!result) {
      // Fallback para cache antigo se disponível mesmo após erro
      const stale = avatarCache.get(internalBotId);
      if (stale) {
        return new NextResponse(new Uint8Array(stale.buffer), {
          headers: {
            "Content-Type": stale.contentType,
            "ETag": stale.etag,
            "Cache-Control": "public, max-age=60, s-maxage=180",
          },
        });
      }
      return new NextResponse("Foto do bot indisponível", { status: 404 });
    }

    // Suporte condicional ETag 304
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === result.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": result.etag,
          "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
        },
      });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "ETag": result.etag,
        "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[BOT AVATAR PROXY ERROR]:", error);
    return new NextResponse("Erro interno ao obter avatar do bot", { status: 500 });
  }
}
