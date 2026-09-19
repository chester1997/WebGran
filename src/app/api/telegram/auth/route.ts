import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramCustomers, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateInitData } from "@/lib/telegram/validation";
import { SignJWT } from "jose";
import { StoreResolver } from "@/lib/telegram/resolver";

export async function POST(req: NextRequest) {
  try {
    const { initData, storeSlug } = await req.json();

    if (!initData || !storeSlug) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    let resolved;
    try {
      const store = await db.query.stores.findFirst({
        where: eq(stores.slug, storeSlug),
        with: { bots: true }
      });
      if (!store || !store.bots || store.bots.length === 0) {
        return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
      }
      
      resolved = { store, bots: store.bots };
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }

    const { store, bots } = resolved;

    // 3. Validar a assinatura do initData com o token do bot daquela loja
    // Tenta validar contra os tokens de todos os bots associados à loja
    let isValid = false;
    for (const bot of bots) {
      const token = require('@/lib/encryption').decrypt(bot.tokenEncrypted);
      if (validateInitData(initData, token)) {
        isValid = true;
        break;
      }
    }
    
    // IF DEV MODE, allow bypass for testing outside Telegram
    const isDev = process.env.NODE_ENV === "development" || !initData;
    if (!isValid && !isDev) {
      return NextResponse.json({ error: "Assinatura inválida. Acesso negado." }, { status: 401 });
    }

    // 4. Extrair os dados do usuǭrio do initData
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get("user");
    
    // Mock user for external testing if needed
    let tgUser;
    if (!userStr) {
      if (isDev) {
        tgUser = { id: 123456789, first_name: "Visitante", last_name: "Web" };
      } else {
        return NextResponse.json({ error: "Dados de usuário não encontrados no initData" }, { status: 400 });
      }
    } else {
      tgUser = JSON.parse(decodeURIComponent(userStr));
    }

    // 5. Upsert TelegramCustomer
    const existingCustomer = await db.query.telegramCustomers.findFirst({
      where: (tc, { eq, and }) => and(
        eq(tc.storeId, store.id),
        eq(tc.telegramUserId, tgUser.id.toString())
      )
    });

    let customerId;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      await db.update(telegramCustomers).set({
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        languageCode: tgUser.language_code || null,
        updatedAt: new Date()
      }).where(eq(telegramCustomers.id, existingCustomer.id));
    } else {
      const inserted = await db.insert(telegramCustomers).values({
        storeId: store.id,
        telegramUserId: tgUser.id.toString(),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        languageCode: tgUser.language_code || null
      }).returning({ id: telegramCustomers.id });
      
      customerId = inserted[0].id;
    }

    // 6. Gerar um token JWT de Sessão Cliente utilizando JOSE
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "fallback_secret");
    
    const token = await new SignJWT({ 
      customerId, 
      storeId: store.id, 
      telegramId: tgUser.id.toString() 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({ 
      success: true, 
      token, 
      user: tgUser 
    });

    response.cookies.set("tg_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;

  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
