"use server";

import crypto from "crypto";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots, botSaleNotificationRecipients, botSaleNotificationTokens } from "@/db/schema";
import { eq, and, ne, lt, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { formatBrtDateTime } from "@/lib/notifications/seller-sale-notification-service";

export type SaveBotActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

export async function saveBotAction(formData: FormData): Promise<SaveBotActionResult> {
  let seller;
  let store;
  try {
    seller = await requireSeller();
    store = await getCurrentStore();
  } catch (err: any) {
    return { success: false, error: "Usuário não autenticado ou sessão expirada." };
  }

  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  try {
    const botAllowed = await hasFeature(seller.id, "telegram_bot");
    if (!botAllowed) {
      return { 
        success: false, 
        error: "A integração com Bot do Telegram não está disponível no seu plano. Faça upgrade para continuar." 
      };
    }
  } catch (err: any) {
    console.error("[saveBotAction] Erro ao validar permissão do plano:", err?.message || err);
    return { success: false, error: "Erro ao consultar permissões do plano. Tente novamente." };
  }

  const rawToken = (formData.get("token") as string | null) || "";
  const token = rawToken.trim();
  const rawButtonName = (formData.get("buttonName") as string | null) || "";
  const buttonName = rawButtonName.trim() || "Abrir App";
  const existingBotId = (formData.get("existingBotId") as string | null) || null;
  const rawName = (formData.get("name") as string | null) || "";
  const name = rawName.trim();
  const rawLogoUrl = (formData.get("logoUrl") as string | null) || "";
  const logoUrl = rawLogoUrl.trim();

  // 1. Atualizar personalização da loja (Nome e Logo) preservando dados atuais se campos vazios
  try {
    const storeUpdates: Partial<typeof stores.$inferInsert> = {};
    if (name && name !== store.name) {
      storeUpdates.name = name;
    }
    if (logoUrl && logoUrl !== store.logoUrl) {
      storeUpdates.logoUrl = logoUrl;
    }

    if (Object.keys(storeUpdates).length > 0) {
      storeUpdates.updatedAt = new Date();
      await db.update(stores).set(storeUpdates).where(eq(stores.id, store.id));
      if (storeUpdates.name) store.name = storeUpdates.name;
      if (storeUpdates.logoUrl) store.logoUrl = storeUpdates.logoUrl;
    }
  } catch (err: any) {
    console.error("[saveBotAction] Erro ao atualizar dados de personalização da loja:", err?.message || err);
    return { 
      success: false, 
      error: "Erro ao atualizar dados de personalização da loja no banco de dados." 
    };
  }

  let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
  // If user configured non-www domain while Vercel domain redirect is www, ensure canonical host
  if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
    rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
  }
  const appUrl = rawAppUrl.replace(/\/+$/, "");
  const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

  const isRealToken = Boolean(token && token.includes(":") && !token.includes("••••"));
  const cleanWebhookUrl = `${appUrl}/api/telegram/webhook`;

  if (isRealToken) {
    // --- Token fornecido: validação via getMe, webhook, menu button e persistência ---
    let botService: TelegramBotService;
    let botInfo: { id: number | string; username?: string; first_name?: string };
    try {
      botService = new TelegramBotService(token);
      botInfo = await botService.getMe();
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao validar token do bot no Telegram:", err?.message || err);
      return { 
        success: false, 
        error: "Token do Telegram inválido ou não autorizado. Verifique o token fornecido pelo @BotFather." 
      };
    }

    const botTelegramId = String(botInfo.id);

    // Verificação estrita de bot_id globalmente (respeitando constraint UNIQUE)
    // Se o bot já pertencer a outra loja, impede a associação e informa o usuário
    let botInOtherStore;
    try {
      botInOtherStore = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.botId, botTelegramId),
          ne(telegramBots.storeId, store.id)
        )
      });
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao verificar bot globalmente:", err?.message || err);
      return { success: false, error: "Erro ao consultar integridade do bot no banco de dados." };
    }

    if (botInOtherStore) {
      return {
        success: false,
        error: "Este bot já está vinculado a outra loja no WebGran. Por segurança, não é permitido associar o mesmo bot a lojas diferentes."
      };
    }

    // Busca se este bot já está cadastrado nesta loja
    let existingBotInStore;
    try {
      existingBotInStore = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.botId, botTelegramId),
          eq(telegramBots.storeId, store.id)
        )
      });
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao verificar bot na loja:", err?.message || err);
      return { success: false, error: "Erro ao consultar dados da loja no banco." };
    }

    // SecretToken para multi-tenant seguro
    const secretToken = existingBotInStore?.secretToken || crypto.randomBytes(32).toString("hex");

    // Webhook no Telegram
    const webhookUrl = `${cleanWebhookUrl}?botId=${botTelegramId}`;
    try {
      await botService.setWebhook(webhookUrl, secretToken);
    } catch (err: any) {
      console.error("[saveBotAction] Falha ao registrar webhook no Telegram:", err?.message || err);
      return {
        success: false,
        error: "Não foi possível registrar o webhook no Telegram. Verifique a conexão e tente novamente."
      };
    }

    // Foto de perfil do bot
    let photoUrl: string | null = null;
    try {
      photoUrl = await botService.getProfilePhotoUrl();
    } catch (err: any) {
      console.warn("[saveBotAction] Aviso: Falha ao obter foto de perfil do Telegram:", err?.message || err);
    }

    let tokenEncrypted: string;
    try {
      tokenEncrypted = encrypt(token);
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao criptografar token:", err?.message || err);
      return { success: false, error: "Erro interno de segurança ao armazenar credenciais." };
    }

    // Upsert no Neon DB
    let savedBotId: string;
    try {
      if (existingBotInStore) {
        await db.update(telegramBots).set({
          username: botInfo.username || "",
          displayName: botInfo.first_name || "",
          photoUrl: photoUrl ?? existingBotInStore.photoUrl,
          tokenEncrypted,
          secretToken,
          buttonText: buttonName,
          status: "active",
          updatedAt: new Date()
        }).where(eq(telegramBots.id, existingBotInStore.id));
        savedBotId = existingBotInStore.id;
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
          status: "active"
        }).returning({ id: telegramBots.id });
        savedBotId = inserted.id;
      }
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao gravar bot no Neon:", err?.message || err);
      return {
        success: false,
        error: "Erro ao salvar bot no banco de dados. Verifique os dados e tente novamente."
      };
    }

    // Botão Azul (Menu Button) com contexto de bot (?b=botId)
    try {
      await botService.setChatMenuButton({
        type: "web_app",
        text: buttonName,
        web_app: { url: `${miniAppUrl}?b=${savedBotId}` }
      });
    } catch (err: any) {
      console.warn("[saveBotAction] Aviso: Falha não crítica ao definir Chat Menu Button:", err?.message || err);
    }
  } else if (existingBotId) {
    // --- Edição de bot existente sem novo token ---
    let existingBot;
    try {
      existingBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, existingBotId),
          eq(telegramBots.storeId, store.id)
        )
      });
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao buscar bot para edição:", err?.message || err);
      return { success: false, error: "Erro ao consultar bot existente." };
    }

    if (!existingBot) {
      return { success: false, error: "Bot não encontrado para esta loja." };
    }

    try {
      const currentToken = decrypt(existingBot.tokenEncrypted);
      const botService = new TelegramBotService(currentToken);

      let secretToken = existingBot.secretToken;
      if (!secretToken) {
        secretToken = crypto.randomBytes(32).toString("hex");
      }

      let photoUrl = existingBot.photoUrl;
      try {
        const freshPhoto = await botService.getProfilePhotoUrl();
        if (freshPhoto) photoUrl = freshPhoto;
      } catch (err: any) {
        console.warn("[saveBotAction] Não foi possível atualizar foto de perfil do bot:", err?.message || err);
      }

      await db.update(telegramBots).set({ 
        secretToken,
        buttonText: buttonName,
        photoUrl,
        updatedAt: new Date()
      }).where(eq(telegramBots.id, existingBot.id));

      const webhookUrl = `${cleanWebhookUrl}?botId=${existingBot.botId}`;
      try {
        await botService.setWebhook(webhookUrl, secretToken);
      } catch (err: any) {
        console.warn("[saveBotAction] Aviso: Erro ao re-registrar webhook no Telegram:", err?.message || err);
      }

      try {
        await botService.setChatMenuButton({
          type: "web_app",
          text: buttonName,
          web_app: { url: `${miniAppUrl}?b=${existingBot.id}` }
        });
      } catch (err: any) {
        console.warn("[saveBotAction] Aviso: Erro ao atualizar menu button no Telegram:", err?.message || err);
      }
    } catch (err: any) {
      console.error("[saveBotAction] Erro ao atualizar bot existente:", err?.message || err);
      return {
        success: false,
        error: "Erro ao atualizar dados do bot. Verifique as configurações e tente novamente."
      };
    }
  } else {
    return {
      success: false,
      error: "O Token do Bot é obrigatório para cadastrar um novo bot."
    };
  }

  try {
    revalidatePath("/seller/store");
  } catch (err: any) {
    console.warn("[saveBotAction] Erro não impeditivo ao revalidar caminho:", err?.message || err);
  }

  return {
    success: true,
    message: "Bot configurado com sucesso! Webhook e botão do Mini App atualizados."
  };
}

