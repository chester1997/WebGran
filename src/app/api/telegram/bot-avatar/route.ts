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
  expiresAt: number;
}

// In-memory cache for bot avatar images: botId -> CachedAvatar
const avatarCache = new Map<string, CachedAvatar>();
// In-flight promises to deduplicate concurrent requests for the same bot
const inFlightRequests = new Map<string, Promise<CachedAvatar | null>>();
// Negative cache for bots that genuinely don't have a photo on Telegram (prevents Telegram spam)
const negativeCache = new Map<string, number>();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de cache em memória
const NEGATIVE_TTL_MS = 3 * 60 * 1000; // 3 minutos de cache negativo

export async function GET(req: NextRequest) {
  await connection();
  try {
    const searchParams = req.nextUrl.searchParams;
    const botId = searchParams.get("botId");

    let targetBotId = botId;

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

    const now = Date.now();

    // 1. Verifica cache em memória válido
    const cached = avatarCache.get(targetBotId);
    if (cached && now < cached.expiresAt) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    // 2. Verifica cache negativo para evitar flood à API do Telegram
    const negExpiry = negativeCache.get(targetBotId);
    if (negExpiry && now < negExpiry && !searchParams.get("r")) {
      return new NextResponse("Foto do bot indisponível", { status: 404 });
    }

    // 3. Deduplicação de requisições concorrentes (Request Coalescing)
    let fetchPromise = inFlightRequests.get(targetBotId);
    if (!fetchPromise) {
      fetchPromise = (async (): Promise<CachedAvatar | null> => {
        const bot = await db.query.telegramBots.findFirst({
          where: eq(telegramBots.id, targetBotId!),
        });

        if (!bot) {
          return null;
        }

        let freshPhotoUrl: string | null = null;
        try {
          const token = decrypt(bot.tokenEncrypted);
          const botService = new TelegramBotService(token);
          freshPhotoUrl = await botService.getProfilePhotoUrl().catch(() => null);
        } catch (decryptErr) {
          console.warn("[BOT AVATAR] Erro ao descriptografar token do bot:", decryptErr);
        }

        // Se falhou ao buscar foto fresca, tenta fallback da URL guardada no banco
        const photoUrlToFetch = freshPhotoUrl || bot.photoUrl;

        if (!photoUrlToFetch) {
          negativeCache.set(targetBotId!, Date.now() + NEGATIVE_TTL_MS);
          return null;
        }

        // Busca os bytes da imagem no Telegram com timeout defensivo de 10s
        const res = await fetch(photoUrlToFetch, { signal: AbortSignal.timeout(10000) }).catch(() => null);

        if (!res || !res.ok) {
          // Se a foto fresca falhou e existe cache anterior (stale), re-utiliza
          const stale = avatarCache.get(targetBotId!);
          if (stale) {
            return stale;
          }
          negativeCache.set(targetBotId!, Date.now() + NEGATIVE_TTL_MS);
          return null;
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Identificação e sanitização do Content-Type
        let contentType = res.headers.get("content-type") || "image/jpeg";
        if (contentType.includes("octet-stream") || !contentType.startsWith("image/")) {
          if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            contentType = "image/jpeg";
          } else if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            contentType = "image/png";
          } else {
            contentType = "image/jpeg";
          }
        }

        const newCached: CachedAvatar = {
          buffer,
          contentType,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };

        avatarCache.set(targetBotId!, newCached);
        negativeCache.delete(targetBotId!);
        return newCached;
      })().finally(() => {
        inFlightRequests.delete(targetBotId!);
      });

      inFlightRequests.set(targetBotId, fetchPromise);
    }

    const result = await fetchPromise;

    if (!result) {
      // Fallback para cache antigo se disponível mesmo após erro
      const stale = avatarCache.get(targetBotId);
      if (stale) {
        return new NextResponse(new Uint8Array(stale.buffer), {
          headers: {
            "Content-Type": stale.contentType,
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      }
      return new NextResponse("Foto do bot indisponível", { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error: any) {
    console.error("[BOT AVATAR PROXY ERROR]:", error);
    return new NextResponse("Erro interno ao obter avatar do bot", { status: 500 });
  }
}
