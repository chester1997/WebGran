"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots, stores, themes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/encryption";

import { TelegramBotService } from "@/lib/telegram/bot";
import { TelegramError } from "@/lib/telegram/validation";

export async function connectTelegramBot(prevState: unknown, formData: FormData) {
  try {
    const user = await requireSeller();

    const token = formData.get("token") as string;
    if (!token) {
      return { success: false, error: "O Token é obrigatório." };
    }

    // Call Telegram API via Service Layer
    const botService = new TelegramBotService(token);
    const botUser = await botService.getMe();

    // Attempt to get description
    let botDescription = "";
    try {
      const descRes = await botService.getMyDescription();
      botDescription = descRes?.description || "";
    } catch (e) {
      console.log("Could not fetch bot description");
    }

    const tokenEncrypted = encrypt(token);
    const botIdStr = botUser.id.toString();

    // Check if this bot is already connected anywhere
    const existingBot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.botId, botIdStr),
      with: { store: true }
    });

    let targetStoreId: string;

    if (existingBot) {
      if (existingBot.store.ownerId !== user.id) {
        return { success: false, error: "Este bot já está conectado a outra loja no WebGran." };
      }
      targetStoreId = existingBot.storeId;
    } else {
      // Find the Studio theme
      const studioTheme = await db.query.themes.findFirst({
        where: eq(themes.name, 'Studio')
      });
      const studioThemeId = studioTheme?.id || null;

      // Check if user already has a store
      let store = await db.query.stores.findFirst({
        where: eq(stores.ownerId, user.id)
      });

      if (!store) {
        // Create store automatically
        const newStore = await db.insert(stores).values({
          ownerId: user.id,
          name: botUser.first_name,
          slug: botUser.username?.toLowerCase() || `loja-${botIdStr}`,
          description: botDescription,
          themeId: studioThemeId,
          status: 'active'
        }).returning();
        store = newStore[0];
      } else {
        // Update existing store to match bot identity
        await db.update(stores).set({
          name: botUser.first_name,
          description: botDescription || store.description,
          themeId: studioThemeId || store.themeId,
          updatedAt: new Date()
        }).where(eq(stores.id, store.id));
      }
      targetStoreId = store.id;
    }

    // Set Webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const webhookUrl = `${appUrl}/api/telegram/webhook?botId=${botIdStr}`;
    await botService.setWebhook(webhookUrl);

    // Set Menu Button
    let storeSlug = "";
    if (existingBot) {
      const dbStore = await db.query.stores.findFirst({ where: eq(stores.id, targetStoreId) });
      storeSlug = dbStore?.slug || "";
    } else {
      storeSlug = botUser.username?.toLowerCase() || `loja-${botIdStr}`;
    }
    
    if (storeSlug) {
      await botService.setChatMenuButton({
        type: "web_app",
        text: "Abrir Loja",
        web_app: {
          url: `${appUrl}/miniapp/${storeSlug}`
        }
      }).catch(err => console.error("Falha ao definir menu button:", err));
    }

    if (existingBot) {
      await db.update(telegramBots).set({
        username: botUser.username || "",
        displayName: botUser.first_name,
        tokenEncrypted,
        status: 'active',
        updatedAt: new Date()
      }).where(eq(telegramBots.id, existingBot.id));
    } else {
      await db.insert(telegramBots).values({
        storeId: targetStoreId,
        botId: botIdStr,
        username: botUser.username || "",
        displayName: botUser.first_name,
        tokenEncrypted,
        status: 'active'
      });
    }

    revalidatePath("/seller/bot");
    revalidatePath("/seller/store");
    revalidatePath("/seller");
    return { success: true, error: null };
  } catch (e: unknown) {
    if (e instanceof TelegramError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: "Erro interno: " + e.message };
    }
    return { success: false, error: "Ocorreu um erro inesperado." };
  }
}

export async function disconnectTelegramBot() {
  try {
    await requireSeller();
    const store = await getCurrentStore();
    if (!store) return;

    // Delete webhook before removing from db
    const existing = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });

    if (existing) {
      // Need token to delete webhook, which is encrypted
      const { decrypt } = await import("@/lib/encryption");
      const plainToken = decrypt(existing.tokenEncrypted);
      const botService = new TelegramBotService(plainToken);
      await botService.deleteWebhook().catch(err => console.error("Falha ao remover webhook:", err));
      
      await db.delete(telegramBots).where(eq(telegramBots.id, existing.id));
      revalidatePath("/seller/bot");
    }
  } catch (e) {
    console.error("Erro ao desconectar bot:", e);
  }
}
