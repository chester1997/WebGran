import { db } from "@/db";
import { orders, stores, telegramBots } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface CommercialApprovedSales {
  total: number;
  formatted: string;
  count: number;
  targetGoal: number | null;
  targetProgressPercent: number | null;
  hasTargetGoal: boolean;
}

export interface CommercialConversionRate {
  ratePercent: number | null;
  formatted: string;
  isTelemetryAvailable: boolean;
  totalVisits: number | null;
  convertedOrders: number;
  statusMessage: string;
  totalPixGerados: number;
  totalPixPagos: number;
  hasError?: boolean;
}

export interface CommercialBotStarts {
  totalStarts: number | null;
  formatted: string;
  isTelemetryAvailable: boolean;
  uniqueUsers: number;
  statusMessage: string;
}

export interface CommercialAverageTicket {
  averageTicket: number;
  formatted: string;
  consideredSalesCount: number;
  approvedPixCount: number;
  generatedPixCount: number;
  pixConversionRatePercent: number | null;
}

export interface PerformancePoint {
  dateStr?: string;
  dateKey?: string;
  dateLabel: string;
  dayName: string;
  fullDate?: string;
  revenue: number;
  formattedRevenue: string;
  salesCount: number;
}

export interface CommercialMetrics {
  period: string;
  storeId: string;
  approvedSales: CommercialApprovedSales;
  conversionRate: CommercialConversionRate;
  botStarts: CommercialBotStarts;
  averageTicket: CommercialAverageTicket;
  last7DaysPerformance: PerformancePoint[];
}

export interface CommercialMetricsCalculationOptions {
  period?: string;
  referenceDate?: Date;
  customTargetGoal?: number | null;
  simulatedVisits?: number | null;
  simulatedBotStarts?: Array<{ id: string; userId: string; botId: string; timestamp: Date }> | null;
}

export function formatBRLCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function resolvePeriodDateRange(period: string = "30D", referenceDate: Date = new Date()): { startDate: Date; endDate: Date } {
  const endDate = new Date(referenceDate);
  const startDate = new Date(referenceDate);

  switch (period) {
    case "TODAY":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "7D":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "90D":
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "12M":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case "ALL":
      return { startDate: new Date(0), endDate };
    case "30D":
    default:
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  return { startDate, endDate };
}

export function generateLast7DaysPerformance(
  ordersList: Array<{
    status: string;
    total: string | number | null;
    paidAt?: Date | string | null;
    createdAt: Date | string;
  }>,
  referenceDate: Date = new Date()
): PerformancePoint[] {
  const points: PerformancePoint[] = [];
  const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Last 7 days: referenceDate - 6 days up to referenceDate
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);

    const dateKey = d.toISOString().split("T")[0];
    const weekday = weekdayNames[d.getDay()];
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dateLabel = `${day}/${month}`;
    const dayMonth = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

    // Filter paid orders on this calendar day
    const dayOrders = ordersList.filter((o) => {
      if (o.status !== "paid") return false;
      const orderDate = new Date(o.paidAt || o.createdAt);
      return orderDate >= d && orderDate <= endOfDay;
    });

    const dayRevenue = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const daySalesCount = dayOrders.length;
    const roundedRevenue = Math.round(dayRevenue * 100) / 100;

    points.push({
      dateStr: dateKey,
      dateKey,
      dateLabel,
      dayName: weekday,
      fullDate: `${weekday}, ${dateLabel}`,
      revenue: roundedRevenue,
      formattedRevenue: formatBRLCurrency(roundedRevenue),
      salesCount: daySalesCount,
    });
  }

  return points;
}

