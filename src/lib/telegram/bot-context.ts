import { db } from "@/db";
import { telegramBots, stores } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getStoreBySlug } from "@/lib/store-cache";

export interface ResolveBotContextParams {
  storeSlug: string;
  urlBotParam?: string | string[] | null;
  session?: {
    storeId?: string;
    originBotId?: string | null;
    originBotUsername?: string | null;
  } | null;
}

export interface ResolvedBotContext {
  originBotId: string | null;
  originBotUsername: string | null;
  isDivergent: boolean;
  source: "session" | "url" | "single_bot_fallback" | "none";
}

/**
 * Resolve o contexto de bot de forma segura e estrita para o Mini App:
 * - Valida existência do bot.
 * - Valida vínculo exclusivo com a loja correspondente (previne acesso cruzado).
 * - Valida status ativo do bot.
 * - Valida compatibilidade com a sessão autenticada (rejeita divergências e spoofing).
 * - Fallback de bot único estrito: acionado somente se NENHUM bot foi informado na URL e a loja possuir EXATAMENTE 1 bot ativo.
 */
export async function resolveSafeOriginBotContext(
  params: ResolveBotContextParams
): Promise<ResolvedBotContext> {
  const { storeSlug, urlBotParam, session } = params;

  if (!storeSlug) {
    return { originBotId: null, originBotUsername: null, isDivergent: false, source: "none" };
  }

  // 1. Resolver loja alvo
  const store = await getStoreBySlug(storeSlug);
  if (!store) {
    return { originBotId: null, originBotUsername: null, isDivergent: false, source: "none" };
  }

  // Sanitizar parâmetro b da URL (suporta string ou primeiro elemento de array)
  let rawUrlBot: string | null = null;
  if (Array.isArray(urlBotParam)) {
    rawUrlBot = urlBotParam[0] ? String(urlBotParam[0]).trim() : null;
  } else if (typeof urlBotParam === "string") {
    rawUrlBot = urlBotParam.trim() || null;
  }

  // 2. Se o usuário já possui sessão autenticada com originBotId
  if (session?.originBotId) {
    // Validar se a sessão pertence à mesma loja (rejeitar acesso cruzado)
    if (session.storeId && session.storeId !== store.id) {
      return { originBotId: null, originBotUsername: null, isDivergent: true, source: "none" };
    }

    // Se a URL informou um bot, validar compatibilidade
    if (rawUrlBot) {
      // Buscar o bot informado na URL para comparar com a sessão
      const urlBotRecord = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.storeId, store.id),
          eq(telegramBots.status, "active"),
          or(eq(telegramBots.id, rawUrlBot), eq(telegramBots.botId, rawUrlBot))
        ),
        columns: { id: true, botId: true, username: true, displayName: true },
      });

      // Se o bot da URL não existe, não pertence à loja ou difere da sessão autenticada: DIVERGÊNCIA!
      if (!urlBotRecord || urlBotRecord.id !== session.originBotId) {
        return { originBotId: null, originBotUsername: null, isDivergent: true, source: "none" };
      }
    }

    // Sessão válida e compatível
    return {
      originBotId: session.originBotId,
      originBotUsername: session.originBotUsername || null,
      isDivergent: false,
      source: "session",
    };
  }

  // 3. Sem sessão autenticada prévia (ex: 1ª requisição HTTP inicial pelo botão do Telegram)
  if (rawUrlBot) {
    // Validar o bot informado na URL: deve existir, pertencer a esta loja e estar ativo
    const urlBotRecord = await db.query.telegramBots.findFirst({
      where: and(
        eq(telegramBots.storeId, store.id),
        eq(telegramBots.status, "active"),
        or(eq(telegramBots.id, rawUrlBot), eq(telegramBots.botId, rawUrlBot))
      ),
      columns: { id: true, username: true, displayName: true },
    });

    if (urlBotRecord) {
      return {
        originBotId: urlBotRecord.id,
        originBotUsername: urlBotRecord.username || urlBotRecord.displayName || null,
        isDivergent: false,
        source: "url",
      };
    }

    // Bot informado na URL é inválido, inativo ou de outra loja -> REJEIÇÃO ESTRITA
    // Não aplica fallback silencioso para evitar mascarar URLs forjadas ou corrompidas
    return {
      originBotId: null,
      originBotUsername: null,
      isDivergent: false,
      source: "none",
    };
  }

  // 4. Nenhum bot informado na URL e nenhuma sessão (ex: acesso direto à URL da loja)
  // REGRA 5: Fallback de Bot Único
  // - Considera somente bots ativos e pertencentes à loja.
  // - Nunca escolhe arbitrariamente entre vários bots.
  // - Nunca substitui silenciosamente um bot informado, mas inválido.
  const activeBots = await db.query.telegramBots.findMany({
    where: and(
      eq(telegramBots.storeId, store.id),
      eq(telegramBots.status, "active")
    ),
    columns: { id: true, username: true, displayName: true },
    limit: 2, // Basta checar se há exatamente 1 ou mais de 1
  });

  if (activeBots.length === 1) {
    return {
      originBotId: activeBots[0].id,
      originBotUsername: activeBots[0].username || activeBots[0].displayName || null,
      isDivergent: false,
      source: "single_bot_fallback",
    };
  }

  // Loja com 0 bots ou com múltiplos bots ativos: não escolhe arbitrariamente
  return {
    originBotId: null,
    originBotUsername: null,
    isDivergent: false,
    source: "none",
  };
}

