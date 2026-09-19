import { TelegramBotService } from "@/lib/telegram/bot";

export interface DeliveryTestResult {
  success: boolean;
  chatName?: string;
  chatType?: string;
  error?: string;
}

export class TelegramDeliveryService {
  /**
   * Tests if the bot is connected and has administrator permissions in the target Telegram chat/group.
   */
  static async validateBotAndChatPermission(
    botToken: string,
    telegramChatId: string,
    botId?: string
  ): Promise<DeliveryTestResult> {
    try {
      const botService = new TelegramBotService(botToken);
      
      // 1. Validate Chat Exists
      const chatInfo = await botService.getChat(telegramChatId);
      
      // 2. Resolve bot ID if not provided
      let targetBotId = botId;
      if (!targetBotId) {
        const me = await botService.getMe();
        targetBotId = String(me.id);
      }

      // 3. Check Bot Membership and Admin Rights in Chat
      let botMember: any = null;
      try {
        botMember = await botService.getChatMember(telegramChatId, targetBotId);
      } catch (err: any) {
        return {
          success: false,
          error: `O bot não é membro do grupo/canal (${telegramChatId}): ${err.message}`,
        };
      }

      const isAdmin = botMember.status === 'administrator' || botMember.status === 'creator';
      const canInvite = botMember.status === 'creator' || botMember.can_invite_users === true;

      if (!isAdmin) {
        return {
          success: false,
          error: `O bot não possui privilégios de Administrador no grupo/canal (${telegramChatId}).`,
        };
      }

      if (!canInvite) {
        return {
          success: false,
          error: `O bot é Administrador no grupo/canal (${telegramChatId}), mas NÃO possui a permissão de Convidar Usuários (can_invite_users).`,
        };
      }

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
   * Checks if the buyer is already a member of the target group/channel.
   */
  static async checkBuyerMembership(
    botToken: string,
    telegramChatId: string,
    telegramUserId: string
  ): Promise<boolean> {
    try {
      const botService = new TelegramBotService(botToken);
      const member = await botService.getChatMember(telegramChatId, telegramUserId);
      const status = member?.status;
      return status === 'member' || status === 'administrator' || status === 'creator';
    } catch {
      return false;
    }
  }

  /**
   * Creates a single-use invite link for the target group/channel.
   */
  static async createTelegramInvite(
    botToken: string,
    telegramChatId: string,
    productTitle: string,
    orderId?: string,
    expireDateTimestamp?: number
  ): Promise<{ inviteLink: string }> {
    const botService = new TelegramBotService(botToken);
    
    const linkName = orderId ? `WebGran-${orderId.slice(0, 8)}` : `Acesso - ${productTitle.slice(0, 15)}`;

    const linkObj = await botService.createChatInviteLink(
      telegramChatId,
      linkName,
      1, // single-use link for the buyer
      expireDateTimestamp
    );

    if (!linkObj || !linkObj.invite_link) {
      throw new Error(`Falha ao gerar link de convite único para o grupo ${telegramChatId}.`);
    }

    return { inviteLink: linkObj.invite_link };
  }

  /**
   * Sends the automated payment confirmation message directly to the buyer's private bot chat using telegramUserId.
   */
  static async sendPaymentConfirmationMessage(
    botToken: string,
    telegramUserId: string,
    productTitle: string,
    inviteLink: string,
    isAlreadyMember: boolean = false,
    deliveryFailed: boolean = false,
    storeSlug?: string
  ): Promise<boolean> {
    const botService = new TelegramBotService(botToken);
    
    let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
    if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
    if (rawAppUrl.includes("webgran.online") && !rawAppUrl.includes("www.webgran.online")) {
      rawAppUrl = rawAppUrl.replace("webgran.online", "www.webgran.online");
    }
    const appUrl = rawAppUrl.replace(/\/+$/, "");

    let msgText = "";
    let inlineKeyboard: Array<Array<{ text: string; url?: string; web_app?: { url: string } }>> = [];

    if (deliveryFailed) {
      msgText = `🎉 *PAGAMENTO CONFIRMADO!*\n\nSeu pagamento foi recebido.\n\n⚠️ Estamos finalizando a liberação do seu acesso.\n\nVocê não precisa pagar novamente.`;
      inlineKeyboard.push([
        { 
          text: "🔄 TENTAR LIBERAR ACESSO", 
          web_app: { url: storeSlug ? `${appUrl}/miniapp/${storeSlug}/accesses` : `${appUrl}/miniapp` } 
        }
      ]);
    } else if (isAlreadyMember) {
      msgText = `🎉 *PAGAMENTO CONFIRMADO!*\n\n📦 *${productTitle}*\n\nVocê já possui acesso ao conteúdo.`;
      inlineKeyboard.push([
        { text: "📺 ACESSAR CONTEÚDO", url: inviteLink }
      ]);
    } else {
      msgText = `🎉 *PAGAMENTO CONFIRMADO!*\n\nSeu pagamento foi identificado com sucesso.\n\n📦 *Produto:*\n${productTitle}\n\n🔐 Seu acesso foi liberado.\n\nClique abaixo para acessar:`;
      inlineKeyboard.push([
        { text: "📺 ACESSAR CONTEÚDO", url: inviteLink }
      ]);
    }

    await botService.sendMessage(telegramUserId, msgText, { inline_keyboard: inlineKeyboard }, "Markdown");
    return true;
  }

  /**
   * Alias for backward compatibility.
   */
  static async deliverToCustomer(
    botToken: string,
    telegramUserId: string,
    productTitle: string,
    deliveryUrl: string,
    storeSlug?: string
  ): Promise<boolean> {
    return this.sendPaymentConfirmationMessage(
      botToken,
      telegramUserId,
      productTitle,
      deliveryUrl,
      false,
      false,
      storeSlug
    );
  }
}
