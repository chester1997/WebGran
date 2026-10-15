import { db } from "@/db";
import { botStartEvents, telegramCustomers } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface RecordStartEventParams {
  storeId: string;
  botId?: string | null;
  telegramUserId: string | number;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
  telegramUpdateId: string | number;
  startPayload?: string | null;
  metadata?: Record<string, any>;
}

export interface StartsMetricsResult {
  totalStarts: number;
  uniqueUsers: number;
  isTelemetryAvailable: boolean;
  statusMessage?: string;
  hasError?: boolean;
}

export class BotStartEventService {
  /**
   * Persists a /start event idempotently.
   * Uses (storeId, telegramUpdateId) uniqueness to prevent duplicate counts on Telegram retries.
   */
  static async recordStartEvent(params: RecordStartEventParams): Promise<{
    success: boolean;
    recorded: boolean;
    isDuplicate: boolean;
    error?: string;
  }> {
    const {
      storeId,
      botId,
      telegramUserId: rawUserId,
      telegramUsername,
      telegramFirstName,
      telegramLastName,
      telegramUpdateId: rawUpdateId,
      startPayload,
      metadata = {},
    } = params;

    const telegramUserId = String(rawUserId);
    const telegramUpdateId = String(rawUpdateId);

    if (!storeId || !telegramUserId || !telegramUpdateId) {
      return {
        success: false,
        recorded: false,
        isDuplicate: false,
        error: "Missing required fields (storeId, telegramUserId, or telegramUpdateId)",
      };
    }

    try {
      // 1. Upsert customer in telegramCustomers for this store
      try {
        await db
          .insert(telegramCustomers)
          .values({
            storeId,
            telegramUserId,
            username: telegramUsername || null,
            firstName: telegramFirstName || null,
            lastName: telegramLastName || null,
          })
          .onConflictDoUpdate({
            target: [telegramCustomers.storeId, telegramCustomers.telegramUserId],
            set: {
              username: telegramUsername || sql`${telegramCustomers.username}`,
              firstName: telegramFirstName || sql`${telegramCustomers.firstName}`,
              lastName: telegramLastName || sql`${telegramCustomers.lastName}`,
              updatedAt: new Date(),
            },
          });
      } catch (custErr: any) {
        console.warn("[BotStartEventService] Warning upserting customer:", custErr?.message);
      }

      // 2. Insert event with idempotency constraint on (storeId, telegramUpdateId)
      const insertResult = await db
        .insert(botStartEvents)
        .values({
          storeId,
          botId: botId || null,
          telegramUserId,
          telegramUsername: telegramUsername || null,
          telegramFirstName: telegramFirstName || null,
          telegramUpdateId,
          startPayload: startPayload ? String(startPayload).trim() : null,
          metadata,
        })
        .onConflictDoNothing({
          target: [botStartEvents.storeId, botStartEvents.telegramUpdateId],
        })
        .returning({ id: botStartEvents.id });

      const recorded = insertResult.length > 0;
      return {
        success: true,
        recorded,
        isDuplicate: !recorded,
      };
    } catch (err: any) {
      console.error("[BotStartEventService] Error recording bot start event:", err?.message);
      return {
        success: false,
        recorded: false,
        isDuplicate: false,
        error: err?.message || "Database persistence failure",
      };
    }
  }

  /**
   * Queries start metrics for a store within a given date range.
   * Strict tenant isolation via storeId.
   */
  static async getStartsMetrics(
    storeId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<StartsMetricsResult> {
    try {
      const conditions = [eq(botStartEvents.storeId, storeId)];

      if (startDate) {
        conditions.push(gte(botStartEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(botStartEvents.createdAt, endDate));
      }

      const [counts] = await db
        .select({
          totalStarts: sql<number>`cast(count(${botStartEvents.id}) as integer)`,
          uniqueUsers: sql<number>`cast(count(distinct ${botStartEvents.telegramUserId}) as integer)`,
        })
        .from(botStartEvents)
        .where(and(...conditions));

      const total = counts?.totalStarts ?? 0;
      const unique = counts?.uniqueUsers ?? 0;

      return {
        totalStarts: total,
        uniqueUsers: unique,
        isTelemetryAvailable: true,
        statusMessage: total === 0 ? "Nenhum start registrado no período" : "Webhook operacional",
      };
    } catch (err: any) {
      console.error("[BotStartEventService] Error querying start metrics:", err?.message);
      return {
        totalStarts: 0,
        uniqueUsers: 0,
        isTelemetryAvailable: false,
        statusMessage: "Falha ao carregar eventos de start",
        hasError: true,
      };
    }
  }
}
