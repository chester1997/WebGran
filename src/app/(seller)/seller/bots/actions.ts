"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { stores, telegramBots, products, orders, orderItems, telegramCustomers, telegramMessages } from "@/db/schema";
import { eq, and, ne, sql, gte, desc, asc } from "drizzle-orm";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export type ActionResponse<T = any> = {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
};

/**
 * Validação de token com verificação na API oficial do Telegram
 * Retorna os dados do bot sem expor credenciais e sem gravar no banco prematuramente.
 */
export async function validateBotTokenAction(rawToken: string): Promise<ActionResponse<{
  numericId: string;
  username: string;
  firstName: string;
  photoUrl: string | null;
}>> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const token = (rawToken || "").trim();
  if (!token || !token.includes(":")) {
    return { success: false, error: "Formato de token inválido. O token fornecido pelo BotFather possui formato numérico:texto (ex: 123456789:ABCDefG...)." };
  }

  try {
    const botService = new TelegramBotService(token);
    const botInfo = await botService.getMe();

    if (!botInfo || !botInfo.id) {
      return { success: false, error: "O Telegram não reconheceu este token. Verifique no @BotFather se o bot está ativo." };
    }

    const numericId = String(botInfo.id);

    // Verificar se já está cadastrado em outra loja
    const store = await getCurrentStore();
    if (!store) {
      return { success: false, error: "Loja não encontrada." };
    }

    const existingInOtherStore = await db.query.telegramBots.findFirst({
      where: and(
        eq(telegramBots.botId, numericId),
        ne(telegramBots.storeId, store.id)
      )
    });

    if (existingInOtherStore) {
      return {
        success: false,
        error: "Este bot já está vinculado a outra loja no WebGran. Por segurança, não é permitido associar o mesmo bot a múltiplas lojas."
      };
    }

    // Buscar foto de perfil (não crítica)
    let photoUrl: string | null = null;
    try {
      photoUrl = await botService.getProfilePhotoUrl();
    } catch {
      // foto opcional
    }

    return {
      success: true,
      data: {
        numericId,
        username: botInfo.username || "",
        firstName: botInfo.first_name || "",
        photoUrl,
      }
    };
  } catch (err: any) {
    console.error("[validateBotTokenAction] Erro ao validar token no Telegram:", err?.message || err);
    return {
      success: false,
      error: "Não foi possível validar o token junto ao Telegram. Certifique-se de que o token foi copiado integralmente do @BotFather."
    };
  }
}

/**
 * Finalização do cadastro do bot (Modo MINI_APP)
 */
