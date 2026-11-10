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

  async setWebhook(url: string, secretToken?: string, allowedUpdates?: string[]): Promise<boolean> {
    const payload: any = { 
      url, 
      secret_token: secretToken,
      allowed_updates: allowedUpdates || ["message", "callback_query", "my_chat_member", "chat_member"]
    };
    return telegramFetch<boolean>(this.token, 'setWebhook', payload);
  }

  async deleteWebhook(): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'deleteWebhook');
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    replyMarkup?: any,
    parseMode?: string,
    linkPreviewOptions?: any
  ): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup
    };
    if (parseMode) payload.parse_mode = parseMode;
    if (linkPreviewOptions) payload.link_preview_options = linkPreviewOptions;
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

  async sendPhotoUpload(chatId: string | number, fileBuffer: Buffer | Uint8Array, fileName: string, caption?: string): Promise<unknown> {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('photo', new Blob([fileBuffer as any]), fileName);
    if (caption) fd.append('caption', caption);
    return telegramFetch(this.token, 'sendPhoto', fd);
  }

  async sendVoice(chatId: string | number, voiceBuffer: Buffer | Uint8Array, fileName: string = 'voice.ogg', caption?: string): Promise<unknown> {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('voice', new Blob([voiceBuffer as any], { type: 'audio/ogg' }), fileName);
    if (caption) fd.append('caption', caption);
    return telegramFetch(this.token, 'sendVoice', fd);
  }

  async sendDocument(chatId: string | number, docBuffer: Buffer | Uint8Array, fileName: string, caption?: string): Promise<unknown> {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('document', new Blob([docBuffer as any]), fileName);
    if (caption) fd.append('caption', caption);
    return telegramFetch(this.token, 'sendDocument', fd);
  }

  async sendVideo(
    chatId: string | number,
    video: string,
    caption?: string,
    replyMarkup?: any,
    parseMode?: string
  ): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      video,
      reply_markup: replyMarkup,
    };
    if (caption) payload.caption = caption;
    if (parseMode) payload.parse_mode = parseMode;
    return telegramFetch(this.token, 'sendVideo', payload);
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

  async createChatInviteLink(chatId: string | number, name?: string, memberLimit: number = 1, expireDate?: number): Promise<{ invite_link: string; expire_date?: number }> {
    const payload: any = {
      chat_id: chatId,
      name: name || 'Acesso WebGran',
      member_limit: memberLimit,
    };
    if (expireDate) payload.expire_date = expireDate;
    return telegramFetch<{ invite_link: string; expire_date?: number }>(this.token, 'createChatInviteLink', payload);
  }

  async revokeChatInviteLink(chatId: string | number, inviteLink: string): Promise<any> {
    return telegramFetch<any>(this.token, 'revokeChatInviteLink', {
      chat_id: chatId,
      invite_link: inviteLink,
    });
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



  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup?: any,
    parseMode?: string,
    linkPreviewOptions?: any
  ): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup,
    };
    if (parseMode) payload.parse_mode = parseMode;
    if (linkPreviewOptions) payload.link_preview_options = linkPreviewOptions;
    return telegramFetch(this.token, 'editMessageText', payload);
  }

  async editMessageCaption(
    chatId: string | number,
    messageId: number,
    caption?: string,
    replyMarkup?: any,
    parseMode?: string
  ): Promise<unknown> {
    const payload: any = {
      chat_id: chatId,
      message_id: messageId,
      caption,
      reply_markup: replyMarkup,
    };
    if (parseMode) payload.parse_mode = parseMode;
    return telegramFetch(this.token, 'editMessageCaption', payload);
  }

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  async editMessage(
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup?: any,
    parseMode?: string
  ): Promise<unknown> {
    return this.editMessageText(chatId, messageId, text, replyMarkup, parseMode);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<unknown> {
    return telegramFetch(this.token, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }
}
