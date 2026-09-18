import { NextRequest, NextResponse } from "next/server";
import { StoreResolver } from "@/lib/telegram/resolver";
import { TelegramBotService } from "@/lib/telegram/bot";

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true, status: "Telegram Webhook Active" });
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const botIdParam = url.searchParams.get("botId");
    const secretTokenHeader = req.headers.get("x-telegram-bot-api-secret-token");

    let resolved;
    if (secretTokenHeader) {
      try {
        resolved = await StoreResolver.resolveFromSecretToken(secretTokenHeader);
      } catch (err) {
        console.warn("[TELEGRAM WEBHOOK] Could not resolve store from secret_token header, checking botId param...");
      }
    }

    if (!resolved && botIdParam) {
      resolved = await StoreResolver.resolveFromBotId(botIdParam);
    }

    if (!resolved) {
      console.error("[TELEGRAM WEBHOOK] Unrecognized request: missing valid secret_token header or botId parameter");
      return NextResponse.json({ ok: true }); // Always return 200 to prevent retries
    }

    const { store, token } = resolved;
    const update = await req.json();

    if (update.message && update.message.text) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;

      if (text.toLowerCase().startsWith("/start")) {
        const botService = new TelegramBotService(token);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;
        
        // Customer name formatting
        const customerFirstName = update.message.from?.first_name || "Cliente";

        // Custom welcome message or default
        let welcomeText = store.welcomeMessage;
        if (!welcomeText || welcomeText.trim() === "") {
          welcomeText = `Olá {nome}! Bem-vindo(a) à ${store.name}.\n\n${store.description ? store.description + '\n\n' : ''}Clique no botão abaixo para abrir nossa loja e conferir os produtos!`;
        }

        // Replace dynamic tag {nome} or {name}
        welcomeText = welcomeText
          .replace(/\{nome\}/gi, customerFirstName)
          .replace(/\{name\}/gi, customerFirstName);

        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "Abrir Loja",
                web_app: {
                  url: miniAppUrl
                }
              }
            ]
          ]
        };

        const banners = (store.welcomeBanners as string[]) || [];
        const primaryBanner = banners.find(b => b && b.trim() !== "");

        if (primaryBanner) {
          try {
            await botService.sendPhoto(chatId, primaryBanner, welcomeText, inlineKeyboard);
          } catch (photoErr) {
            console.error("Failed to send welcome photo, sending text message:", photoErr);
            await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
          }
        } else {
          try {
            await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
          } catch (msgErr) {
            console.error("Failed to send welcome message:", msgErr);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram to prevent retries on our internal errors
  }
}