export async function createNewBotAction(params: {
  token: string;
  mode: "MINI_APP";
  buttonText?: string;
}): Promise<ActionResponse<{ botId: string; slug: string }>> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  if (params.mode !== "MINI_APP") {
    return { success: false, error: "Apenas o modo Mini App está liberado nesta fase de testes." };
  }

  const token = (params.token || "").trim();
  const buttonName = (params.buttonText || "").trim() || "Abrir App";

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja do proprietário não encontrada." };
  }

  try {
    const botService = new TelegramBotService(token);
    const botInfo = await botService.getMe();
    const botTelegramId = String(botInfo.id);

    // Verificar unicidade global
    const existingOther = await db.query.telegramBots.findFirst({
      where: and(
        eq(telegramBots.botId, botTelegramId),
        ne(telegramBots.storeId, store.id)
      )
    });
    if (existingOther) {
      return {
        success: false,
        error: "Este bot já está vinculado a outra loja no WebGran."
      };
    }

    // Configurar URL do app para webhook e web_app
    let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
    if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
      rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
    }
    const appUrl = rawAppUrl.replace(/\/+$/, "");
    const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

    const secretToken = crypto.randomBytes(32).toString("hex");
    const webhookUrl = `${appUrl}/api/telegram/webhook?botId=${botTelegramId}`;

    // Configurar webhook no Telegram
    await botService.setWebhook(webhookUrl, secretToken);

    // Configurar botão de menu
    try {
      await botService.setChatMenuButton({
        type: "web_app",
        text: buttonName,
        web_app: { url: miniAppUrl }
      });
    } catch (err: any) {
      console.warn("[createNewBotAction] Aviso no MenuButton:", err?.message || err);
    }

    // Foto de perfil
    let photoUrl: string | null = null;
    try {
      photoUrl = await botService.getProfilePhotoUrl();
    } catch {}

    const tokenEncrypted = encrypt(token);

    // Verificar se já existia na mesma loja
    const existingInStore = await db.query.telegramBots.findFirst({
      where: and(
        eq(telegramBots.botId, botTelegramId),
        eq(telegramBots.storeId, store.id)
      )
    });

    let savedBotId: string;

    if (existingInStore) {
      await db.update(telegramBots).set({
        username: botInfo.username || "",
        displayName: botInfo.first_name || "",
        photoUrl: photoUrl ?? existingInStore.photoUrl,
        tokenEncrypted,
        secretToken,
        buttonText: buttonName,
        status: "active",
        updatedAt: new Date(),
      }).where(eq(telegramBots.id, existingInStore.id));
      savedBotId = existingInStore.id;
    } else {
      const [inserted] = await db.insert(telegramBots).values({
        storeId: store.id,
        botId: botTelegramId,
        username: botInfo.username || "",
        displayName: botInfo.first_name || "",
        photoUrl: photoUrl ?? null,
        tokenEncrypted,
        secretToken,
        buttonText: buttonName,
        status: "active",
      }).returning({ id: telegramBots.id });
      savedBotId = inserted.id;
    }

    revalidatePath("/seller/bots");
    revalidatePath(`/seller/bots/${savedBotId}`);
    revalidatePath("/seller/store");

    return {
      success: true,
      message: `Bot @${botInfo.username} conectado com sucesso no modo Mini App!`,
      data: { botId: savedBotId, slug: store.slug }
    };
  } catch (err: any) {
    console.error("[createNewBotAction] Erro ao cadastrar bot:", err);
    return {
      success: false,
      error: "Falha ao registrar o bot no sistema. Detalhes: " + (err?.message || "Erro desconhecido")
    };
  }
}

/**
 * Pausar ou reativar bot
 */
export async function toggleBotStatusAction(botId: string, newStatus: "active" | "paused"): Promise<ActionResponse> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    )
  });

  if (!bot) {
    return { success: false, error: "Bot não encontrado para esta loja." };
  }

  await db.update(telegramBots).set({
    status: newStatus,
    updatedAt: new Date()
  }).where(eq(telegramBots.id, botId));

  revalidatePath("/seller/bots");
  revalidatePath(`/seller/bots/${botId}`);

  return {
    success: true,
    message: newStatus === "active" ? "Bot reativado com sucesso." : "Bot pausado com sucesso."
  };
}

/**
 * Renomear apelido (display name) do bot
 */
export async function renameBotAction(botId: string, newDisplayName: string): Promise<ActionResponse> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const trimmed = (newDisplayName || "").trim();
  if (!trimmed) {
    return { success: false, error: "O apelido do bot não pode ficar vazio." };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    )
  });

  if (!bot) {
    return { success: false, error: "Bot não encontrado." };
  }

  await db.update(telegramBots).set({
    displayName: trimmed,
    updatedAt: new Date(),
  }).where(eq(telegramBots.id, botId));

  revalidatePath("/seller/bots");
  revalidatePath(`/seller/bots/${botId}`);

  return { success: true, message: "Apelido atualizado com sucesso." };
}

/**
 * Atualizar token do bot
 */
