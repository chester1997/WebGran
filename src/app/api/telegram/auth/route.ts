import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramCustomers, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateInitData } from "@/lib/telegram/validation";
import { SignJWT } from "jose";
import { decrypt } from "@/lib/encryption";
import { checkTelegramAuthRateLimit } from "@/lib/telegram/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { initData, storeSlug } = body || {};

    if (!initData || !storeSlug || typeof initData !== "string" || typeof storeSlug !== "string") {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    // Rate limit distribuído no PostgreSQL por contexto de loja e cliente com contingência conservadora
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimit = await checkTelegramAuthRateLimit(clientIp, storeSlug);

    if (!rateLimit.allowed) {
      const headers: Record<string, string> = {};
      if (rateLimit.retryAfter) {
        headers["Retry-After"] = rateLimit.retryAfter.toString();
      }
      if (rateLimit.fallback) {
        headers["X-RateLimit-Fallback"] = "memory-contingency";
      }

      return NextResponse.json(
        { error: "Muitas tentativas de autenticação. Aguarde alguns instantes." },
        { status: 429, headers }
      );
    }

    // 1. Resolver a loja e seus respectivos bots
    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, storeSlug),
      with: { bots: true },
    });

    if (!store || !store.bots || store.bots.length === 0) {
      return NextResponse.json({ error: "Loja não encontrada ou sem bots configurados" }, { status: 404 });
    }

    // 2. Validar a assinatura do initData com o token de cada bot associado à loja
    // Protocolo oficial do Telegram com validação de auth_date (max 24h) e timing-safe comparison
    let isValid = false;
    let validatedBotId: string | null = null;
    let validatedBotUsername: string | null = null;

    for (const bot of store.bots) {
      if (!bot.tokenEncrypted || bot.status !== "active") continue;
      try {
        const token = decrypt(bot.tokenEncrypted);
        if (validateInitData(initData, token, { maxAgeSeconds: 86400 })) {
          isValid = true;
          validatedBotId = bot.id;
          validatedBotUsername = bot.username || bot.displayName || null;
          break;
        }
      } catch {
        // Fallback seguro em caso de token inválido, sem expor nada em logs
        continue;
      }
    }

    // Ambiente de desenvolvimento: permite bypass seguro se initData não for fornecido
    const isDev = process.env.NODE_ENV === "development";
    if (!isValid && !isDev) {
      return NextResponse.json({ error: "Assinatura do Telegram inválida ou expirada." }, { status: 401 });
    }

    // 3. Extrair os dados do usuário do initData com sanitização
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get("user");

    let tgUser: any;
    if (!userStr) {
      if (isDev) {
        tgUser = { id: 123456789, first_name: "Visitante", last_name: "Dev" };
      } else {
        return NextResponse.json({ error: "Dados de usuário não encontrados no initData" }, { status: 400 });
      }
    } else {
      try {
        tgUser = JSON.parse(decodeURIComponent(userStr));
      } catch {
        return NextResponse.json({ error: "Payload de usuário corrompido" }, { status: 400 });
      }
    }

    if (!tgUser?.id) {
      return NextResponse.json({ error: "ID do usuário do Telegram não encontrado" }, { status: 400 });
    }

    // 4. Upsert TelegramCustomer isolado rigorosamente pela store.id
    const existingCustomer = await db.query.telegramCustomers.findFirst({
      where: (tc, { eq, and }) =>
        and(eq(tc.storeId, store.id), eq(tc.telegramUserId, tgUser.id.toString())),
    });

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      await db
        .update(telegramCustomers)
        .set({
          firstName: tgUser.first_name || "Cliente",
          lastName: tgUser.last_name || null,
          username: tgUser.username || null,
          photoUrl: tgUser.photo_url || existingCustomer.photoUrl || null,
          languageCode: tgUser.language_code || null,
          updatedAt: new Date(),
        })
        .where(eq(telegramCustomers.id, existingCustomer.id));
    } else {
      const inserted = await db
        .insert(telegramCustomers)
        .values({
          storeId: store.id,
          telegramUserId: tgUser.id.toString(),
          firstName: tgUser.first_name || "Cliente",
          lastName: tgUser.last_name || null,
          username: tgUser.username || null,
          photoUrl: tgUser.photo_url || null,
          languageCode: tgUser.language_code || null,
        })
        .returning({ id: telegramCustomers.id });

      customerId = inserted[0].id;
    }

    // 5. Gerar token JWT assinado contendo a sessão exclusiva do bot autenticado
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "fallback_secret_webgran_session");

    const effectiveBotId = validatedBotId || store.bots[0]?.id;
    const effectiveBotUsername = validatedBotUsername || store.bots[0]?.username || null;

    const token = await new SignJWT({
      customerId,
      storeId: store.id,
      telegramId: tgUser.id.toString(),
      originBotId: effectiveBotId,
      originBotUsername: effectiveBotUsername,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      token,
      bot: {
        id: effectiveBotId,
        username: effectiveBotUsername,
      },
      user: {
        id: tgUser.id,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      },
    });

    response.cookies.set("tg_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return response;
  } catch (error: any) {
    console.error("[telegram/auth] Erro no processamento de autenticação:", error?.message);
    return NextResponse.json({ error: "Erro interno no servidor ao autenticar sessão" }, { status: 500 });
  }
}
