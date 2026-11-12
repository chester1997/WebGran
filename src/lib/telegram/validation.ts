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

export interface ValidateInitDataOptions {
  /**
   * Max age in seconds for the auth_date parameter.
   * Defaults to 86400 (24 hours) to prevent replay attacks.
   */
  maxAgeSeconds?: number;
}

/**
 * Validates Telegram Web App initData according to the official Telegram protocol.
 * Checks HMAC-SHA256 signature and auth_date freshness against replay attacks.
 *
 * @param initData The raw initData string from Telegram.WebApp
 * @param botToken The bot token used to validate
 * @param options Optional validation options (e.g. maxAgeSeconds)
 */
export function validateInitData(
  initData: string,
  botToken: string,
  options?: ValidateInitDataOptions
): boolean {
  if (!initData || !botToken) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  if (!hash) return false;

  // Replay Attack Protection: verify auth_date freshness
  const maxAge = options?.maxAgeSeconds ?? 86400; // 24 hours
  if (maxAge > 0) {
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) return false;
    const authDate = parseInt(authDateStr, 10);
    if (isNaN(authDate)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAge || authDate > now + 300) {
      // Expired or clock skew > 5 minutes in future
      return false;
    }
  }

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

  // Constant-time comparison to prevent timing attacks
  try {
    const bufA = Buffer.from(calculatedHash, 'hex');
    const bufB = Buffer.from(hash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