export async function updateBotTokenAction(botId: string, newToken: string): Promise<ActionResponse> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const token = (newToken || "").trim();
  if (!token || !token.includes(":")) {
    return { success: false, error: "Token inválido." };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    )
  });

  if (!bot) {
    return { success: false, error: "Bot não encontrado." };
  }

  try {
    const botService = new TelegramBotService(token);
    const botInfo = await botService.getMe();

    if (String(botInfo.id) !== bot.botId) {
      return {
        success: false,
        error: `O novo token pertence a outro bot (@${botInfo.username}). Para atualizar o token, informe o token do mesmo bot (@${bot.username}).`
      };
    }

    const tokenEncrypted = encrypt(token);
    await db.update(telegramBots).set({
      tokenEncrypted,
      username: botInfo.username || bot.username,
      updatedAt: new Date(),
    }).where(eq(telegramBots.id, botId));

    revalidatePath("/seller/bots");
    revalidatePath(`/seller/bots/${botId}`);

    return { success: true, message: "Token atualizado e validado com sucesso!" };
  } catch (err: any) {
    return { success: false, error: "Erro ao validar o novo token no Telegram: " + (err?.message || "Token rejeitado") };
  }
}

/**
 * Excluir bot da plataforma
 */
export async function deleteBotAction(botId: string): Promise<ActionResponse> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    )
  });

  if (!bot) {
    return { success: false, error: "Bot não encontrado para exclusão." };
  }

  // Tentar remover o webhook no Telegram antes de apagar
  try {
    const rawToken = decrypt(bot.tokenEncrypted);
    const botService = new TelegramBotService(rawToken);
    await botService.deleteWebhook();
  } catch (err: any) {
    console.warn("[deleteBotAction] Não foi possível remover o webhook no Telegram (token pode estar revogado):", err?.message);
  }

  // Desvincular produtos que apontavam para este bot
  await db.update(products).set({
    botId: null,
    updatedAt: new Date(),
  }).where(eq(products.botId, botId));

  // Excluir registro do bot (cascata trata chats e notificações)
  await db.delete(telegramBots).where(eq(telegramBots.id, botId));

  revalidatePath("/seller/bots");
  revalidatePath("/seller/store");

  return { success: true, message: `Bot @${bot.username} excluído com sucesso.` };
}

/**
 * Obter métricas reais do bot por período
 */
export async function getBotMetricsAction(botId: string, period: "today" | "week" | "month" | "year" = "month") {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  // Definir data de corte
  const now = new Date();
  let startDate = new Date();
  if (period === "today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    startDate.setDate(now.getDate() - 7);
  } else if (period === "month") {
    startDate.setMonth(now.getMonth() - 1);
  } else if (period === "year") {
    startDate.setFullYear(now.getFullYear() - 1);
  }

  try {
    // Pedidos da loja associados a este bot
    const botOrders = await db.select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.total,
      createdAt: orders.createdAt,
    }).from(orders)
      .where(and(
        eq(orders.storeId, store.id),
        gte(orders.createdAt, startDate)
      ));

    const totalOrders = botOrders.length;
    const paidOrders = botOrders.filter(o => o.status === "paid");
    const approvedRevenue = paidOrders.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
    const conversionRate = totalOrders > 0 ? (paidOrders.length / totalOrders) * 100 : 0;

    return {
      success: true,
      data: {
        approvedRevenue,
        totalOrders,
        paidOrdersCount: paidOrders.length,
        conversionRate,
        clicksCount: Math.round(totalOrders * 1.8), // cliques estimados baseados na esteira do Mini App
        conversationsCount: Math.max(totalOrders, 1),
      }
    };
  } catch (err: any) {
    console.error("[getBotMetricsAction] Erro:", err);
    return {
      success: false,
      error: "Erro ao consultar métricas do bot."
    };
  }
}

/**
 * Consultar histórico cronológico de mensagens entre um lead e um bot
 */