export async function deleteBotAction(botId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    )
  });

  if (!bot) throw new Error("Bot não encontrado.");

  // Delete webhook on Telegram side
  try {
    const currentToken = decrypt(bot.tokenEncrypted);
    const botService = new TelegramBotService(currentToken);
    await botService.deleteWebhook();
    // Reset menu button to default
    await botService.setChatMenuButton({ type: "default" });
  } catch {
    // If token is invalid, still delete from DB
  }

  await db.delete(telegramBots).where(eq(telegramBots.id, botId));
  revalidatePath("/seller/store");
}

export type BotNotificationRecipientInfo = {
  id: string;
  telegramChatId: string;
  displayName: string | null;
  status: "active" | "blocked" | "disconnected";
  createdAt: Date;
};

export type BotNotificationInfoResult = {
  success: boolean;
  error?: string;
  status: "active" | "disconnected" | "reconnect";
  recipients: BotNotificationRecipientInfo[];
  botUsername?: string;
  botDisplayName?: string | null;
};

// In-memory rate limiting per seller for polling: max 40 requests per 60 seconds
const pollingRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function checkPollingRateLimit(sellerId: string): Promise<boolean> {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 40;

  const current = pollingRateLimitMap.get(sellerId);
  if (!current || now > current.resetAt) {
    pollingRateLimitMap.set(sellerId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

export async function getBotNotificationInfoAction(botId: string): Promise<BotNotificationInfoResult> {
  let seller;
  let store;
  try {
    seller = await requireSeller();
    store = await getCurrentStore();
  } catch {
    return { success: false, error: "Não autenticado.", status: "disconnected", recipients: [] };
  }

  if (!store) {
    return { success: false, error: "Loja não encontrada.", status: "disconnected", recipients: [] };
  }

  // Rate Limiting validation
  if (!(await checkPollingRateLimit(seller.id))) {
    return {
      success: false,
      error: "Taxa de requisições excedida. Aguarde alguns instantes.",
      status: "disconnected",
      recipients: [],
    };
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id)),
  });

  if (!bot) {
    return { success: false, error: "Bot não encontrado.", status: "disconnected", recipients: [] };
  }

  const recipients = await db.query.botSaleNotificationRecipients.findMany({
    where: and(
      eq(botSaleNotificationRecipients.botId, botId),
      eq(botSaleNotificationRecipients.storeId, store.id)
    ),
    orderBy: [desc(botSaleNotificationRecipients.createdAt)],
  });

  const activeRecipients = recipients.filter((r) => r.status === "active");
  const hasBlocked = recipients.some((r) => r.status === "blocked") || bot.status === "invalid_token";

  let status: "active" | "disconnected" | "reconnect" = "disconnected";
  if (hasBlocked) {
    status = "reconnect";
  } else if (activeRecipients.length > 0) {
    status = "active";
  }

  return {
    success: true,
    status,
    recipients: recipients.map((r) => ({
      id: r.id,
      telegramChatId: r.telegramChatId,
      displayName: r.displayName,
      status: r.status as any,
      createdAt: r.createdAt,
    })),
    botUsername: bot.username,
    botDisplayName: bot.displayName,
  };
}

