import crypto from 'crypto';

export class TelegramError extends Error {
  public code?: number;
  
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
  }
}

export class TelegramInvalidTokenError extends TelegramError {
  constructor() {
    super('Token inválido ou revogado.', 401);
    this.name = 'TelegramInvalidTokenError';
  }
}

export class TelegramUnavailableError extends TelegramError {
  constructor() {
    super('A API do Telegram está indisponível no momento.', 503);
    this.name = 'TelegramUnavailableError';
  }
}

/**
 * Validates Telegram Web App initData
 * @param initData The raw initData string from Telegram.WebApp
 * @param botToken The bot token used to validate
 */
export function validateInitData(initData: string, botToken: string): boolean {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  if (!hash) return false;

  urlParams.delete('hash');
  const keys = Array.from(urlParams.keys()).sort();
  
  const dataCheckString = keys
    .map(key => `${key}=${urlParams.get(key)}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
    
  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}