export class CommercialMetricsService {
  /**
   * Pure calculation helper for in-memory order lists and telemetry inputs.
   * Useful for unit testing, isolated testing and benchmarking.
   */
  public static calculateMetrics(
    ordersList: Array<{
      id: string;
      storeId: string;
      status: string;
      total: string | number | null;
      paidAt?: Date | string | null;
      createdAt: Date | string;
      paymentMethod?: string | null;
      paymentId?: string | null;
      pixQrCode?: string | null;
    }>,
    options: CommercialMetricsCalculationOptions = {}
  ): {
    approvedSales: CommercialApprovedSales;
    conversionRate: CommercialConversionRate;
    botStarts: CommercialBotStarts;
    averageTicket: CommercialAverageTicket;
    last7DaysPerformance: PerformancePoint[];
  } {
    const { 
      period = "30D", 
      referenceDate = new Date(), 
      customTargetGoal = null, 
      simulatedVisits = null, 
      simulatedBotStarts = null 
    } = options;
    const { startDate, endDate } = resolvePeriodDateRange(period, referenceDate);

    // 1. Exclude pending, cancelled, refunded or expired orders. Consider exclusively paid orders.
    // Date boundary uses paidAt, with fallback to createdAt if paidAt was not recorded.
    const paidOrdersInPeriod = ordersList.filter((o) => {
      if (o.status !== "paid") return false;
      const orderDate = new Date(o.paidAt || o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // De-duplicate orders by unique id to avoid multiple counts
    const uniquePaidOrdersMap = new Map<string, typeof ordersList[0]>();
    for (const order of paidOrdersInPeriod) {
      if (!uniquePaidOrdersMap.has(order.id)) {
        uniquePaidOrdersMap.set(order.id, order);
      }
    }
    const uniquePaidOrders = Array.from(uniquePaidOrdersMap.values());

    // 2. Metric: Approved Sales Total
    const approvedSalesTotal = uniquePaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const approvedCount = uniquePaidOrders.length;

    const hasTargetGoal = typeof customTargetGoal === "number" && customTargetGoal > 0;
    const targetProgressPercent = hasTargetGoal
      ? Math.min(Math.round((approvedSalesTotal / customTargetGoal) * 100), 100)
      : null;

    const approvedSales: CommercialApprovedSales = {
      total: Math.round(approvedSalesTotal * 100) / 100,
      formatted: formatBRLCurrency(approvedSalesTotal),
      count: approvedCount,
      targetGoal: hasTargetGoal ? customTargetGoal : null,
      targetProgressPercent,
      hasTargetGoal,
    };

    // 3. Metric: Conversion Rate (Pix Charges Conversion)
    // Business rule: taxaConversao = (totalPixPagos / totalPixGerados) * 100
    // Measures conversion of generated Pix charges into approved/paid Pix payments.
    const allOrdersInPeriod = ordersList.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate;
    });

    const isPixCharge = (o: typeof ordersList[0]) => {
      const method = (o.paymentMethod || "").toLowerCase().trim();
      return Boolean(
        o.pixQrCode ||
        method.includes("pix") ||
        method === "mercadopago" ||
        method === "syncpay"
      );
    };

    const pixOrdersInPeriod = allOrdersInPeriod.filter(isPixCharge);

    // De-duplicate unique Pix charges by paymentId (or id fallback) to measure unique charges
    const uniquePixChargesMap = new Map<string, typeof ordersList[0]>();
    for (const o of pixOrdersInPeriod) {
      const key = o.paymentId?.trim() || o.id;
      if (!uniquePixChargesMap.has(key)) {
        uniquePixChargesMap.set(key, o);
      } else {
        const existing = uniquePixChargesMap.get(key)!;
        if (existing.status !== "paid" && (o.status === "paid" || o.status === "fulfilled")) {
          uniquePixChargesMap.set(key, o);
        }
      }
    }

    const uniquePixCharges = Array.from(uniquePixChargesMap.values());
    const totalPixGerados = uniquePixCharges.length;

    // Count effectively paid and confirmed Pix charges (status strictly 'paid' or 'fulfilled')
    // Pending, cancelled, or refunded must NEVER be counted as paid.
    const paidPixCharges = uniquePixCharges.filter(
      (o) => o.status === "paid" || o.status === "fulfilled"
    );
    const totalPixPagos = paidPixCharges.length;

    let conversionRate: CommercialConversionRate;
    if (simulatedVisits !== null && typeof simulatedVisits === "number" && simulatedVisits >= 0) {
      const rate = simulatedVisits > 0 ? (approvedCount / simulatedVisits) * 100 : 0;
      const roundedRate = Math.round(rate * 10) / 10;
      conversionRate = {
        ratePercent: roundedRate,
        formatted: `${roundedRate.toFixed(1).replace(".", ",")}%`,
        isTelemetryAvailable: true,
        totalVisits: simulatedVisits,
        convertedOrders: approvedCount,
        statusMessage: `${approvedCount} vendas em ${simulatedVisits} sessões`,
        totalPixGerados,
        totalPixPagos,
        hasError: false,
      };
    } else {
      if (totalPixGerados === 0) {
        conversionRate = {
          ratePercent: null,
          formatted: "Sem dados",
          isTelemetryAvailable: false,
          totalVisits: 0,
          convertedOrders: 0,
          totalPixGerados: 0,
          totalPixPagos: 0,
          statusMessage: "0 pagos de 0 Pix",
          hasError: false,
        };
      } else {
        const rate = (totalPixPagos / totalPixGerados) * 100;
        const roundedRate = Math.round(rate * 10) / 10;
        const formattedPct = roundedRate % 1 === 0 ? `${roundedRate}%` : `${roundedRate.toFixed(1).replace(".", ",")}%`;
        conversionRate = {
          ratePercent: roundedRate,
          formatted: formattedPct,
          isTelemetryAvailable: true,
          totalVisits: totalPixGerados,
          convertedOrders: totalPixPagos,
          totalPixGerados,
          totalPixPagos,
          statusMessage: `${totalPixPagos} pagos de ${totalPixGerados} Pix`,
          hasError: false,
        };
      }
    }

    // 4. Metric: Total Bot Starts
    // Rule: Telegram webhooks currently do not persist /start events into Neon database.
    // Count only when real data is available, with de-duplication when supported.
    let botStarts: CommercialBotStarts;
    if (simulatedBotStarts !== null && Array.isArray(simulatedBotStarts)) {
      // Filter within period and de-duplicate by user ID
      const startsInPeriod = simulatedBotStarts.filter((s) => {
        const d = new Date(s.timestamp);
        return d >= startDate && d <= endDate;
      });
      const uniqueUsersSet = new Set(startsInPeriod.map((s) => s.userId));
      const totalStarts = startsInPeriod.length;

      botStarts = {
        totalStarts,
        formatted: String(totalStarts),
        isTelemetryAvailable: true,
        uniqueUsers: uniqueUsersSet.size,
        statusMessage: `${totalStarts} início(s) de bot no período`,
      };
    } else {
      botStarts = {
        totalStarts: 0,
        formatted: "0",
        isTelemetryAvailable: false,
        uniqueUsers: 0,
        statusMessage: "Eventos de /start não registrados no banco",
      };
    }

    // 5. Metric: Average Ticket
    const consideredSalesCount = approvedCount;
    const rawAverageTicket = consideredSalesCount > 0 ? approvedSalesTotal / consideredSalesCount : 0;
    const averageTicketValue = Math.round(rawAverageTicket * 100) / 100;

    const approvedPixCount = totalPixPagos;
    const generatedPixCount = totalPixGerados;
    const pixConversionRatePercent =
      conversionRate.ratePercent !== null ? Math.round(conversionRate.ratePercent) : null;

    const averageTicket: CommercialAverageTicket = {
      averageTicket: averageTicketValue,
      formatted: formatBRLCurrency(averageTicketValue),
      consideredSalesCount,
      approvedPixCount,
      generatedPixCount,
      pixConversionRatePercent,
    };

    // 6. Metric: Last 7 Days Daily Performance
    const last7DaysPerformance = generateLast7DaysPerformance(ordersList, referenceDate);

    return {
      approvedSales,
      conversionRate,
      botStarts,
      averageTicket,
      last7DaysPerformance,
    };
  }

  /**
   * Retrieves commercial metrics for a given store from the database.
   * Guarantees strict multi-tenant isolation by filtering by storeId.
   */
  public static async getCommercialMetrics(
    storeId: string,
    period: string = "30D",
    options: CommercialMetricsCalculationOptions = {}
  ): Promise<CommercialMetrics> {
    const { startDate, endDate } = resolvePeriodDateRange(period, options.referenceDate);

    try {
      // Fetch orders belonging strictly to the requested store
      const storeOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.storeId, storeId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ),
        columns: {
          id: true,
          storeId: true,
          status: true,
          total: true,
          paidAt: true,
          createdAt: true,
          paymentMethod: true,
          paymentId: true,
          pixQrCode: true,
        },
        orderBy: [desc(orders.createdAt)],
      });

