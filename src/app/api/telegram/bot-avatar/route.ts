import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const botId = searchParams.get("botId");

    let bot;
    if (botId) {
      bot = await db.query.telegramBots.findFirst({
        where: eq(telegramBots.id, botId)
      });
    } else {
      const store = await getCurrentStore().catch(() => null);
      if (store) {
        bot = await db.query.telegramBots.findFirst({
          where: eq(telegramBots.storeId, store.id)
        });
      }
    }

    if (!bot) {
      return new NextResponse("Bot não encontrado", { status: 404 });
    }

    const token = decrypt(bot.tokenEncrypted);
    const botService = new TelegramBotService(token);

    // Re-resolve profile photo from Telegram API dynamically
    const photoUrl = await botService.getProfilePhotoUrl();

    if (!photoUrl) {
      return new NextResponse("Foto do bot indisponível", { status: 404 });
    }

    // Proxy the image request so frontend never touches Telegram bot token or CORS issues
    const res = await fetch(photoUrl);
    if (!res.ok) {
      return new NextResponse("Erro ao carregar imagem do Telegram", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(imageBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("[BOT AVATAR PROXY ERROR]:", error);
    return new NextResponse("Erro interno ao obter avatar do bot", { status: 500 });
  }
}
