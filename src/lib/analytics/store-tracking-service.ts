import { db } from "@/db";
import { storeSessions, orders, telegramCustomers } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface RecordVisitParams {
  sessionId: string;
  storeId: string;
  telegramUserId?: string | number | null;
  entryPath?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  startParam?: string | null;
  deviceType?: string | null;
  isEligible?: boolean;
}

export interface ConversionMetricsResult {
  ratePercent: number | null; // null represents "Sem dados"
  eligibleSessions: number;
  convertedSessions: number;
  isTelemetryAvailable: boolean;
  statusMessage: string;
  hasError?: boolean;
}

export class StoreTrackingService {
  /**
   * Persists or touches a store session.
   * Ensures React re-renders or page navigations with the same sessionId do not create duplicate sessions.
   */
  static async recordSessionVisit(params: RecordVisitParams): Promise<{
    success: boolean;
    sessionId: string;
    isNew: boolean;
    error?: string;
  }> {
    const {
      sessionId,
      storeId,
      telegramUserId: rawTelegramUserId,
      entryPath,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      startParam,
      deviceType,
      isEligible = true,
    } = params;

    if (!sessionId || !storeId) {
      return {
        success: false,
        sessionId: sessionId || "",
        isNew: false,
        error: "Missing required fields (sessionId or storeId)",
      };
    }

    const telegramUserId = rawTelegramUserId ? String(rawTelegramUserId) : null;

    try {
      // Find customerId if telegramUserId exists
      let customerId: string | null = null;
      if (telegramUserId) {
        try {
          const [cust] = await db
            .select({ id: telegramCustomers.id })
            .from(telegramCustomers)
            .where(
              and(
                eq(telegramCustomers.storeId, storeId),
                eq(telegramCustomers.telegramUserId, telegramUserId)
              )
            )
            .limit(1);
          if (cust) customerId = cust.id;
        } catch (findCustErr: any) {
          console.warn("[StoreTrackingService] Error finding customer:", findCustErr?.message);
        }
      }

      const now = new Date();

      // Upsert session
      const [existing] = await db
        .select({ id: storeSessions.id })
        .from(storeSessions)
        .where(eq(storeSessions.id, sessionId))
        .limit(1);

      if (existing) {
        await db
          .update(storeSessions)
          .set({
            lastActiveAt: now,
            updatedAt: now,
            ...(telegramUserId ? { telegramUserId } : {}),
            ...(customerId ? { customerId } : {}),
          })
          .where(eq(storeSessions.id, sessionId));

        return {
          success: true,
          sessionId,
          isNew: false,
        };
      }

      await db.insert(storeSessions).values({
        id: sessionId,
        storeId,
        customerId: customerId || null,
        telegramUserId: telegramUserId || null,
        entryPath: entryPath || null,
        referrer: referrer || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        startParam: startParam || null,
        deviceType: deviceType || null,
        isEligible: isEligible ?? true,
        firstVisitedAt: now,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        sessionId,
        isNew: true,
      };
    } catch (err: any) {
      console.error("[StoreTrackingService] Error recording session visit:", err?.message);
      return {
        success: false,
        sessionId,
        isNew: false,
        error: err?.message || "Failed to record session",
      };
    }
  }

  /**
   * Calculates the conversion rate for a store within a given date range.
   * Definition:
   * Taxa de conversão = (sessões elegíveis com pelo menos 1 pedido 'paid' / total de sessões elegíveis) * 100
   * 
   * Strict tenant isolation via storeId.
   */
  static async getConversionRateMetrics(
    storeId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ConversionMetricsResult> {
    try {
      const sessionConditions = [
        eq(storeSessions.storeId, storeId),
        eq(storeSessions.isEligible, true),
      ];

      if (startDate) {
        sessionConditions.push(gte(storeSessions.createdAt, startDate));
      }
      if (endDate) {
        sessionConditions.push(lte(storeSessions.createdAt, endDate));
      }

      // 1. Total eligible sessions
      const [eligibleResult] = await db
        .select({
          totalEligible: sql<number>`cast(count(${storeSessions.id}) as integer)`,
        })
        .from(storeSessions)
        .where(and(...sessionConditions));

      const eligibleSessions = eligibleResult?.totalEligible ?? 0;

      // When there are no eligible sessions, return null ("Sem dados")
      if (eligibleSessions === 0) {
        return {
          ratePercent: null,
          eligibleSessions: 0,
          convertedSessions: 0,
          isTelemetryAvailable: true,
          statusMessage: "Sem dados suficientes no período",
        };
      }

      // 2. Converted sessions (eligible sessions that generated at least 1 paid order)
      // Joined by orders.sessionId = store_sessions.id and orders.status = 'paid'
      const [convertedResult] = await db
        .select({
          totalConverted: sql<number>`cast(count(distinct ${storeSessions.id}) as integer)`,
        })
        .from(storeSessions)
        .innerJoin(
          orders,
          and(
            eq(orders.sessionId, storeSessions.id),
            eq(orders.storeId, storeId),
            eq(orders.status, "paid")
          )
        )
        .where(and(...sessionConditions));

      const convertedSessions = convertedResult?.totalConverted ?? 0;

      const rate = (convertedSessions / eligibleSessions) * 100;
      // Round to 1 decimal place
      const roundedRate = Math.round(rate * 10) / 10;

      return {
        ratePercent: roundedRate,
        eligibleSessions,
        convertedSessions,
        isTelemetryAvailable: true,
        statusMessage: "Telemetria operacional",
      };
    } catch (err: any) {
      console.error("[StoreTrackingService] Error calculating conversion rate:", err?.message);
      return {
        ratePercent: null,
        eligibleSessions: 0,
        convertedSessions: 0,
        isTelemetryAvailable: false,
        statusMessage: "Falha ao calcular taxa de conversão",
        hasError: true,
      };
    }
  }
}
