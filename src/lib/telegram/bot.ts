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
   * Uses Telegram getChat API (primary for bot avatars) and getUserProfilePhotos as fallback.
   */
  async getProfilePhotoUrl(): Promise<string | null> {
    try {
      const me = await this.getMe();
      if (!me?.id) return null;

      let fileId: string | null = null;

      // Method 1: getChat (Official & reliable for Bot accounts on Telegram)
      try {
        const chatInfo = await telegramFetch<any>(this.token, 'getChat', { chat_id: me.id });
        if (chatInfo?.photo?.big_file_id || chatInfo?.photo?.small_file_id) {
          fileId = chatInfo.photo.big_file_id || chatInfo.photo.small_file_id;
        }
      } catch (err) {
        console.warn("[TelegramBotService] getChat photo error:", err);
      }

      // Method 2: getUserProfilePhotos (Fallback)
      if (!fileId) {
        try {
          const photos = await telegramFetch<any>(this.token, 'getUserProfilePhotos', { user_id: me.id, limit: 1 });
          if (photos?.photos?.length && photos.photos[0]?.length) {
            const sizes = photos.photos[0];
            fileId = sizes[sizes.length - 1].file_id; // Get highest resolution
          }
        } catch (err) {
          console.warn("[TelegramBotService] getUserProfilePhotos error:", err);
        }
      }

      if (!fileId) return null;

      const fileInfo = await telegramFetch<any>(this.token, 'getFile', { file_id: fileId });
      if (!fileInfo?.file_path) return null;

      return `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;
    } catch (err) {
      console.error("[TelegramBotService] Error in getProfilePhotoUrl:", err);
      return null;
    }
  }

  async createChatInviteLink(chatId: string | number, name?: string, memberLimit: number = 1, expireDate?: number): Promise<{ invite_link: string }> {
    const payload: any = {
      chat_id: chatId,
      name: name || 'Acesso WebGran',
      member_limit: memberLimit,
    };
    if (expireDate) payload.expire_date = expireDate;
    return telegramFetch<{ invite_link: string }>(this.token, 'createChatInviteLink', payload);
  }

  async getChat(chatId: string | number): Promise<any> {
    return telegramFetch<any>(this.token, 'getChat', {
      chat_id: chatId,
    });
  }

  async getChatMember(chatId: string | number, userId: string | number): Promise<any> {
    return telegramFetch<any>(this.token, 'getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  async banChatMember(chatId: string | number, userId: string | number, untilDate?: number, revokeMessages: boolean = false): Promise<boolean> {
    const payload: any = {
      chat_id: chatId,
      user_id: userId,
      revoke_messages: revokeMessages,
    };
    if (untilDate) payload.until_date = untilDate;
    return telegramFetch<boolean>(this.token, 'banChatMember', payload);
  }

  async unbanChatMember(chatId: string | number, userId: string | number, onlyIfBanned: boolean = true): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'unbanChatMember', {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: onlyIfBanned,
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
