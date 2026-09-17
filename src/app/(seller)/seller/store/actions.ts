"use server";

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const miniAppUrl = `${appUrl}/miniapp/${store.slug}`;

  const isRealToken = token && token.includes(":");

  if (isRealToken) {
    // --- Token provided: validate, register webhook, set menu button ---
    const botService = new TelegramBotService(token);

    // 1. Validate token with getMe
    const botInfo = await botService.getMe();
    const botTelegramId = String(botInfo.id);

    // 2. Set Webhook automatically (no manual BotFather config needed)
    const webhookUrl = `${appUrl}/api/telegram/webhook?botId=${botTelegramId}`;
    await botService.setWebhook(webhookUrl);

    // 3. Set the blue Menu Button automatically (no manual BotFather config needed)
    await botService.setChatMenuButton({
      type: "web_app",
      text: buttonName,
      web_app: { url: miniAppUrl }
    });

    const tokenEncrypted = encrypt(token);

    // 4. Upsert in DB
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
        tokenEncrypted,
        updatedAt: new Date()
      }).where(eq(telegramBots.id, existingBot.id));
    } else {
      await db.insert(telegramBots).values({
        storeId: store.id,
        botId: botTelegramId,
        username: botInfo.username || "",
        displayName: botInfo.first_name || "",
        tokenEncrypted,
        status: "active"
      });
    }
  } else if (existingBotId) {
    // --- No new token: just update the menu button text ---
    const existingBot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.id, existingBotId)
    });
    if (existingBot) {
      const currentToken = decrypt(existingBot.tokenEncrypted);
      const botService = new TelegramBotService(currentToken);
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
