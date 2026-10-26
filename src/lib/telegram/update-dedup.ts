/**
 * Telegram Webhook Update Deduplication Service
 * Prevents processing the same Telegram update_id multiple times during network retries.
 */

const processedUpdates = new Map<number, number>();
const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds

export function isDuplicateTelegramUpdate(updateId?: number | null): boolean {
  if (!updateId || typeof updateId !== "number") {
    return false;
  }

  const now = Date.now();

  // Prune entries older than the window if map gets large
  if (processedUpdates.size > 2000) {
    for (const [id, timestamp] of processedUpdates.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        processedUpdates.delete(id);
      }
    }
  }

  const lastSeen = processedUpdates.get(updateId);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }

  processedUpdates.set(updateId, now);
  return false;
}

const processedCallbacks = new Map<string, number>();

export function isDuplicateTelegramCallback(callbackQueryId?: string | null): boolean {
  if (!callbackQueryId || typeof callbackQueryId !== "string") {
    return false;
  }

  const now = Date.now();

  // Prune entries older than the window if map gets large
  if (processedCallbacks.size > 2000) {
    for (const [id, timestamp] of processedCallbacks.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        processedCallbacks.delete(id);
      }
    }
  }

  const lastSeen = processedCallbacks.get(callbackQueryId);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }

  processedCallbacks.set(callbackQueryId, now);
  return false;
}

export function clearProcessedTelegramUpdatesForTest(): void {
  processedUpdates.clear();
  processedCallbacks.clear();
}