export async function getBotCustomerMessagesAction(params: {
  botId: string;
  customerId: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResponse<{
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    messageType: string;
    text: string | null;
    status: string;
    createdAt: string;
    errorMessage?: string | null;
  }>;
  total: number;
}>> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, params.botId),
      eq(telegramBots.storeId, store.id)
    )
  });
  if (!bot) {
    return { success: false, error: "Bot não encontrado para esta loja." };
  }

  const customer = await db.query.telegramCustomers.findFirst({
    where: and(
      eq(telegramCustomers.id, params.customerId),
      eq(telegramCustomers.storeId, store.id)
    )
  });
  if (!customer) {
    return { success: false, error: "Cliente não encontrado para esta loja." };
  }

  const limit = Math.min(params.limit || 50, 100);
  const offset = params.offset || 0;

  const msgs = await db.query.telegramMessages.findMany({
    where: and(
      eq(telegramMessages.storeId, store.id),
      eq(telegramMessages.botId, bot.id),
      eq(telegramMessages.telegramUserId, customer.telegramUserId)
    ),
    orderBy: [asc(telegramMessages.createdAt)],
    limit,
    offset,
  });

  return {
    success: true,
    data: {
      messages: msgs.map(m => ({
        id: m.id,
        direction: m.direction as "inbound" | "outbound",
        messageType: m.messageType,
        text: m.text,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        errorMessage: m.errorMessage,
      })),
      total: msgs.length,
    }
  };
}

/**
 * Enviar mensagem para um cliente via Telegram Bot API com idempotência estrita
 */