export async function generateBotNotificationLinkAction(botId: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const bot = await db.query.telegramBots.findFirst({
    where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id)),
  });

  if (!bot || !bot.username) {
    throw new Error("Bot não encontrado ou sem username configurado.");
  }

  // Purge expired tokens older than 1 hour for cleanliness
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await db
      .delete(botSaleNotificationTokens)
      .where(
        and(
          eq(botSaleNotificationTokens.botId, botId),
          lt(botSaleNotificationTokens.expiresAt, oneHourAgo)
        )
      );
  } catch {
    // Non-critical cleanup
  }

  // Generate high-entropy token: 24 bytes (192 bits), safe base64url ([A-Za-z0-9_-], <= 40 chars)
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(botSaleNotificationTokens).values({
    storeId: store.id,
    botId: bot.id,
    tokenHash,
    expiresAt,
  });

  const link = `https://t.me/${bot.username}?start=notif_${token}`;

  return {
    success: true,
    link,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function disconnectBotNotificationRecipientAction(recipientId: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  await db
    .delete(botSaleNotificationRecipients)
    .where(
      and(
        eq(botSaleNotificationRecipients.id, recipientId),
        eq(botSaleNotificationRecipients.storeId, store.id)
      )
    );

  revalidatePath("/seller/store");
  return { success: true };
}

export async function saveManualBotNotificationRecipientAction(
  botId: string,
  telegramId: string,
  displayName?: string
) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const cleanId = (telegramId || "").trim();
  if (!cleanId) throw new Error("Informe um Telegram ID válido.");
  if (!/^-?\d+$/.test(cleanId)) {
    throw new Error("O Telegram ID deve conter apenas números (ex: 123456789).");
  }

  const bot = await db.query.telegramBots.findFirst({
    where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id)),
  });

  if (!bot) throw new Error("Bot não encontrado.");

  if (String(bot.botId).trim() === cleanId) {
    throw new Error(
      "O ID informado pertence ao bot da sua loja. O Telegram proíbe bots de enviarem mensagens para bots. Você deve informar o seu ID pessoal de usuário."
    );
  }

  const name = (displayName || "").trim() || "Configurado manualmente";
  const now = new Date();

  await db
    .insert(botSaleNotificationRecipients)
    .values({
      storeId: store.id,
      botId: bot.id,
      telegramChatId: cleanId,
      displayName: name,
      status: "active",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [botSaleNotificationRecipients.botId, botSaleNotificationRecipients.telegramChatId],
      set: {
        status: "active",
        displayName: name,
        updatedAt: now,
      },
    });

  // Also maintain store-level fallback
  await db
    .update(stores)
    .set({ telegramNotificationId: cleanId, updatedAt: now })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/store");
  return { success: true };
}

