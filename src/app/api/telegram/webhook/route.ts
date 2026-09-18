import { NextRequest, NextResponse } from "next/server";
import { StoreResolver } from "@/lib/telegram/resolver";
import { TelegramBotService } from "@/lib/telegram/bot";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const botId = url.searchParams.get("botId");

    if (!botId) {
      return NextResponse.json({ error: "botId missing" }, { status: 400 });
    }

    // Resolve store and bot using the new Resolver
    const { store, token } = await StoreResolver.resolveFromBotId(botId);
    
    // Parse the Telegram Update object
    const update = await req.json();

    if (update.message && update.message.text) {
      const text = update.message.text;
      const chatId = update.message.chat.id;

      if (text.startsWith("/start")) {
        const botService = new TelegramBotService(token);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;
        
        // Customer name formatting
        const customerFirstName = update.message.from?.first_name || "Cliente";

        // Custom welcome message or default
        let welcomeText = store.welcomeMessage;
        if (!welcomeText || welcomeText.trim() === "") {
          welcomeText = `Olá {nome}! Bem-vindo(a) à *${store.name}*.\n\n${store.description ? store.description + '\n\n' : ''}Clique no botão abaixo para abrir nossa loja e conferir os produtos!`;
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
            await botService.sendPhoto(chatId, primaryBanner, welcomeText, inlineKeyboard, "HTML");
          } catch (photoErr) {
            console.error("Failed to send welcome photo with HTML, trying plain text/Markdown:", photoErr);
            try {
              await botService.sendPhoto(chatId, primaryBanner, welcomeText, inlineKeyboard, "Markdown");
            } catch (err2) {
              await botService.sendMessage(chatId, welcomeText, inlineKeyboard, "Markdown");
            }
          }
        } else {
          try {
            await botService.sendMessage(chatId, welcomeText, inlineKeyboard, "HTML");
          } catch (msgErr) {
            console.error("Failed to send welcome message with HTML, trying Markdown:", msgErr);
            await botService.sendMessage(chatId, welcomeText, inlineKeyboard, "Markdown");
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