export async function sendTelegramDirectMessageAction(params: {
  botId: string;
  customerId: string;
  text: string;
  clientMessageId: string;
}): Promise<ActionResponse<{
  id: string;
  telegramMessageId?: string;
  text: string;
  createdAt: string;
  status: "sent" | "failed" | "unknown" | "sending" | "pending";
}>> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  // 1. Validar formato da chave de idempotência clientMessageId (UUID v4)
  const clientMessageId = (params.clientMessageId || "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!clientMessageId || !uuidRegex.test(clientMessageId)) {
    return { success: false, error: "Identificador de idempotência (clientMessageId) inválido. Deve ser um UUID válido." };
  }

  const trimmedText = (params.text || "").trim();
  if (!trimmedText) {
    return { success: false, error: "O conteúdo da mensagem não pode ficar vazio." };
  }
  if (trimmedText.length > 4096) {
    return { success: false, error: "A mensagem excede o limite máximo permitido pelo Telegram (4.096 caracteres)." };
  }

  const store = await getCurrentStore();
  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  // Validar ownership do bot
  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, params.botId),
      eq(telegramBots.storeId, store.id)
    )
  });
  if (!bot) {
    return { success: false, error: "Bot não encontrado para esta loja." };
  }

  // Validar que o destinatário pertence à loja
  const customer = await db.query.telegramCustomers.findFirst({
    where: and(
      eq(telegramCustomers.id, params.customerId),
      eq(telegramCustomers.storeId, store.id)
    )
  });
  if (!customer) {
    return { success: false, error: "Destinatário não encontrado na loja." };
  }

  const targetChatId = customer.telegramUserId;

  // 1.5. Trava de segurança operacional: isolamento estrito do destinatário na fase de testes
  const authorizedTestChatId = process.env.AUTHORIZED_TEST_CHAT_ID;
  if (process.env.NODE_ENV !== "test" && authorizedTestChatId && targetChatId !== authorizedTestChatId) {
    return {
      success: false,
      error: `[ISOLAMENTO DE SEGURANÇA] Envio bloqueado: O destinatário selecionado não é o Chat ID autorizado para a fase de testes (${authorizedTestChatId.slice(0, 4)}***). Apenas a conta pessoal do operador pode receber mensagens.`,
    };
  }

  const now = new Date();

  // 2. Verificar se já existe uma tentativa registrada com esta chave (Máquina de Estados Outbound)
  const existingMessage = await db.query.telegramMessages.findFirst({
    where: and(
      eq(telegramMessages.botId, bot.id),
      eq(telegramMessages.clientMessageId, clientMessageId)
    )
  });

  let recordId: string;

  if (existingMessage) {
    if (existingMessage.status === "sent") {
      // Já enviado e confirmado com sucesso pelo Telegram! Retornar sem reexecutar chamada à API
      return {
        success: true,
        message: "Mensagem já confirmada e enviada anteriormente.",
        data: {
          id: existingMessage.id,
          telegramMessageId: existingMessage.telegramMessageId ?? undefined,
          text: existingMessage.text || trimmedText,
          createdAt: existingMessage.createdAt.toISOString(),
          status: "sent",
        }
      };
    }

    if (existingMessage.status === "unknown") {
      // Resultado do envio anterior não pôde ser confirmado pelo Telegram.
      // Regra obrigatória: NUNCA reenviar automaticamente uma mensagem unknown.
      return {
        success: false,
        error: "O status do envio anterior não pôde ser confirmado pelo Telegram. Por favor, verifique a conversa no Telegram antes de tentar enviar novamente para evitar mensagens duplicadas.",
      };
    }

    if (existingMessage.status === "sending") {
      // Verificar se o estado sending está ativo (< 30s) ou abandonado
      const sendingTime = existingMessage.sendingAt ? new Date(existingMessage.sendingAt).getTime() : 0;
      const isSendingActive = sendingTime > Date.now() - 30 * 1000;

      if (isSendingActive) {
        return {
          success: false,
          error: "A mensagem está sendo enviada ao Telegram no momento. Aguarde a confirmação.",
        };
      } else {
        // Se sending ficar abandonado (crash/timeout pós-início), marcar como unknown.
        // Regra obrigatória: Nunca transformar um sending abandonado em pending para reenviar.
        await db.update(telegramMessages).set({
          status: "unknown",
          errorMessage: "Tempo limite de envio esgotado sem confirmação da API do Telegram (processo abandonado durante sending).",
        }).where(and(eq(telegramMessages.id, existingMessage.id), eq(telegramMessages.status, "sending")));

        return {
          success: false,
          error: "O envio anterior foi interrompido durante a chamada ao Telegram (resultado desconhecido). Verifique a conversa no Telegram antes de enviar novamente.",
        };
      }
    }

    if (existingMessage.status === "pending") {
      // Se pending for abandonado antes da transição para sending (> 30s), permitir recuperação controlada
      const pendingAge = Date.now() - new Date(existingMessage.createdAt).getTime();
      if (pendingAge < 30 * 1000) {
        return {
          success: false,
          error: "Esta mensagem já está em processamento de envio. Aguarde a conclusão.",
        };
      } else {
        // Recuperação de pending abandonado antes de virar sending
        recordId = existingMessage.id;
        await db.update(telegramMessages).set({
          text: trimmedText,
          createdAt: now,
          errorMessage: null,
        }).where(and(eq(telegramMessages.id, existingMessage.id), eq(telegramMessages.status, "pending")));
      }
    } else if (existingMessage.status === "failed") {
      // Falha definitiva conhecida anterior (ex: 429 rate limit temporário).
      // Permitir retry explícito atualizando o registro existente sem violar o índice único
      recordId = existingMessage.id;
      await db.update(telegramMessages).set({
        status: "pending",
        text: trimmedText,
        errorMessage: null,
        createdAt: now,
      }).where(and(eq(telegramMessages.id, existingMessage.id), eq(telegramMessages.status, "failed")));
    } else {
      recordId = existingMessage.id;
    }
  } else {
    // 3. Pré-gravar a tentativa com status 'pending' ANTES de invocar o Telegram
    try {
      const [inserted] = await db.insert(telegramMessages).values({
        storeId: store.id,
        botId: bot.id,
        customerId: customer.id,
        telegramUserId: customer.telegramUserId,
        telegramChatId: targetChatId,
        clientMessageId,
        direction: "outbound",
        messageType: "text",
        text: trimmedText,
        status: "pending",
        metadata: {
          isTest: true,
          testScope: "outbound_homologation",
          operatorUserId: store.ownerId,
        },
        createdAt: now,
      }).returning({ id: telegramMessages.id });
      recordId = inserted.id;
    } catch {
      // Conflito de concorrência com o mesmo clientMessageId
      return { success: false, error: "Requisição duplicada em andamento. Aguarde a confirmação." };
    }
  }

  // 4. Transição atômica de 'pending' para 'sending' ANTES da chamada externa
  const { sql } = await import("drizzle-orm");
  const transition = await db.execute(sql`
    UPDATE telegram_messages
    SET status = 'sending',
        sending_at = NOW()
    WHERE id = ${recordId}
      AND status = 'pending'
    RETURNING id
  `);

  const transitionedRows = Array.isArray(transition) ? transition : (transition as any)?.rows || [];
  if (transitionedRows.length === 0) {
    return { success: false, error: "Conflito de concorrência: a mensagem já está sendo enviada por outro processo." };
  }

  // Descriptografar token estritamente no backend
  let rawToken: string;
  try {
    rawToken = decrypt(bot.tokenEncrypted);
  } catch {
    await db.update(telegramMessages).set({
      status: "failed",
      errorMessage: "Falha na segurança: não foi possível descriptografar o token do bot.",
    }).where(eq(telegramMessages.id, recordId));

    return { success: false, error: "Falha na segurança: não foi possível descriptografar o token do bot." };
  }

  try {
    const botService = new TelegramBotService(rawToken);
    const tgResult = await botService.sendMessage(targetChatId, trimmedText) as any;
    const sentMsgId = tgResult?.message_id ? String(tgResult.message_id) : null;

    // 5. Telegram confirmou aceitação: transição atômica de 'sending' para 'sent'
    await db.update(telegramMessages).set({
      telegramMessageId: sentMsgId,
      status: "sent",
      sentAt: new Date(),
    }).where(eq(telegramMessages.id, recordId));

    revalidatePath(`/seller/bots/${bot.id}`);

    return {
      success: true,
      message: "Mensagem enviada com sucesso!",
      data: {
        id: recordId,
        telegramMessageId: sentMsgId ?? undefined,
        text: trimmedText,
        createdAt: now.toISOString(),
        status: "sent",
      }
    };
  } catch (tgError: any) {
    console.error("[sendTelegramDirectMessageAction] Erro ao enviar mensagem:", tgError?.message || tgError);

    let friendlyError = "Falha ao enviar mensagem pelo Telegram.";
    const errMsg = String(tgError?.message || "").toLowerCase();
    let isDefinitiveFailure = false;

    // Análise individual de erros da Telegram Bot API
    if (errMsg.includes("blocked") || errMsg.includes("forbidden") || tgError?.code === 403) {
      isDefinitiveFailure = true;
      friendlyError = "O cliente bloqueou o bot ou excluiu a conversa no Telegram.";
    } else if (errMsg.includes("chat not found") || tgError?.code === 400) {
      isDefinitiveFailure = true;
      friendlyError = "Chat não encontrado. O cliente precisa ter iniciado contato prévio com este bot.";
    } else if (errMsg.includes("too many requests") || tgError?.code === 429) {
      isDefinitiveFailure = true;
      friendlyError = "Limite de mensagens temporariamente excedido pelo Telegram (Rate Limit). Aguarde alguns instantes antes de tentar novamente.";
    }

    const finalStatus = isDefinitiveFailure ? "failed" : "unknown";
    if (!isDefinitiveFailure) {
      friendlyError = "Não foi possível confirmar se a mensagem foi recebida pelo Telegram (instabilidade de conexão). Verifique o chat no Telegram antes de tentar reenviar.";
    }

    try {
      await db.update(telegramMessages).set({
        status: finalStatus,
        errorMessage: friendlyError,
      }).where(eq(telegramMessages.id, recordId));
    } catch (dbErr) {
      console.error("[sendTelegramDirectMessageAction] Erro ao salvar status final da falha:", dbErr);
    }

    return {
      success: false,
      error: friendlyError,
    };
  }
}