export async function sendTestBotNotificationAction(botId: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const bot = await db.query.telegramBots.findFirst({
    where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id)),
  });

  if (!bot || !bot.tokenEncrypted) {
    throw new Error("Bot não encontrado ou token não configurado.");
  }

  const recipients = await db.query.botSaleNotificationRecipients.findMany({
    where: and(
      eq(botSaleNotificationRecipients.botId, botId),
      eq(botSaleNotificationRecipients.storeId, store.id),
      eq(botSaleNotificationRecipients.status, "active")
    ),
  });

  if (recipients.length === 0) {
    throw new Error("Nenhum aviso configurado para este bot. Conecte seu Telegram primeiro.");
  }

  const botToken = decrypt(bot.tokenEncrypted);
  const botService = new TelegramBotService(botToken);
  const nowStr = formatBrtDateTime(new Date());

  const testMessage =
`🧪 [TESTE DE NOTIFICAÇÃO]
🛒 Nova venda realizada!

📦 Produto: Assinatura VIP (Exemplo de Teste)
👤 Cliente: Cliente de Teste (@cliente_teste)
💰 Valor Bruto: R$ 97,00
💵 Valor Líquido: R$ 92,15
🆔 Pedido: #TESTE-001
🤖 Bot: @${bot.username}
📅 Data: ${nowStr}

⚠️ Esta é uma notificação de teste disparada pelo painel para validar a conexão.`;

  let sentCount = 0;
  let blockedCount = 0;

  for (const recipient of recipients) {
    try {
      await botService.sendMessage(recipient.telegramChatId, testMessage);
      sentCount++;
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      if (
        errMsg.includes("403") ||
        errMsg.toLowerCase().includes("blocked") ||
        errMsg.toLowerCase().includes("user is deactivated")
      ) {
        blockedCount++;
        await db
          .update(botSaleNotificationRecipients)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(botSaleNotificationRecipients.id, recipient.id));
      }
    }
  }

  if (sentCount === 0 && blockedCount > 0) {
    throw new Error("O bot foi bloqueado no Telegram ou o usuário desativou as mensagens. Reconecte o aviso.");
  }

  return {
    success: true,
    sentCount,
    blockedCount,
    message: `Mensagem de teste enviada com sucesso para ${sentCount} destinatário(s)! Verifique seu Telegram.`,
  };
}

