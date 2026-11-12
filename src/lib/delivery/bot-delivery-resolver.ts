import { db } from "@/db";
import { telegramBots, telegramBotChats } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export interface ResolveDeliveryBotParams {
  storeId: string;
  botId?: string | null;           // Bot proprietário do produto
  originBotId?: string | null;     // Bot por onde a compra foi originada
  deliveryType?: string | null;
  deliveryValue?: string | null;
}

export class BotDeliveryResolver {
  /**
   * Deterministic multi-bot delivery resolver adhering strictly to:
   *
   * 1. ENTREGA POR LINK:
   *    - Static URL or External Delivery:
   *      a) If originBotId is provided and active in this store: delivers via originBot (buyer's touchpoint).
   *      b) Otherwise, if botId (owner) is provided and active: delivers via owner bot.
   *      c) Otherwise: returns store's primary active bot or null without failing.
   *    - Does NOT require Telegram channel administrator privileges.
   *
   * 2. ENTREGA POR LIBERAÇÃO VIA BOT (Dynamic Telegram Chat/Channel):
   *    - Ex: deliveryType === 'telegram' with numeric chatId (e.g. -100...).
   *    - Case A: originBotId is provided:
   *      * Checks if originBot is active and has administrator permissions (canInviteUsers) in telegramBotChats.
   *      * STRICT: If originBot lacks permission -> THROWS EXPLICIT ERROR. NEVER silently falls back to owner bot.
   *    - Case B: originBotId is null/undefined:
   *      * If botId is specified -> checks if owner bot is active and administers the chat.
   *      * If botId is null -> checks unique active bot administering the chat in this store.
   *      * If 0 bots have permission -> throws explicit missing permission error.
   *      * If >1 bots have permission and botId is null -> throws explicit ambiguity error.
   */
  static async resolveBotForDelivery(params: ResolveDeliveryBotParams): Promise<any> {
    const { storeId, botId, originBotId, deliveryType, deliveryValue } = params;

    const isDynamicTelegramDelivery =
      (deliveryType === 'telegram' || deliveryType === 'TELEGRAM_CHAT') &&
      deliveryValue &&
      !String(deliveryValue).trim().startsWith('http://') &&
      !String(deliveryValue).trim().startsWith('https://');

    // =========================================================================
    // MODALIDADE 1: ENTREGA POR LINK OU EXTERNAL (NÃO DEPENDE DE ADMIN NO CANAL)
    // =========================================================================
    if (!isDynamicTelegramDelivery) {
      // 1.1 Tentar usar o Bot de Origem da compra
      if (originBotId) {
        const originBot = await db.query.telegramBots.findFirst({
          where: and(
            eq(telegramBots.id, originBotId),
            eq(telegramBots.storeId, storeId)
          )
        });

        if (originBot && originBot.status === 'active') {
          return originBot;
        }
      }

      // 1.2 Tentar usar o Bot Proprietário do produto
      if (botId) {
        const ownerBot = await db.query.telegramBots.findFirst({
          where: and(
            eq(telegramBots.id, botId),
            eq(telegramBots.storeId, storeId)
          )
        });

        if (ownerBot && ownerBot.status === 'active') {
          return ownerBot;
        }
      }

      // 1.3 Fallback geral para notificação de compra em entrega estática
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

    // =========================================================================
    // MODALIDADE 2: ENTREGA POR LIBERAÇÃO VIA BOT (EXIGE PERMISSÃO NO TELEGRAM)
    // =========================================================================
    const targetChatId = String(deliveryValue).trim();

    // 2.1 Compra originada por um Bot Receptor Específico
    if (originBotId) {
      const originBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, originBotId),
          eq(telegramBots.storeId, storeId)
        )
      });

      if (!originBot) {
        throw new Error(`Bot de origem da compra (${originBotId}) não encontrado ou não pertence a esta loja.`);
      }

      if (originBot.status !== 'active') {
        const botName = (originBot as any).username || (originBot as any).botUsername;
        const displayName = botName ? `@${botName}` : originBot.id;
        throw new Error(`Bot de origem da compra (${displayName}) está inativo nesta loja.`);
      }

      // Verificar permissão no canal/grupo de entrega
      const botChatMapping = await db.query.telegramBotChats.findFirst({
        where: and(
          eq(telegramBotChats.storeId, storeId),
          eq(telegramBotChats.botId, originBot.id),
          eq(telegramBotChats.telegramChatId, targetChatId),
          eq(telegramBotChats.isActive, true)
        )
      });

      const hasInvitePermission = botChatMapping &&
        (botChatMapping.botStatus === 'administrator' || botChatMapping.botStatus === 'creator') &&
        botChatMapping.canInviteUsers === true;

      if (!hasInvitePermission) {
        const botTag = originBot.username ? `@${originBot.username}` : originBot.id;
        throw new Error(
          `Falha na liberação de acesso: O bot receptor (${botTag}) não possui permissão de administrador para convidar usuários no canal/grupo (${targetChatId}). Venda bloqueada sem fallback silencioso.`
        );
      }

      return originBot;
    }

    // 2.2 Compra sem Bot de Origem (ex: Loja Geral ou Bot Proprietário Explícito)
    if (botId) {
      const explicitBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, botId),
          eq(telegramBots.storeId, storeId)
        )
      });

      if (!explicitBot) {
        throw new Error("Bot vinculado ao produto não encontrado ou não está ativo nesta loja. Bot não encontrado ou não pertence a esta loja.");
      }

      if (explicitBot.status !== 'active') {
        const botName = (explicitBot as any).username || (explicitBot as any).botUsername;
        const displayName = botName ? `@${botName}` : explicitBot.id;
        throw new Error(`Bot vinculado ao produto (${displayName}) está inativo nesta loja.`);
      }

      // Revalidação em tempo real: o bot proprietário precisa ter permissão no canal
      if (typeof db.query?.telegramBotChats?.findFirst === 'function') {
        const botChatMapping = await db.query.telegramBotChats.findFirst({
          where: and(
            eq(telegramBotChats.storeId, storeId),
            eq(telegramBotChats.botId, explicitBot.id),
            eq(telegramBotChats.telegramChatId, targetChatId),
            eq(telegramBotChats.isActive, true)
          )
        });

        if (botChatMapping) {
          const hasInvitePermission =
            (botChatMapping.botStatus === 'administrator' || botChatMapping.botStatus === 'creator') &&
            botChatMapping.canInviteUsers === true;

          if (!hasInvitePermission) {
            const botTag = explicitBot.username ? `@${explicitBot.username}` : explicitBot.id;
            throw new Error(
              `Falha na liberação de acesso: O bot vinculado (${botTag}) não possui permissão de administrador para convidar usuários no canal/grupo (${targetChatId}). Venda bloqueada sem fallback silencioso.`
            );
          }
        }
      }

      return explicitBot;
    }

    // 2.3 botId é NULL e originBotId é NULL: resolução por mapeamento em telegram_bot_chats
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
      } catch {
        mappings = [];
      }
    }

    const candidateBots: any[] = [];
    const seenBotIds = new Set<string>();

    for (const mapping of mappings) {
      let candidateBot = mapping.bot;

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
}
