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

    // Prevent duplicate processing of the same update during retries
    const { isDuplicateTelegramUpdate } = await import("@/lib/telegram/update-dedup");
    if (update.update_id && isDuplicateTelegramUpdate(update.update_id)) {
      console.log(`[TELEGRAM WEBHOOK] Skipping duplicate update_id=${update.update_id}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (update.my_chat_member) {
      try {
        const { handleMyChatMemberUpdate } = await import("@/lib/telegram/chat-sync");
        await handleMyChatMemberUpdate(resolved.bot, update);
      } catch (chatSyncErr) {
        console.error("[TELEGRAM WEBHOOK] Error processing my_chat_member:", chatSyncErr);
      }
    }

    if (update.callback_query) {
      const cbData = update.callback_query.data || "";
      const cbId = update.callback_query.id;
      const chatId = update.callback_query.message?.chat?.id;

      if (cbData.startsWith("check_pay:")) {
        const orderId = cbData.replace("check_pay:", "").trim();
        const botService = new TelegramBotService(token);

        const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
        const syncRes = await syncOrderWithMercadoPago(orderId);

        if (syncRes.status === 'paid') {
          await botService.answerCallbackQuery(cbId, "🎉 Pagamento confirmado!");

          // Re-trigger AccessDeliveryService to ensure delivery and confirmation message are processed
          const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");
          await AccessDeliveryService.processOrderDelivery(orderId);
        } else {
          await botService.answerCallbackQuery(
            cbId,
            "⏳ PAGAMENTO AINDA NÃO IDENTIFICADO\n\nAguarde alguns instantes e tente novamente.",
            true
          );
          if (chatId) {
            await botService.sendMessage(
              chatId,
              "⏳ *PAGAMENTO AINDA NÃO IDENTIFICADO*\n\nAguarde alguns instantes e tente novamente.",
              undefined,
              "Markdown"
            );
          }
        }
      } else if (cbData.startsWith("cart_") || cbData.startsWith("combo_") || cbData.startsWith("prog_")) {
        const fromUser = update.callback_query.from;
        if (fromUser && fromUser.id) {
          const botService = new TelegramBotService(token);
          let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
          if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
          if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
            rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
          }
          const appUrl = rawAppUrl.replace(/\/+$/, "");
          const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

          const { handleCartCallbackQuery } = await import("@/lib/telegram/bot-cart-handler");
          const messageId = update.callback_query.message?.message_id;

          await handleCartCallbackQuery(
            { store, botService, miniAppUrl },
            cbId,
            chatId,
            messageId,
            cbData,
            fromUser
          );
          return NextResponse.json({ ok: true });
        }
      } else {
        const botService = new TelegramBotService(token);
        await botService.answerCallbackQuery(cbId);
      }
    }

    if (update.message && (update.message.text || update.message.caption)) {
      const text = (update.message.text || update.message.caption || "").trim();
      const chatId = update.message.chat.id;

      const botService = new TelegramBotService(token);
      let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
      if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
        rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
      }
      const appUrl = rawAppUrl.replace(/\/+$/, "");
      const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

      // Check /carrinho command
      const cleanCmd = text.toLowerCase();
      if (
        cleanCmd === "/carrinho" ||
        cleanCmd.startsWith("/carrinho ") ||
        cleanCmd === "/cart" ||
        cleanCmd === "/cesta" ||
        cleanCmd === "/sacola"
      ) {
        const fromUser = update.message.from || { id: chatId };
        const { handleCartCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleCartCommand({ store, botService, miniAppUrl }, chatId, fromUser);
        return NextResponse.json({ ok: true });
      }

      // Check /produtos or /catalogo command
      if (
        cleanCmd === "/produtos" ||
        cleanCmd.startsWith("/produtos ") ||
        cleanCmd === "/catalogo" ||
        cleanCmd === "/loja" ||
        cleanCmd === "/shop"
      ) {
        const { handleCatalogCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleCatalogCommand({ store, botService, miniAppUrl }, chatId);
        return NextResponse.json({ ok: true });
      }

      // Check /combos command
      if (
        cleanCmd === "/combos" ||
        cleanCmd.startsWith("/combos ") ||
        cleanCmd === "/pacotes" ||
        cleanCmd === "/kits"
      ) {
        const { handleCombosCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleCombosCommand({ store, botService, miniAppUrl }, chatId);
        return NextResponse.json({ ok: true });
      }

      // Check /ofertas or /promocao command
      if (
        cleanCmd === "/ofertas" ||
        cleanCmd.startsWith("/ofertas ") ||
        cleanCmd === "/promocao" ||
        cleanCmd.startsWith("/promocao ") ||
        cleanCmd === "/promocoes" ||
        cleanCmd === "/progressiva" ||
        cleanCmd === "/desconto"
      ) {
        const { handleProgressiveOffersCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleProgressiveOffersCommand({ store, botService, miniAppUrl }, chatId);
        return NextResponse.json({ ok: true });
      }
      
      const isStartCommand = text.startsWith("/start");
      if (isStartCommand && update.update_id) {
        try {
          const { BotStartEventService } = await import("@/lib/analytics/bot-start-service");
          const payloadMatch = text.replace(/^\/start/i, "").trim();
          await BotStartEventService.recordStartEvent({
            storeId: store.id,
            botId: resolved.bot?.id,
            telegramUserId: update.message.from?.id || chatId,
            telegramUsername: update.message.from?.username || null,
            telegramFirstName: update.message.from?.first_name || null,
            telegramLastName: update.message.from?.last_name || null,
            telegramUpdateId: update.update_id,
            startPayload: payloadMatch || null,
            metadata: {
              chatId,
              chatType: update.message.chat?.type,
              messageDate: update.message.date,
            },
          });
        } catch (startErr: any) {
          console.error("[TELEGRAM WEBHOOK] Error recording start event:", startErr?.message);
        }
      }

      // Check if message is a video trigger deep link (/start v_...)
      const startParam = text.replace(/^\/start\s*/i, "").trim();
      if (startParam.startsWith("v_")) {
        try {
          const { VideoTriggerService } = await import("@/lib/videos/video-trigger-service");
          const resolvedTrigger = await VideoTriggerService.resolveTriggerToken(startParam);
          
          if (resolvedTrigger.video) {
            const videoPlayerUrl = `${miniAppUrl}/video/${resolvedTrigger.video.id}?token=${startParam}`;
            const videoTitle = resolvedTrigger.video.title;
            
            const videoMessageText = `🎬 *${videoTitle}*\n\nClique no botão abaixo para assistir ao vídeo diretamente no Mini App:`;
            const videoKeyboard = {
              inline_keyboard: [
                [
                  {
                    text: "🎬 Assistir ao Vídeo",
                    web_app: {
                      url: videoPlayerUrl
                    }
                  }
                ]
              ]
            };

            await botService.sendMessage(chatId, videoMessageText, videoKeyboard, "Markdown");
            return NextResponse.json({ ok: true });
          }
        } catch (triggerErr: any) {
          console.warn("[TELEGRAM WEBHOOK] Video trigger error:", triggerErr.message);
          await botService.sendMessage(
            chatId,
            `⚠️ ${triggerErr.message || "Link de vídeo indisponível."}`
          );
          return NextResponse.json({ ok: true });
        }
      }

      // Customer name formatting
      const customerFirstName = update.message.from?.first_name || "Cliente";

      const { hasFeature } = await import("@/lib/entitlements/entitlement-service");
      const welcomeAllowed = store.ownerId ? await hasFeature(store.ownerId, "welcome_bot_message_enabled") : true;

      // Custom welcome message or default
      let welcomeText = welcomeAllowed ? store.welcomeMessage : null;
      if (!welcomeText || welcomeText.trim() === "") {
        welcomeText = `Olá {nome}! Bem-vindo(a) à ${store.name}.\n\n${store.description ? store.description + '\n\n' : ''}Clique no botão abaixo para abrir nossa loja e conferir os produtos!`;
      }

      // Replace dynamic tag {nome} or {name}
      welcomeText = welcomeText
        .replace(/\{nome\}/gi, customerFirstName)
        .replace(/\{name\}/gi, customerFirstName);

      const buttonLabel = resolved.bot?.buttonText || "Abrir App";

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: buttonLabel,
              web_app: {
                url: miniAppUrl
              }
            }
          ],
          [
            {
              text: "🛒 Ver Carrinho",
              callback_data: "cart_view",
            },
            {
              text: "🔥 Ofertas",
              callback_data: "prog_view",
            },
            {
              text: "📦 Ver Produtos",
              callback_data: "cart_cat",
            },
          ],
        ]
      };

      const banners = welcomeAllowed ? ((store.welcomeBanners as string[]) || []) : [];
      let primaryBanner = banners.find(b => b && typeof b === "string" && b.trim() !== "");

      if (primaryBanner) {
        primaryBanner = primaryBanner.trim();
        console.log(`[TELEGRAM WEBHOOK] Attempting to send welcome photo to chatId=${chatId} using photo URL: ${primaryBanner}`);
        try {
          const photoResult = await botService.sendPhoto(chatId, primaryBanner, welcomeText, inlineKeyboard);
          console.log(`[TELEGRAM WEBHOOK] Welcome photo sent successfully to chatId=${chatId}. Result:`, photoResult);
        } catch (photoErr: any) {
          console.error(`[TELEGRAM WEBHOOK] Failed to send welcome photo (URL: ${primaryBanner}). Error:`, photoErr?.message || photoErr);
          console.log(`[TELEGRAM WEBHOOK] Falling back to text-only welcome message for chatId=${chatId}`);
          await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
        }
      } else {
        console.log(`[TELEGRAM WEBHOOK] No welcome banner configured. Sending text-only welcome message to chatId=${chatId}`);
        try {
          await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
        } catch (msgErr: any) {
          console.error(`[TELEGRAM WEBHOOK] Failed to send text welcome message to chatId=${chatId}:`, msgErr?.message || msgErr);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram to prevent retries on our internal errors
  }
}
