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

  async sendMessage(chatId: string | number, text: string, replyMarkup?: any, parseMode: string = "Markdown"): Promise<unknown> {
    return telegramFetch(this.token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: replyMarkup
    });
  }

  async setChatMenuButton(menuButton: any): Promise<boolean> {
    return telegramFetch<boolean>(this.token, 'setChatMenuButton', {
      menu_button: menuButton
    });
  }

  async sendPhoto(_chatId: string | number, _photo: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }

  async sendVideo(_chatId: string | number, _video: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }

  async editMessage(_chatId: string | number, _messageId: number, _text: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }

  async answerCallbackQuery(_callbackQueryId: string, _text?: string): Promise<unknown> {
    throw new Error("Not implemented yet");
  }
}
