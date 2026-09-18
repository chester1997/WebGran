import { db } from "@/db";
import { telegramBots, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramError } from "./validation";

export class StoreResolver {
  /**
   * Resolves the Store and Bot based on secretToken header or botId query.
   */
  static async resolveFromSecretToken(secretToken: string) {
    const bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.secretToken, secretToken),
      with: {
        store: true,
      }
    });

    if (!bot || !bot.store) {
      throw new TelegramError("Loja não encontrada para este secret token.", 404);
    }

    const token = decrypt(bot.tokenEncrypted);

    return {
      bot,
      store: bot.store,
      token,
    };
  }

  /**
   * Resolves the Store and Bot based on a telegram botId.
   */
  static async resolveFromBotId(botId: string) {
    const bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.botId, botId),
      with: {
        store: true,
      }
    });

    if (!bot || !bot.store) {
      throw new TelegramError("Loja não encontrada para este bot.", 404);
    }

    const token = decrypt(bot.tokenEncrypted);

    return {
      bot,
      store: bot.store,
      token,
    };
  }

  /**
   * Resolves the Store and Bot based on the store slug.
   * Useful for Mini App initialization when we only have the slug.
   */
  static async resolveFromSlug(slug: string) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, slug),
      with: {
        bots: true,
      }
    });

    if (!store || !store.bots || store.bots.length === 0) {
      throw new TelegramError("Loja ou Bot nǜo encontrado.", 404);
    }

    const bot = store.bots[0];
    const token = decrypt(bot.tokenEncrypted);

    return {
      bot,
      store,
      token,
    };
  }
}
