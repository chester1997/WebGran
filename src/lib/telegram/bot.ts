import { telegramFetch } from './client';
import { TelegramUser } from './types';

export class TelegramBotService {
  private token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error("Token não fornecido para o TelegramBotService.");
    }
    this.token = token;
  }

  async getMe(): Promise<TelegramUser> {
    return telegramFetch<TelegramUser>(this.token, 'getMe');
  }

  async getMyDescription(): Promise<{ description: string }> {
    return telegramFetch<{ description: string }>(this.token, 'getMyDescription');
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'setWebhook', { 
      url, 
      secret_token: secretToken 
    });
  }

  async deleteWebhook(): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'deleteWebhook');
  }

  async sendMessage(chatId: string | number, text: string, replyMarkup?: any, parseMode?: string): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup
    };
    if (parseMode) payload.parse_mode = parseMode;
    return telegramFetch(this.token, 'sendMessage', payload);
  }

  async sendPhoto(chatId: string | number, photo: string, caption?: string, replyMarkup?: any, parseMode?: string): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      photo,
      caption,
      reply_markup: replyMarkup
    };
    if (parseMode) payload.parse_mode = parseMode;
    return telegramFetch(this.token, 'sendPhoto', payload);
  }

  async setChatMenuButton(menuButton: any): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'setChatMenuButton', {
      menu_button: menuButton
    });
  }

  /**
   * Fetches the bot's profile photo URL.
   * Returns null if the bot has no photo.
   */
  async getProfilePhotoUrl(): Promise<string | null> {
    try {
      const me = await this.getMe();
      const photos = await telegramFetch<any>(this.token, 'getUserProfilePhotos', { user_id: me.id, limit: 1 });
      if (!photos?.photos?.length) return null;
      
      const fileId = photos.photos[0][0].file_id;
      const fileInfo = await telegramFetch<any>(this.token, 'getFile', { file_id: fileId });
      if (!fileInfo?.file_path) return null;
      
      // Extract token from the instance (use raw fetch URL)
      const token = this.token;
      return `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    } catch {
      return null;
    }
  }

  async createChatInviteLink(chatId: string | number, name?: string, memberLimit: number = 1): Promise<{ invite_link: string }> {
    return telegramFetch<{ invite_link: string }>(this.token, 'createChatInviteLink', {
      chat_id: chatId,
      name: name || 'Acesso WebGran',
      member_limit: memberLimit,
    });
  }

  async getChat(chatId: string | number): Promise<any> {
    return telegramFetch<any>(this.token, 'getChat', {
      chat_id: chatId,
    });
  }

  async sendVideo(_chatId: string | number, _video: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }

  async editMessage(_chatId: string | number, _messageId: number, _text: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<unknown> {
    return telegramFetch(this.token, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }
}
