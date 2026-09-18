"use server";

import crypto from "crypto";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export async function saveBotAction(formData: FormData) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

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

    // 3. Set Webhook automatically with clean URL and secret_token
    await botService.setWebhook(cleanWebhookUrl, secretToken);

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
        await db.update(telegramBots).set({ secretToken }).where(eq(telegramBots.id, existingBot.id));
      }

      await botService.setWebhook(cleanWebhookUrl, secretToken);

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
