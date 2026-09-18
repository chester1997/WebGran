import { TelegramBotService } from "@/lib/telegram/bot";

export interface DeliveryTestResult {
  success: boolean;
  chatName?: string;
  chatType?: string;
  error?: string;
}

export class TelegramDeliveryService {
  /**
   * Tests if the bot is connected and has permission in the target Telegram chat/group.
   */
  static async validateBotAndChatPermission(
    botToken: string,
    telegramChatId: string
  ): Promise<DeliveryTestResult> {
    try {
      const botService = new TelegramBotService(botToken);
      const chatInfo = await botService.getChat(telegramChatId);
      
      return {
        success: true,
        chatName: chatInfo.title || chatInfo.username || `Chat ${telegramChatId}`,
        chatType: chatInfo.type,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Bot sem permissão ou grupo/canal não encontrado.",
      };
    }
  }

  /**
   * Creates a single-use or temporary invite link for a Telegram group/channel.
   */
  static async createTelegramInvite(
    botToken: string,
    telegramChatId: string,
    productTitle: string
  ): Promise<{ inviteLink: string }> {
    const botService = new TelegramBotService(botToken);
    
    try {
      const linkObj = await botService.createChatInviteLink(
        telegramChatId,
        `Acesso WebGran - ${productTitle}`,
        1 // member_limit = 1 (single-use link associated to the buyer)
      );
      return { inviteLink: linkObj.invite_link };
    } catch (err: any) {
      console.warn(`[TelegramDeliveryService] Dynamic invite link failed for ${telegramChatId}, falling back to channel link:`, err);
      // Fallback format if member limit invite creation fails
      const cleanedId = String(telegramChatId).replace('-100', '');
      return { inviteLink: `https://t.me/c/${cleanedId}` };
    }
  }

  /**
   * Sends the automated delivery message directly to the TelegramCustomer.
   */
  static async deliverToCustomer(
    botToken: string,
    telegramUserId: string,
    productTitle: string,
    deliveryUrl: string,
    storeSlug?: string
  ): Promise<boolean> {
    const botService = new TelegramBotService(botToken);
    
    const msgText = `✅ *Pagamento confirmado!*\n\nSeu acesso para *${productTitle}* está pronto.\n\nClique no botão abaixo para acessar seu conteúdo.`;
    
    const inlineKeyboard: Array<Array<{ text: string; url?: string; web_app?: { url: string } }>> = [
      [{ text: "🎬 Acessar conteúdo", url: deliveryUrl }]
    ];

    if (storeSlug) {
      let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
      if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
      if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
        rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
      }
      const appUrl = rawAppUrl.replace(/\/+$/, "");
      inlineKeyboard.push([{ text: "📦 Meus Acessos", web_app: { url: `${appUrl}/miniapp/${storeSlug}/accesses` } }]);
    }

    await botService.sendMessage(telegramUserId, msgText, { inline_keyboard: inlineKeyboard });
    return true;
  }
}
