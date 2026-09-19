import { db } from "@/db";
import { telegramBots, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

export interface ProductChatValidationResult {
  success: boolean;
  code?: 'BOT_MISSING' | 'CHAT_NOT_FOUND' | 'NOT_ADMIN' | 'NO_INVITE_PERM' | 'INVALID_INPUT' | 'UNKNOWN_ERROR';
  error?: string;
  chat?: {
    id: string;
    title: string;
    type: string;
  };
  bot?: {
    username: string;
  };
  permission?: string;
  canInvite?: boolean;
}

/**
 * Validates Telegram Chat ID and Bot Permissions strictly according to Phase 10 requirements.
 * Backend execution: Store -> TelegramBot -> Decrypted Token -> getMe -> getChat -> getChatMember.
 */
export async function validateProductTelegramChat(
  storeId: string,
  deliveryValue: string
): Promise<ProductChatValidationResult> {
  const cleanChatId = deliveryValue ? String(deliveryValue).trim() : "";

  if (!cleanChatId) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      error: "❌ ID do grupo/canal não foi fornecido.",
    };
  }

  // 1. Resolve store bot
  const botRecord = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, storeId)
  });

  if (!botRecord || !botRecord.tokenEncrypted) {
    return {
      success: false,
      code: 'BOT_MISSING',
      error: "❌ Nenhum bot do Telegram está configurado para esta loja. Vincule um bot nas configurações antes de cadastrar produtos.",
    };
  }

  try {
    const token = decrypt(botRecord.tokenEncrypted);
    const botService = new TelegramBotService(token);

    // 2. Call getMe()
    const me = await botService.getMe();
    const botId = String(me.id);
    const botUsername = me.username || botRecord.username || "bot";

    // 3. Call getChat(deliveryValue)
    let chatInfo: any;
    try {
      chatInfo = await botService.getChat(cleanChatId);
    } catch (err: any) {
      console.warn(`[validateProductTelegramChat] getChat(${cleanChatId}) failed:`, err.message);
      return {
        success: false,
        code: 'CHAT_NOT_FOUND',
        error: "❌ Grupo/canal não encontrado\n\nO bot da loja não conseguiu localizar o grupo/canal informado. Verifique se o ID está correto e se o bot desta loja está dentro do grupo/canal.",
      };
    }

    if (!chatInfo) {
      return {
        success: false,
        code: 'CHAT_NOT_FOUND',
        error: "❌ Grupo/canal não encontrado\n\nO bot da loja não conseguiu localizar o grupo/canal informado. Verifique se o ID está correto e se o bot desta loja está dentro do grupo/canal.",
      };
    }

    // 4. Call getChatMember(deliveryValue, botId)
    let botMember: any;
    try {
      botMember = await botService.getChatMember(cleanChatId, botId);
    } catch (err: any) {
      console.warn(`[validateProductTelegramChat] getChatMember(${cleanChatId}, ${botId}) failed:`, err.message);
      return {
        success: false,
        code: 'NOT_ADMIN',
        error: "❌ O bot não possui permissão de administrador neste grupo/canal.\n\nAdicione o bot como administrador e tente novamente.",
      };
    }

    const status = botMember?.status;
    const isAdmin = status === 'administrator' || status === 'creator';
    const canInvite = status === 'creator' || botMember?.can_invite_users === true;

    if (!isAdmin) {
      return {
        success: false,
        code: 'NOT_ADMIN',
        error: "❌ O bot não possui permissão de administrador neste grupo/canal.\n\nAdicione o bot como administrador e tente novamente.",
      };
    }

    if (!canInvite) {
      return {
        success: false,
        code: 'NO_INVITE_PERM',
        error: "❌ O bot é administrador, mas não possui permissão para convidar usuários.\n\nAtive a permissão de convidar usuários para que o WebGran possa liberar os acessos automaticamente.",
      };
    }

    const chatTitle = chatInfo.title || chatInfo.username || `Canal ${cleanChatId}`;

    return {
      success: true,
      chat: {
        id: cleanChatId,
        title: chatTitle,
        type: chatInfo.type || "channel",
      },
      bot: {
        username: botUsername,
      },
      permission: "Administrador",
      canInvite: true,
    };
  } catch (err: any) {
    console.error("[validateProductTelegramChat] Unexpected error:", err);
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      error: `❌ Erro ao validar o grupo/canal: ${err.message || "Falha na comunicação com o Telegram."}`,
    };
  }
}