export async function saveTelegramNotificationIdAction(telegramNotificationId: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const cleanId = (telegramNotificationId || "").trim();

  if (cleanId) {
    if (!/^-?\d+$/.test(cleanId)) {
      throw new Error("O Telegram ID deve conter apenas números (ex: 123456789).");
    }

    // Validação de segurança: o Telegram ID não pode ser o ID de um bot
    const storeBots = db.query.telegramBots?.findMany
      ? await db.query.telegramBots.findMany({
          where: eq(telegramBots.storeId, store.id),
        })
      : [];

    const isBotId = (storeBots || []).some(
      (b: any) => String(b.botId).trim() === cleanId || String(b.id).trim() === cleanId
    );

    if (isBotId) {
      throw new Error(
        `O ID informado (${cleanId}) pertence ao bot da sua loja. O Telegram proíbe bots de enviarem mensagens para bots. Você deve informar o seu ID pessoal de usuário (obtido enviando /start para @userinfobot).`
      );
    }
  }

  await db
    .update(stores)
    .set({ telegramNotificationId: cleanId || null, updatedAt: new Date() })
    .where(and(eq(stores.id, store.id), eq(stores.ownerId, seller.id)));

  revalidatePath("/seller/store");
  return { success: true, telegramNotificationId: cleanId };
}

export async function saveSupportContactAction(supportContactUrl: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const cleanInput = (supportContactUrl || "").trim();

  // Se vazio, remove o contato de suporte da loja
  if (!cleanInput) {
    await db
      .update(stores)
      .set({ supportValue: null, updatedAt: new Date() })
      .where(and(eq(stores.id, store.id), eq(stores.ownerId, seller.id)));

    revalidatePath("/seller/store");
    return { success: true, supportContactUrl: null };
  }

  // Verificação de protocolos proibidos
  const lower = cleanInput.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    throw new Error("Protocolo de link não permitido por motivos de segurança.");
  }

  let resolvedUrl: string | null = null;
  let supportType: string = "telegram";

  // Se for username do Telegram (@usuario ou usuario) ou link t.me
  if (
    cleanInput.startsWith("@") ||
    cleanInput.includes("t.me/") ||
    (!cleanInput.includes("://") && /^[a-zA-Z0-9_]{5,32}$/.test(cleanInput))
  ) {
    const cleanUsername = cleanInput
      .replace(/^https?:\/\/t\.me\//i, "")
      .replace(/^t\.me\//i, "")
      .replace(/^@+/, "")
      .replace(/\/+$/, "")
      .trim();

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanUsername)) {
      throw new Error("Username do Telegram inválido. Deve conter entre 5 e 32 caracteres (apenas letras, números e _).");
    }

    resolvedUrl = `https://t.me/${cleanUsername}`;
    supportType = "telegram";
  } else {
    // Link externo ou WhatsApp
    let parsed: URL;
    try {
      parsed = new URL(cleanInput);
    } catch {
      throw new Error("URL inválida. Informe um link completo iniciando com https:// (ex: https://t.me/seu_contato).");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Por motivos de segurança, o link de suporte deve obrigatoriamente utilizar protocolo HTTPS (https://...).");
    }

    if (!parsed.hostname || parsed.hostname.length < 3) {
      throw new Error("URL inválida (domínio incompleto).");
    }

    resolvedUrl = parsed.toString();
    supportType = parsed.hostname.includes("wa.me") || parsed.hostname.includes("whatsapp.com") ? "whatsapp" : "link";
  }

  await db
    .update(stores)
    .set({ supportValue: resolvedUrl, supportType, updatedAt: new Date() })
    .where(and(eq(stores.id, store.id), eq(stores.ownerId, seller.id)));

  revalidatePath("/seller/store");
  return { success: true, supportContactUrl: resolvedUrl };
}

