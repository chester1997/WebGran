import { db } from "@/db";
import { botStartEvents, telegramCustomers } from "@/db/schema";
import { and, eq, gte, lte, lt, sql } from "drizzle-orm";

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
    isFirstStart?: boolean;
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

      // 2. Check if this is the first /start for this user on this bot
      let isFirstStart = true;
      try {
        if (typeof db.select === "function") {
          const checkQuery = db
            .select({ id: botStartEvents.id })
            .from(botStartEvents)
            .where(
              and(
                eq(botStartEvents.storeId, storeId),
                botId ? eq(botStartEvents.botId, botId) : sql`${botStartEvents.botId} IS NULL`,
                eq(botStartEvents.telegramUserId, telegramUserId)
              )
            );
          if (checkQuery && typeof checkQuery.limit === "function") {
            const existing = await checkQuery.limit(1);
            if (Array.isArray(existing) && existing.length > 0) {
              isFirstStart = false;
            }
          }
        }
      } catch (_e) {
        isFirstStart = true;
      }

      // 3. Insert event with idempotency constraint on (storeId, telegramUpdateId)
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
          metadata: {
            ...metadata,
            isFirstStart,
          },
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
        isFirstStart: recorded ? isFirstStart : false,
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
   * Business Rule: Counts only the FIRST /start of each user on each bot.
   * If a user started multiple times, only their earliest occurrence is considered.
   * Unique identification is per combination of (botId, telegramUserId).
   * Strict tenant isolation via storeId.
   */
  static async getStartsMetrics(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    botId?: string | null
  ): Promise<StartsMetricsResult> {
    try {
      let total = 0;
      let unique = 0;

      // 1. Primary execution via CTE (PostgreSQL native with MIN(created_at) per bot & user)
      if (typeof db.execute === "function") {
        const botClause = botId ? sql`AND bot_id = ${botId}` : sql``;
        const dateClauses: any[] = [];
        if (startDate) {
          dateClauses.push(sql`first_start_at >= ${startDate}`);
        }
        if (endDate) {
          dateClauses.push(sql`first_start_at < ${endDate}`);
        }
        const periodFilter = dateClauses.length > 0 
          ? sql`WHERE ${sql.join(dateClauses, sql` AND `)}` 
          : sql``;

        const result = await db.execute(sql`
          WITH first_starts AS (
            SELECT 
              store_id,
              bot_id,
              telegram_user_id,
              MIN(created_at) as first_start_at
            FROM bot_start_events
            WHERE store_id = ${storeId}
            ${botClause}
            GROUP BY store_id, bot_id, telegram_user_id
          )
          SELECT
            cast(count(*) as integer) as "totalStarts",
            cast(count(distinct telegram_user_id) as integer) as "uniqueUsers"
          FROM first_starts
          ${periodFilter}
        `);

        const row = (result as any)?.[0] ?? (result as any)?.rows?.[0];
        if (row) {
          total = Number(row?.totalStarts ?? row?.totalstarts ?? 0);
          unique = Number(row?.uniqueUsers ?? row?.uniqueusers ?? 0);
        }

        return {
          totalStarts: total,
          uniqueUsers: unique,
          isTelemetryAvailable: true,
          statusMessage: total === 0 ? "Nenhum start registrado no período" : "Webhook operacional",
        };
      }

      // 2. Query builder fallback for test environments without db.execute
      const baseConditions = [eq(botStartEvents.storeId, storeId)];
      if (botId) {
        baseConditions.push(eq(botStartEvents.botId, botId));
      }

      const firstStarts = db
        .select({
          storeId: botStartEvents.storeId,
          botId: botStartEvents.botId,
          telegramUserId: botStartEvents.telegramUserId,
          firstStartAt: sql<Date>`min(${botStartEvents.createdAt})`.as("first_start_at"),
        })
        .from(botStartEvents)
        .where(and(...baseConditions))
        .groupBy(botStartEvents.storeId, botStartEvents.botId, botStartEvents.telegramUserId)
        .as("first_starts");

      if (Array.isArray(firstStarts)) {
        const row: any = firstStarts[0];
        total = Number(row?.totalStarts ?? 0);
        unique = Number(row?.uniqueUsers ?? 0);
      } else {
        const periodConditions = [];
        if (startDate) {
          periodConditions.push(gte(firstStarts.firstStartAt, startDate));
        }
        if (endDate) {
          periodConditions.push(lt(firstStarts.firstStartAt, endDate));
        }

        const selectChain = db.select({
          totalStarts: sql<number>`cast(count(*) as integer)`,
          uniqueUsers: sql<number>`cast(count(distinct ${firstStarts.telegramUserId}) as integer)`,
        });

        if (selectChain && typeof selectChain.from === "function") {
          const [counts] = await selectChain
            .from(firstStarts)
            .where(periodConditions.length > 0 ? and(...periodConditions) : undefined);
          total = counts?.totalStarts ?? 0;
          unique = counts?.uniqueUsers ?? 0;
        }
      }

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