      const calculated = this.calculateMetrics(storeOrders, {
        period,
        referenceDate: options.referenceDate,
        customTargetGoal: options.customTargetGoal,
        simulatedVisits: options.simulatedVisits,
        simulatedBotStarts: options.simulatedBotStarts,
      });

      // 1. Fetch real starts metrics from database if not simulated
      let realStarts: CommercialBotStarts | null = null;
      if (options.simulatedBotStarts === undefined || options.simulatedBotStarts === null) {
        try {
          const { BotStartEventService } = await import("@/lib/analytics/bot-start-service");
          const startsResult = await BotStartEventService.getStartsMetrics(storeId, startDate, endDate);
          realStarts = {
            totalStarts: startsResult.totalStarts,
            formatted: String(startsResult.totalStarts),
            isTelemetryAvailable: startsResult.isTelemetryAvailable,
            uniqueUsers: startsResult.uniqueUsers,
            statusMessage: startsResult.statusMessage || `${startsResult.totalStarts} início(s) no período`,
          };
        } catch (err: any) {
          console.warn("[CommercialMetricsService] Warning loading real bot starts:", err?.message);
        }
      }

      return {
        period,
        storeId,
        ...calculated,
        ...(realStarts ? { botStarts: realStarts } : {}),
      };
    } catch (err: any) {
      console.error("[CommercialMetricsService] Error loading commercial metrics for store:", storeId, err?.message);
      return {
        period,
        storeId,
        approvedSales: {
          total: 0,
          formatted: formatBRLCurrency(0),
          count: 0,
          targetGoal: null,
          targetProgressPercent: null,
          hasTargetGoal: false,
        },
        conversionRate: {
          ratePercent: null,
          formatted: "—",
          isTelemetryAvailable: false,
          totalVisits: null,
          convertedOrders: 0,
          totalPixGerados: 0,
          totalPixPagos: 0,
          statusMessage: "Falha ao consultar banco de dados",
          hasError: true,
        },
        botStarts: {
          totalStarts: 0,
          formatted: "0",
          isTelemetryAvailable: false,
          uniqueUsers: 0,
          statusMessage: "Falha ao carregar eventos",
        },
        averageTicket: {
          averageTicket: 0,
          formatted: formatBRLCurrency(0),
          consideredSalesCount: 0,
          approvedPixCount: 0,
          generatedPixCount: 0,
          pixConversionRatePercent: null,
        },
        last7DaysPerformance: [],
      };
    }
  }
}
