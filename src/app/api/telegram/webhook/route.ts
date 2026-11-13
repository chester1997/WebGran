import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { StoreResolver } from "@/lib/telegram/resolver";
import { TelegramBotService } from "@/lib/telegram/bot";

/**
 * Comparação segura em tempo constante contra timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true, status: "Telegram Webhook Active" });
}

export async function POST(req: NextRequest) {
  let resolved: any = null;
  let update: any = null;
  let executionId: string | null = null;
  let updateCheckpoint: ((step: string, lastError?: string) => Promise<void>) | null = null;
  let markCompleted: (() => Promise<void>) | null = null;
  let markFailed: ((error: string, ambiguous?: boolean) => Promise<void>) | null = null;

  try {
    const url = new URL(req.url);
    const botIdParam = url.searchParams.get("botId");
    const secretTokenHeader = req.headers.get("x-telegram-bot-api-secret-token") || "";

    // 1. Validar se há botIdParam e carregar o bot candidato para checagem estrita de credenciais
    let botCandidate: any = null;
    if (botIdParam) {
      const { db } = await import("@/db");
      const { telegramBots } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      botCandidate = await db.query.telegramBots.findFirst({
        where: eq(telegramBots.botId, botIdParam),
        with: { store: true },
      });

      if (!botCandidate) {
        console.warn("[TELEGRAM WEBHOOK] Rejeitado: botIdParam fornecido não encontrado.");
        return NextResponse.json({ error: "NotFound: Bot not found" }, { status: 404 });
      }
    }

    // 2. Fluxo de autenticação e validação de identidade
    if (botCandidate) {
      // O bot possui secretToken cadastrado no banco?
      const hasSecretConfigured = Boolean(botCandidate.secretToken && botCandidate.secretToken.trim() !== "");

      if (hasSecretConfigured) {
        // Exigir estritamente o header X-Telegram-Bot-Api-Secret-Token
        if (!secretTokenHeader) {
          console.warn(`[TELEGRAM WEBHOOK] Rejeitado: botId=${botCandidate.botId} exige X-Telegram-Bot-Api-Secret-Token`);
          return NextResponse.json(
            { error: "Forbidden: X-Telegram-Bot-Api-Secret-Token is required for this bot" },
            { status: 403 }
          );
        }

        // Comparação segura em tempo constante
        if (!safeCompare(secretTokenHeader, botCandidate.secretToken)) {
          console.warn("[TELEGRAM WEBHOOK] Rejeitado: secretToken inválido para o bot solicitado.");
          return NextResponse.json(
            { error: "Forbidden: Invalid secret token" },
            { status: 403 }
          );
        }

        const { decrypt } = await import("@/lib/encryption");
        resolved = {
          bot: botCandidate,
          store: botCandidate.store,
          token: decrypt(botCandidate.tokenEncrypted),
        };
      } else {
        // Bot legado sem secretToken configurado
        if (secretTokenHeader) {
          console.warn("[TELEGRAM WEBHOOK] Rejeitado: header enviado para bot sem secretToken configurado.");
          return NextResponse.json(
            { error: "Forbidden: Bot does not have a secret token configured" },
            { status: 403 }
          );
        }

        const { decrypt } = await import("@/lib/encryption");
        resolved = {
          bot: botCandidate,
          store: botCandidate.store,
          token: decrypt(botCandidate.tokenEncrypted),
        };
      }
    } else if (secretTokenHeader) {
      // Sem botIdParam na URL: autenticação puramente via secretTokenHeader
      try {
        const found = await StoreResolver.resolveFromSecretToken(secretTokenHeader);
        if (found?.bot?.secretToken && !safeCompare(secretTokenHeader, found.bot.secretToken)) {
          return NextResponse.json({ error: "Unauthorized: Invalid secret token" }, { status: 401 });
        }
        resolved = found;
      } catch {
        return NextResponse.json({ error: "Unauthorized: Invalid secret token" }, { status: 401 });
      }
    }

    if (!resolved) {
      console.warn("[TELEGRAM WEBHOOK] Requisição não autorizada: secret inválido ou bot não registrado.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { store, token, bot } = resolved;
    update = await req.json();

    // Mecanismo de segurança para homologação inbound isolada
    if (update?._isHomologationTest) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Forbidden: Homologation mode disabled in production" }, { status: 403 });
      }
      const fromId = String(update.message?.from?.id || update.message?.chat?.id || "");
      const authorizedChatId = process.env.AUTHORIZED_TEST_CHAT_ID || "1795655200";
      if (fromId !== authorizedChatId) {
        return NextResponse.json(
          { error: `Forbidden: Inbound homologation allowed only for authorized owner Chat ID (${authorizedChatId.slice(0, 4)}***)` },
          { status: 403 }
        );
      }
    }

    // =========================================================================
    // CONTROLE DE EXECUÇÃO POR LEASE, DEDUPLICAÇÃO E CHECKPOINTS NO NEON
    // =========================================================================
    if (update && update.update_id) {
      const updateIdStr = String(update.update_id);
      const botIdStr = resolved.bot.id;
      const currentExecId = crypto.randomUUID();

      try {
        const { db } = await import("@/db");
        const { telegramWebhookUpdates } = await import("@/db/schema");
        const { sql, eq, and } = await import("drizzle-orm");

        // 1. Reserva atômica inicial no PostgreSQL via INSERT ... ON CONFLICT DO NOTHING
        const reservation = await db.execute(sql`
          INSERT INTO telegram_webhook_updates (
            bot_id, update_id, status, execution_id, step, started_at, lease_expires_at, created_at, updated_at
          ) VALUES (
            ${botIdStr}, ${updateIdStr}, 'processing', ${currentExecId}, 'reserved', NOW(), NOW() + interval '30 seconds', NOW(), NOW()
          )
          ON CONFLICT (bot_id, update_id) DO NOTHING
          RETURNING id, execution_id, status, step
        `);

        const rows = Array.isArray(reservation) ? reservation : (reservation as any)?.rows || [];

        if (rows.length > 0) {
          // Lease inicial obtida com sucesso
          executionId = currentExecId;
        } else {
          // Conflito de unicidade: update_id já registrado. Inspecionar status da lease e checkpoints
          const existing = await db.query.telegramWebhookUpdates.findFirst({
            where: and(
              eq(telegramWebhookUpdates.botId, botIdStr),
              eq(telegramWebhookUpdates.updateId, updateIdStr)
            )
          });

          if (existing) {
            // Se já foi concluído anteriormente ('completed'), descartar imediatamente sem reprocessar comandos
            if (existing.status === 'completed') {
              console.log(`[TELEGRAM WEBHOOK] Update ${updateIdStr} já concluído anteriormente. Descartando duplicate.`);
              return NextResponse.json({ ok: true, duplicate: true });
            }

            // Se falhou com ambiguidade de efeito externo, NUNCA repetir automaticamente
            if (existing.step === 'ambiguous_external_failure') {
              console.warn(`[TELEGRAM WEBHOOK] Update ${updateIdStr} em estado ambíguo anterior. Bloqueando reexecução.`);
              return NextResponse.json({ ok: true, ambiguous: true });
            }

            // Verificar validade temporal da lease
            const now = new Date();
            const leaseExpires = existing.leaseExpiresAt ? new Date(existing.leaseExpiresAt) : new Date(0);

            if (existing.status === 'processing' && leaseExpires > now) {
              console.log(`[TELEGRAM WEBHOOK] Update ${updateIdStr} com lease ativa em outro worker até ${leaseExpires.toISOString()}.`);
              return NextResponse.json({ ok: true, in_progress: true });
            }

            // A lease expirou (worker anterior abandonou a execução).
            // Recuperação atômica por concorrência otimista (apenas 1 worker adquire a nova lease)
            console.warn(`[TELEGRAM WEBHOOK] Lease expirada para update ${updateIdStr}. Tentando aquisição condicional...`);
            const recovered = await db.execute(sql`
              UPDATE telegram_webhook_updates
              SET
                execution_id = ${currentExecId},
                status = 'processing',
                step = 'reserved',
                lease_expires_at = NOW() + interval '30 seconds',
                updated_at = NOW()
              WHERE bot_id = ${botIdStr}
                AND update_id = ${updateIdStr}
                AND status != 'completed'
                AND step != 'ambiguous_external_failure'
                AND lease_expires_at <= NOW()
              RETURNING id, execution_id, status, step
            `);

            const recRows = Array.isArray(recovered) ? recovered : (recovered as any)?.rows || [];
            if (recRows.length > 0) {
              executionId = currentExecId;
              console.log(`[TELEGRAM WEBHOOK] Lease recuperada com sucesso para update ${updateIdStr} (execId: ${executionId}).`);
            } else {
              console.warn(`[TELEGRAM WEBHOOK] Conflito transitório ao recuperar lease de update ${updateIdStr}.`);
              return NextResponse.json({ error: "Transient conflict acquiring update lease" }, { status: 503 });
            }
          }
        }

        // Configurar helpers de checkpoints e finalização atômica vinculados ao executionId atual
        if (executionId) {
          const boundExecId = executionId;
          updateCheckpoint = async (step: string, lastError?: string) => {
            try {
              await db.execute(sql`
                UPDATE telegram_webhook_updates
                SET step = ${step},
                    last_error = ${lastError || null},
                    updated_at = NOW()
                WHERE bot_id = ${botIdStr}
                  AND update_id = ${updateIdStr}
                  AND execution_id = ${boundExecId}
              `);
            } catch (cpErr) {
              console.error(`[TELEGRAM WEBHOOK] Erro ao registrar checkpoint '${step}':`, cpErr);
            }
          };

          markCompleted = async () => {
            try {
              await db.execute(sql`
                UPDATE telegram_webhook_updates
                SET status = 'completed',
                    step = 'completed',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE bot_id = ${botIdStr}
                  AND update_id = ${updateIdStr}
                  AND execution_id = ${boundExecId}
              `);
            } catch (compErr) {
              console.error("[TELEGRAM WEBHOOK] Erro ao marcar como completed:", compErr);
            }
          };

          markFailed = async (errMsg: string, ambiguous = false) => {
            try {
              await db.execute(sql`
                UPDATE telegram_webhook_updates
                SET status = 'failed',
                    step = ${ambiguous ? 'ambiguous_external_failure' : 'failed'},
                    last_error = ${errMsg},
                    updated_at = NOW()
                WHERE bot_id = ${botIdStr}
                  AND update_id = ${updateIdStr}
                  AND execution_id = ${boundExecId}
              `);
            } catch (failErr) {
              console.error("[TELEGRAM WEBHOOK] Erro ao marcar como failed:", failErr);
            }
          };
        }
      } catch (dedupErr) {
        console.error("[TELEGRAM WEBHOOK] Erro ao gerenciar lease de update_id:", dedupErr);
      }
    }

    // Cache rápido em memória como primeira camada adicional
    const { isDuplicateTelegramUpdate } = await import("@/lib/telegram/update-dedup");
    if (update && update.update_id && isDuplicateTelegramUpdate(update.update_id)) {
      console.log(`[TELEGRAM WEBHOOK] Skipping duplicate update_id=${update.update_id} via memory cache`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Helper unificado de resposta com confirmação de conclusão da lease
    const respondOk = async () => {
      if (markCompleted) await markCompleted();
      return NextResponse.json({ ok: true });
    };

    if (update.my_chat_member) {
      try {
        if (updateCheckpoint) await updateCheckpoint('command_started');
        const { handleMyChatMemberUpdate } = await import("@/lib/telegram/chat-sync");
        await handleMyChatMemberUpdate(resolved.bot, update);
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
      } catch (chatSyncErr: any) {
        console.error("[TELEGRAM WEBHOOK] Error processing my_chat_member:", chatSyncErr);
        if (markFailed) await markFailed(chatSyncErr?.message || "chat-sync error", true);
      }
    }

    if (update.callback_query) {
      const cbData = update.callback_query.data || "";
      const cbId = update.callback_query.id;
      const chatId = update.callback_query.message?.chat?.id;

      if (cbData.startsWith("check_pay:") || cbData.startsWith("order_check:")) {
        const orderId = cbData.replace(/^(check_pay:|order_check:)/, "").trim();
        const botService = new TelegramBotService(token);

        const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
        const syncRes = await syncOrderWithMercadoPago(orderId);

        if (syncRes.status === 'paid') {
          await botService.answerCallbackQuery(cbId, "🎉 Pagamento confirmado!");

          // Re-trigger AccessDeliveryService to ensure delivery and confirmation message are processed
          const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");
          await AccessDeliveryService.processOrderDelivery(orderId);

          const paidMsg =
            `🎉 *Pagamento Confirmado!*\n\n` +
            `O pagamento do pedido *#${orderId.slice(0, 8)}* foi aprovado com sucesso e seus acessos foram liberados!\n\n` +
            `Toque no botão abaixo para acessar seus conteúdos:`;

          const paidKeyboard = {
            inline_keyboard: [
              [
                {
                  text: "🔐 Meus Acessos",
                  callback_data: "my_accesses",
                },
              ],
              [
                {
                  text: "🛍️ Explorar Catálogo",
                  callback_data: "cart_cat",
                },
                {
                  text: "↩️ Menu Inicial",
                  callback_data: "start_menu",
                },
              ],
            ],
          };

          const messageId = update.callback_query.message?.message_id;
          if (chatId && messageId) {
            try {
              await botService.editMessageText(chatId, messageId, paidMsg, paidKeyboard, "Markdown");
            } catch {
              await botService.sendMessage(chatId, paidMsg, paidKeyboard, "Markdown");
            }
          } else if (chatId) {
            await botService.sendMessage(chatId, paidMsg, paidKeyboard, "Markdown");
          }
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
      } else if (
        cbData.startsWith("cart_") ||
        cbData.startsWith("combo_") ||
        cbData.startsWith("prog_") ||
        cbData.startsWith("cat_") ||
        cbData.startsWith("prod_view:") ||
        cbData.startsWith("prod_toggle:") ||
        cbData.startsWith("trailer_play:") ||
        cbData === "my_accesses" ||
        cbData === "support_info" ||
        cbData === "start_menu"
      ) {
        const fromUser = update.callback_query.from;
        if (fromUser && fromUser.id) {
          const botService = new TelegramBotService(token);
          let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
          if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
          if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
            rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
          }
          const appUrl = rawAppUrl.replace(/\/+$/, "");
          const miniAppUrl = `${appUrl}/miniapp/${store.slug}${bot?.id ? `?b=${bot.id}` : ""}`;

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
          if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
          return respondOk();
        }
      } else {
        const botService = new TelegramBotService(token);
        await botService.answerCallbackQuery(cbId);
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
      }
    }

    // =========================================================================
    // PERSISTÊNCIA REAL DE MENSAGENS E SINCRONIZAÇÃO DE LEADS (CONVERSAS)
    // =========================================================================
    if (update.message) {
      if (updateCheckpoint) await updateCheckpoint('command_started');
      try {
        const { db } = await import("@/db");
        const { telegramCustomers, telegramMessages } = await import("@/db/schema");
        const { eq, and } = await import("drizzle-orm");

        const msg = update.message;
        const fromUser = msg.from;
        const chatId = String(msg.chat.id);
        const telegramUserId = fromUser ? String(fromUser.id) : chatId;
        const rawText = (msg.text || msg.caption || "").trim();
        const msgId = msg.message_id ? String(msg.message_id) : null;
        const updateId = update.update_id ? String(update.update_id) : null;

        let messageType = "text";
        if (rawText.startsWith("/")) messageType = "command";
        else if (msg.photo) messageType = "photo";
        else if (msg.video) messageType = "video";
        else if (msg.voice) messageType = "voice";
        else if (msg.document) messageType = "document";
        else if (msg.sticker) messageType = "sticker";

        // 1. Sincronização atômica do lead em telegramCustomers
        let customer = await db.query.telegramCustomers.findFirst({
          where: and(
            eq(telegramCustomers.storeId, store.id),
            eq(telegramCustomers.telegramUserId, telegramUserId)
          )
        });

        const now = new Date();
        if (customer) {
          await db.update(telegramCustomers).set({
            username: fromUser?.username || customer.username,
            firstName: fromUser?.first_name || customer.firstName,
            lastName: fromUser?.last_name || customer.lastName,
            languageCode: fromUser?.language_code || customer.languageCode,
            updatedAt: now,
          }).where(eq(telegramCustomers.id, customer.id));
        } else {
          const [insertedCustomer] = await db.insert(telegramCustomers).values({
            storeId: store.id,
            telegramUserId,
            username: fromUser?.username || null,
            firstName: fromUser?.first_name || null,
            lastName: fromUser?.last_name || null,
            languageCode: fromUser?.language_code || null,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [telegramCustomers.storeId, telegramCustomers.telegramUserId],
            set: {
              username: fromUser?.username || null,
              firstName: fromUser?.first_name || null,
              lastName: fromUser?.last_name || null,
              updatedAt: now,
            }
          }).returning();
          customer = insertedCustomer;
        }

        // Checkpoint: lead sincronizado no banco
        if (updateCheckpoint) await updateCheckpoint('lead_synced');

        // 2. Persistência da mensagem recebida com idempotência
        await db.insert(telegramMessages).values({
          storeId: store.id,
          botId: resolved.bot.id,
          customerId: customer?.id || null,
          telegramUserId,
          telegramChatId: chatId,
          telegramMessageId: msgId,
          telegramUpdateId: updateId,
          direction: "inbound",
          messageType,
          text: rawText || (msg.sticker ? "[Figurinha]" : msg.photo ? "[Foto]" : msg.video ? "[Vídeo]" : "[Mensagem]"),
          status: "delivered",
          metadata: {
            updateId: update.update_id,
            date: msg.date,
            chatType: msg.chat?.type,
            ...(update._isHomologationTest ? {
              isTest: true,
              testScope: "inbound_homologation",
              operatorUserId: store.ownerId || (store as any).userId,
            } : {})
          },
          createdAt: msg.date ? new Date(msg.date * 1000) : now,
        }).onConflictDoNothing();

        // Invalidação atômica de cache Next.js para atualizar painel e conversas
        try {
          const { revalidatePath } = await import("next/cache");
          revalidatePath(`/seller/bots/${resolved.bot.id}`);
          revalidatePath(`/seller/bots`);
        } catch {}
      } catch (persistErr: any) {
        console.error("[TELEGRAM WEBHOOK] Erro não-crítico ao persistir mensagem recebida:", persistErr?.message || persistErr);
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
      const miniAppUrl = `${appUrl}/miniapp/${store.slug}${bot?.id ? `?b=${bot.id}` : ""}`;

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
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
      }

      // Check /produtos or /catalogo command
      if (
        cleanCmd === "/produtos" ||
        cleanCmd.startsWith("/produtos ") ||
        cleanCmd === "/catalogo" ||
        cleanCmd === "/loja" ||
        cleanCmd === "/shop"
      ) {
        const fromUser = update.message.from || { id: chatId };
        const { handleCatalogCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleCatalogCommand({ store, botService, miniAppUrl }, chatId, fromUser);
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
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
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
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
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
      }

      // Check /acessos command
      if (
        cleanCmd === "/acessos" ||
        cleanCmd.startsWith("/acessos ") ||
        cleanCmd === "/meusacessos" ||
        cleanCmd === "/meus_acessos"
      ) {
        const fromUser = update.message.from || { id: chatId };
        const { handleAccessesCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleAccessesCommand({ store, botService, miniAppUrl }, chatId, fromUser);
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
      }

      // Check /suporte command
      if (
        cleanCmd === "/suporte" ||
        cleanCmd.startsWith("/suporte ") ||
        cleanCmd === "/ajuda" ||
        cleanCmd === "/support" ||
        cleanCmd === "/help"
      ) {
        const { handleSupportCommand } = await import("@/lib/telegram/bot-cart-handler");
        await handleSupportCommand({ store, botService, miniAppUrl }, chatId, store);
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
      }

      const isStartCommand = text.startsWith("/start");
      if (!isStartCommand) {
        // Mensagem de diálogo / conversação (já sincronizada em telegram_customers e persistida em telegram_messages acima).
        // Evita disparo de respostas automáticas repetitivas para mensagens de chat ou testes inbound.
        if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        return respondOk();
      }

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

      // Check if message is a sales notification linking deep link (/start notif_...)
      if (startParam.startsWith("notif_")) {
        try {
          const rawToken = startParam.replace(/^notif_/i, "").trim();
          const crypto = await import("crypto");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
          const now = new Date();

          const { db } = await import("@/db");
          const { botSaleNotificationTokens, botSaleNotificationRecipients, stores } = await import("@/db/schema");
          const { sql, eq } = await import("drizzle-orm");

          // Consumo estritamente atômico em única query com validação de loja, bot, expiração e status
          const updateResult = await db.execute(sql`
            UPDATE bot_sale_notification_tokens
            SET used_at = NOW()
            WHERE token_hash = ${tokenHash}
              AND bot_id = ${resolved.bot.id}
              AND store_id = ${store.id}
              AND used_at IS NULL
              AND expires_at > NOW()
            RETURNING id, store_id, bot_id
          `);

          let tokenRecord: { id: string; store_id: string; bot_id: string } | null = null;
          if (Array.isArray(updateResult) && updateResult.length > 0) {
            tokenRecord = updateResult[0] as any;
          } else if (Array.isArray((updateResult as any)?.rows) && (updateResult as any).rows.length > 0) {
            tokenRecord = (updateResult as any).rows[0];
          }

          if (tokenRecord) {
            // Extract display name from Telegram user
            const senderParts = [update.message.from?.first_name, update.message.from?.last_name].filter(Boolean);
            const displayName = senderParts.length > 0
              ? senderParts.join(" ")
              : (update.message.from?.username ? `@${update.message.from?.username}` : "Lojista");

            const recipientChatId = String(chatId);
            const storeId = tokenRecord.store_id || (tokenRecord as any).storeId;
            const botId = tokenRecord.bot_id || (tokenRecord as any).botId;

            // Register recipient for this bot
            await db
              .insert(botSaleNotificationRecipients)
              .values({
                storeId,
                botId,
                telegramChatId: recipientChatId,
                displayName,
                status: "active",
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [botSaleNotificationRecipients.botId, botSaleNotificationRecipients.telegramChatId],
                set: {
                  status: "active",
                  displayName,
                  updatedAt: now,
                },
              });

            // Also keep store.telegramNotificationId updated as backup if not present
            if (!store.telegramNotificationId) {
              await db
                .update(stores)
                .set({ telegramNotificationId: recipientChatId, updatedAt: now })
                .where(eq(stores.id, storeId));
            }

            await botService.sendMessage(
              chatId,
              "Pronto! Você vai receber um aviso aqui a cada venda deste bot ✅"
            );
            return NextResponse.json({ ok: true });
          } else {
            // Token expired, already used, invalid, or bot mismatch: neutral response
            await botService.sendMessage(
              chatId,
              "⚠️ Este link de ativação é inválido ou já expirou.\n\nAcesse o painel da sua loja e clique em 'Ativar avisos de venda' para gerar um novo link."
            );
            return NextResponse.json({ ok: true });
          }
        } catch (notifErr: any) {
          console.error("[TELEGRAM WEBHOOK] Error activating notification recipient:", notifErr?.message);
          await botService.sendMessage(
            chatId,
            "⚠️ Ocorreu um erro ao ativar os avisos de venda. Por favor, tente novamente no painel."
          );
          return NextResponse.json({ ok: true });
        }
      }

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
            if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
            return respondOk();
          }
        } catch (triggerErr: any) {
          console.warn("[TELEGRAM WEBHOOK] Video trigger error:", triggerErr.message);
          await botService.sendMessage(
            chatId,
            `⚠️ ${triggerErr.message || "Link de vídeo indisponível."}`
          );
          if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
          return respondOk();
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

      const { getInitialBotKeyboard } = await import("@/lib/telegram/bot-cart-handler");
      const inlineKeyboard = getInitialBotKeyboard(store, miniAppUrl);

      const banners = welcomeAllowed ? ((store.welcomeBanners as string[]) || []) : [];
      let primaryBanner = banners.find(b => b && typeof b === "string" && b.trim() !== "");

      if (primaryBanner) {
        primaryBanner = primaryBanner.trim();
        console.log(`[TELEGRAM WEBHOOK] Attempting to send welcome photo to chatId=${chatId} using photo URL: ${primaryBanner}`);
        try {
          const photoResult = await botService.sendPhoto(chatId, primaryBanner, welcomeText, inlineKeyboard);
          console.log(`[TELEGRAM WEBHOOK] Welcome photo sent successfully to chatId=${chatId}. Result:`, photoResult);
          if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        } catch (photoErr: any) {
          console.error(`[TELEGRAM WEBHOOK] Failed to send welcome photo (URL: ${primaryBanner}). Error:`, photoErr?.message || photoErr);
          console.log(`[TELEGRAM WEBHOOK] Falling back to text-only welcome message for chatId=${chatId}`);
          await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
          if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        }
      } else {
        console.log(`[TELEGRAM WEBHOOK] No welcome banner configured. Sending text-only welcome message to chatId=${chatId}`);
        try {
          await botService.sendMessage(chatId, welcomeText, inlineKeyboard);
          if (updateCheckpoint) await updateCheckpoint('effects_confirmed');
        } catch (msgErr: any) {
          console.error(`[TELEGRAM WEBHOOK] Failed to send text welcome message to chatId=${chatId}:`, msgErr?.message || msgErr);
          if (markFailed) await markFailed(msgErr?.message || "Welcome message failed", true);
        }
      }
    }

    return respondOk();
  } catch (error: any) {
    console.error("Webhook error:", error);
    if (markFailed) {
      await markFailed(error?.message || "Webhook runtime error", true);
    }
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram to prevent retries on our internal errors
  }
}
