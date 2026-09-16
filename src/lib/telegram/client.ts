import { TelegramResponse } from './types';
import { TelegramError, TelegramInvalidTokenError, TelegramUnavailableError } from './validation';

export async function telegramFetch<T>(token: string, method: string, payload?: Record<string, unknown>): Promise<T> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  
  try {
    const res = await fetch(url, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = (await res.json()) as TelegramResponse<T>;

    if (!data.ok) {
      if (res.status === 401 || res.status === 404) {
        throw new TelegramInvalidTokenError();
      }
      throw new TelegramError(data.description || 'Erro na API do Telegram', data.error_code);
    }

    return data.result as T;
  } catch (error: unknown) {
    if (error instanceof TelegramError) {
      throw error;
    }
    // Consider any other fetch error as network/unavailable
    throw new TelegramUnavailableError();
  }
}
