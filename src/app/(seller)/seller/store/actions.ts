"use server";

import crypto from "crypto";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";
import { hasFeature } from "@/lib/entitlements/entitlement-service";

export async function saveBotAction(formData: FormData) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const botAllowed = await hasFeature(seller.id, "telegram_bot");
  if (!botAllowed) {
    throw new Error("A integração com Bot do Telegram não está disponível no seu plano. Faça upgrade.");
  }

  const token = formData.get("token") as string;
  const buttonName = (formData.get("buttonName") as string) || "Abrir Loja";
  const existingBotId = formData.get("existingBotId") as string | null;

  let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
  // If user configured non-www domain while Vercel domain redirect is www, ensure canonical host
  if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
    rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
  }
  const appUrl = rawAppUrl.replace(/\/+$/, "");
  const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

  const isRealToken = token && token.includes(":");

  const cleanWebhookUrl = `${appUrl}/api/telegram/webhook`;

  if (isRealToken) {
    // --- Token provided: validate, register webhook, set menu button ---
    const botService = new TelegramBotService(token);

    // 1. Validate token with getMe
    const botInfo = await botService.getMe();
    const botTelegramId = String(botInfo.id);

    // 2. Generate secretToken for secure multi-tenant verification
    const secretToken = crypto.randomBytes(32).toString("hex");

    // 3. Set Webhook automatically with botId query param and secret_token header
    const webhookUrl = `${cleanWebhookUrl}?botId=${botTelegramId}`;
    await botService.setWebhook(webhookUrl, secretToken);

    // 4. Set the blue Menu Button automatically
    await botService.setChatMenuButton({
      type: "web_app",
      text: buttonName,
      web_app: { url: miniAppUrl }
    });

    // 5. Fetch bot's profile photo
    const photoUrl = await botService.getProfilePhotoUrl();
    const tokenEncrypted = encrypt(token);

    // 6. Upsert in DB
    const existingBot = await db.query.telegramBots.findFirst({
      where: and(
        eq(telegramBots.botId, botTelegramId),
        eq(telegramBots.storeId, store.id)
      )
    });

    if (existingBot) {
      await db.update(telegramBots).set({
        username: botInfo.username || "",
        displayName: botInfo.first_name || "",
        photoUrl: photoUrl ?? existingBot.photoUrl,
        tokenEncrypted,
        secretToken,
        buttonText: buttonName,
        updatedAt: new Date()
      }).where(eq(telegramBots.id, existingBot.id));
    } else {
      await db.insert(telegramBots).values({
        storeId: store.id,
        botId: botTelegramId,
        username: botInfo.username || "",
        displayName: botInfo.first_name || "",
        photoUrl: photoUrl ?? null,
        tokenEncrypted,
        secretToken,
        buttonText: buttonName,
        status: "active"
      });
    }
  } else if (existingBotId) {
    // --- No new token provided: re-register webhook and update menu button ---
    const existingBot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.id, existingBotId)
    });
    if (existingBot) {
      const currentToken = decrypt(existingBot.tokenEncrypted);
      const botService = new TelegramBotService(currentToken);

      let secretToken = existingBot.secretToken;
      if (!secretToken) {
        secretToken = crypto.randomBytes(32).toString("hex");
      }

      const photoUrl = await botService.getProfilePhotoUrl();

      await db.update(telegramBots).set({ 
        secretToken,
        buttonText: buttonName,
        photoUrl: photoUrl ?? existingBot.photoUrl,
        updatedAt: new Date()
      }).where(eq(telegramBots.id, existingBot.id));

      const webhookUrl = `${cleanWebhookUrl}?botId=${existingBot.botId}`;
      await botService.setWebhook(webhookUrl, secretToken);

      await botService.setChatMenuButton({
        type: "web_app",
        text: buttonName,
        web_app: { url: miniAppUrl }
      });
    }
  } else {
    throw new Error("Token do bot é obrigatório para adicionar um novo bot.");
  }

  revalidatePath("/seller/store");
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

