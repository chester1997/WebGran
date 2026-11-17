export interface CachedAvatar {
  buffer: Buffer;
  contentType: string;
  fileUniqueId?: string;
  etag: string;
  expiresAt: number;
}

// In-memory cache for bot avatar images: bot.id (UUID) -> CachedAvatar
export const avatarCache = new Map<string, CachedAvatar>();
// In-flight promises to deduplicate concurrent requests for the same bot
export const inFlightRequests = new Map<string, Promise<CachedAvatar | null>>();
// Negative cache for bots that genuinely don't have a photo on Telegram (prevents Telegram spam)
export const negativeCache = new Map<string, number>();

// Cache TTL: 3 minutos em memória para verificação leve de alterações no Telegram
export const CACHE_TTL_MS = 3 * 60 * 1000;
// Negative cache TTL: 3 minutos (re-tentável via &r=1)
export const NEGATIVE_TTL_MS = 3 * 60 * 1000;

/**
 * Função utilitária para invalidar cache do avatar de um bot
 */
export function invalidateBotAvatarCache(botIdentifier: string) {
  avatarCache.delete(botIdentifier);
  negativeCache.delete(botIdentifier);
}
