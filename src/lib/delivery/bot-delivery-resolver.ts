import { db } from "@/db";
import { telegramBots, telegramBotChats } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export interface ResolveDeliveryBotParams {
  storeId: string;
  botId?: string | null;
  deliveryType?: string | null;
  deliveryValue?: string | null;
}

export class BotDeliveryResolver {
  /**
   * Deterministically resolves the exact bot required for product delivery.
   *
   * Rules:
   * 1. If product.botId is provided:
   *    - Must find that exact bot for the specified storeId.
   *    - Confirms status === 'active'.
   *    - If not found or inactive, throws a clear error. Never silently substitutes.
   *
   * 2. If product.botId is null/undefined AND it is a Telegram channel/chat delivery:
   *    - Queries telegram_bot_chats matching storeId, telegramChatId, and isActive = true.
   *    - Filters bots that are active and belong to this store.
   *    - If exactly 1 active bot is mapped: selects that bot.
   *    - If > 1 active bots are mapped: throws an explicit ambiguity error.
   *    - If 0 active bots are mapped: throws an explicit error indicating no bot administers the chat.
   *
   * 3. If product.botId is null/undefined AND it is NOT a Telegram channel/chat delivery
   *    (e.g., 'external' static link or 'product_video'):
   *    - Does not require a channel administrator bot.
   *    - For buyer notifications, attempts to find an active store bot deterministically (ordered by createdAt ASC).
   *    - If none exists, returns null without failing the external delivery.
   */
  static async resolveBotForDelivery(params: ResolveDeliveryBotParams): Promise<any> {
    const { storeId, botId, deliveryType, deliveryValue } = params;

    // 1. Explicit botId set on the product
    if (botId) {
      const explicitBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, botId),
          eq(telegramBots.storeId, storeId)
        )
      });

      if (!explicitBot) {
        throw new Error(`Bot vinculado ao produto (${botId}) não encontrado ou não pertence a esta loja.`);
      }

      if (explicitBot.status !== 'active') {
        const botName = (explicitBot as any).username || (explicitBot as any).botUsername;
        const displayName = botName ? `@${botName}` : explicitBot.id;
        throw new Error(`Bot vinculado ao produto (${displayName}) está inativo nesta loja.`);
      }

      return explicitBot;
    }

    // Determine if this is a dynamic Telegram channel/chat delivery requiring invite generation
    const isTelegramDelivery =
      (deliveryType === 'telegram' || deliveryType === 'TELEGRAM_CHAT') &&
      deliveryValue &&
      !String(deliveryValue).trim().startsWith('http://') &&
      !String(deliveryValue).trim().startsWith('https://');

    // 2. botId is NULL and it is a dynamic Telegram channel/chat delivery
    if (isTelegramDelivery) {
      const targetChatId = String(deliveryValue).trim();

      // Query telegram_bot_chats for mappings in this store
      let mappings: any[] = [];
      if (db.query?.telegramBotChats && typeof db.query.telegramBotChats.findMany === 'function') {
        try {
          mappings = await db.query.telegramBotChats.findMany({
            where: and(
              eq(telegramBotChats.storeId, storeId),
              eq(telegramBotChats.telegramChatId, targetChatId),
              eq(telegramBotChats.isActive, true)
            ),
            with: {
              bot: true
            }
          });
        } catch (err: any) {
          // Fallback query if with: { bot: true } is not supported by driver/mock
          try {
            mappings = await db.query.telegramBotChats.findMany({
              where: and(
                eq(telegramBotChats.storeId, storeId),
                eq(telegramBotChats.telegramChatId, targetChatId),
                eq(telegramBotChats.isActive, true)
              )
            });
          } catch {
            mappings = [];
          }
        }
      }

      // Filter candidate bots that are active and belong to this store
      const candidateBots: any[] = [];
      const seenBotIds = new Set<string>();

      for (const mapping of mappings) {
        let candidateBot = mapping.bot;

        // Fetch bot if relation not populated by mock/driver
        if (!candidateBot && mapping.botId) {
          candidateBot = await db.query.telegramBots.findFirst({
            where: and(
              eq(telegramBots.id, mapping.botId),
              eq(telegramBots.storeId, storeId)
            )
          });
        }

        if (
          candidateBot &&
          candidateBot.storeId === storeId &&
          candidateBot.status === 'active' &&
          !seenBotIds.has(candidateBot.id)
        ) {
          seenBotIds.add(candidateBot.id);
          candidateBots.push(candidateBot);
        }
      }

      if (candidateBots.length === 0) {
        throw new Error(`Nenhum bot ativo da loja está vinculado ao canal (${targetChatId}). Adicione o bot como administrador do canal ou vincule o bot ao produto.`);
      }

      if (candidateBots.length > 1) {
        const botNames = candidateBots.map(b => (b.username || b.botUsername) ? `@${b.username || b.botUsername}` : b.id).join(', ');
        throw new Error(`Ambiguidade na resolução de bots: múltiplos bots ativos (${botNames}) estão vinculados ao canal (${targetChatId}). Defina o bot diretamente no produto.`);
      }

      return candidateBots[0];
    }

    // 3. botId is NULL and it is an external link or video delivery
    // Static external delivery does not require a channel administrator bot.
    // Return the store's primary active bot if available for buyer notification, or null.
    try {
      const storeBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.storeId, storeId),
          eq(telegramBots.status, 'active')
        ),
        orderBy: (bots, { asc }) => [asc(bots.createdAt)]
      });

      return storeBot || null;
    } catch {
      return null;
    }
  }
}
