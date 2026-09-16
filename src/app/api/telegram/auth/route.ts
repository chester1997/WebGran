import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
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
      resolved = await StoreResolver.resolveFromSlug(storeSlug);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }

    const { store, token: botToken } = resolved;

    // 3. Validar a assinatura do initData com o token do bot daquela loja
    const isValid = validateInitData(initData, botToken);
    
    if (!isValid) {
      return NextResponse.json({ error: "Assinatura inválida. Acesso negado." }, { status: 401 });
    }

    // 4. Extrair os dados do usuário do initData
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get("user");
    if (!userStr) {
      return NextResponse.json({ error: "Dados de usuário não encontrados no initData" }, { status: 400 });
    }

    const tgUser = JSON.parse(decodeURIComponent(userStr));

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

    // Retorna Token para o client armazenar e enviar nos Headers em futuras requisições API
    return NextResponse.json({ 
      success: true, 
      token, 
      user: tgUser 
    });

  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
