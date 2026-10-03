import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession } from "@/lib/telegram/session";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { db } from "@/db";
import { stores, telegramCustomers, telegramBots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateInitData } from "@/lib/telegram/validation";

async function resolveSession(req: NextRequest) {
  // 1. Try JWT cookie session
  let session = await getMiniAppSession();
  if (session?.customerId && session?.storeId) {
    return session;
  }

  // 2. Fallback: Parse initData from header or query param
  const initData = req.headers.get("x-telegram-init-data") || req.nextUrl.searchParams.get("initData");
  const storeSlug = req.headers.get("x-store-slug") || req.nextUrl.searchParams.get("storeSlug");

  if (!initData || !storeSlug) {
    return null;
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug),
    with: { bots: true },
  });

  if (!store || !store.bots?.length) return null;

  // Validate initData
  let isValid = false;
  for (const bot of store.bots) {
    const token = require("@/lib/encryption").decrypt(bot.tokenEncrypted);
    if (validateInitData(initData, token)) {
      isValid = true;
      break;
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  if (!isValid && !isDev) return null;

  const urlParams = new URLSearchParams(initData);
  const userStr = urlParams.get("user");
  let tgUser;
  if (userStr) {
    tgUser = JSON.parse(decodeURIComponent(userStr));
  } else if (isDev) {
    tgUser = { id: 123456789 };
  } else {
    return null;
  }

  const customer = await db.query.telegramCustomers.findFirst({
    where: and(
      eq(telegramCustomers.storeId, store.id),
      eq(telegramCustomers.telegramUserId, String(tgUser.id))
    ),
  });

  if (!customer) return null;

  return {
    customerId: customer.id,
    storeId: store.id,
    telegramId: String(tgUser.id),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveSession(req);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida ou não autenticada no Telegram." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.videoId;

    const playbackData = await ProductVideoService.getProductVideoForPlayback(
      session.storeId,
      session.customerId,
      videoId
    );

    return NextResponse.json({
      success: true,
      ...playbackData,
    });
  } catch (error: any) {
    console.error("[MiniApp Playback Error]:", error);
    const status = error.message?.includes("não possui acesso") || error.message?.includes("expirou") ? 403 : 400;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao solicitar reprodução." },
      { status }
    );
  }
}
