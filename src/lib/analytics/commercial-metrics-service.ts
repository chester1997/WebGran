import { db } from "@/db";
import { orders, stores, telegramBots } from "@/db/schema";
import { eq, and, gte, lt, lte, desc, or } from "drizzle-orm";
import {
  BUSINESS_TIMEZONE,
  getSaoPauloParts,
  getSaoPauloDateKey,
  getSaoPauloDateLabel,
  getSaoPauloMonthKey,
  getSaoPauloMonthLabel,
  getSaoPauloStartOfDay,
  getSaoPauloEndOfDay,
  getSaoPauloWeekdayShort,
  parseCivilDate,
  formatCivilDateToBR,
} from "@/lib/analytics/timezone-utils";

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
  performanceSeries: PerformancePoint[];
  last7DaysPerformance: PerformancePoint[];
}

export interface CommercialMetricsCalculationOptions {
  period?: string;
  referenceDate?: Date;
  customTargetGoal?: number | null;
  simulatedVisits?: number | null;
  simulatedBotStarts?: Array<{ id: string; userId: string; botId: string; timestamp: Date }> | null;
  botId?: string | null;
}

export function formatBRLCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function resolvePeriodDateRange(
  period: string = "30D",
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const normalizedPeriod = (period || "30D").toUpperCase();
  const endOfToday = getSaoPauloEndOfDay(referenceDate);
  const startOfToday = getSaoPauloStartOfDay(referenceDate);

  if (normalizedPeriod.startsWith("CUSTOM:")) {
    const parts = normalizedPeriod.split(":");
    const startStr = parts[1];
    const endStr = parts[2];
    const pStart = startStr ? parseCivilDate(startStr) : null;
    const pEnd = endStr ? parseCivilDate(endStr) : null;
    if (pStart && pEnd) {
      const startDate = new Date(Date.UTC(pStart.year, pStart.month - 1, pStart.day, 3, 0, 0, 0));
      // Exclusive upper bound: midnight of the next day (00:00:00 BRT of pEnd.day + 1)
      const endDate = new Date(Date.UTC(pEnd.year, pEnd.month - 1, pEnd.day + 1, 3, 0, 0, 0));
      return { startDate, endDate };
    }
  }

  switch (normalizedPeriod) {
    case "TODAY":
      return { startDate: startOfToday, endDate: endOfToday };
    case "7D":
      // 7 calendar days ending today in America/Recife (6 days prior + today)
      return {
        startDate: new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
      };
    case "90D":
      // 90 calendar days ending today (89 days prior + today)
      return {
        startDate: new Date(startOfToday.getTime() - 89 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
      };
    case "THIS_MONTH": {
      const { year, month } = getSaoPauloParts(referenceDate);
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
      return { startDate: startOfMonth, endDate: endOfToday };
    }
    case "LAST_MONTH": {
      const { year, month } = getSaoPauloParts(referenceDate);
      let targetYear = year;
      let targetMonth = month - 1;
      if (targetMonth <= 0) {
        targetMonth = 12;
        targetYear -= 1;
      }
      const startOfLastMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 3, 0, 0, 0));
      // Exclusive upper bound: start of current month (00:00:00 BRT of day 1)
      const endOfLastMonth = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
      return { startDate: startOfLastMonth, endDate: endOfLastMonth };
    }
    case "THIS_YEAR": {
      const { year } = getSaoPauloParts(referenceDate);
      const startOfYear = new Date(Date.UTC(year, 0, 1, 3, 0, 0, 0));
      return { startDate: startOfYear, endDate: endOfToday };
    }
    case "12M": {
      // 12 calendar months: start of 11 months ago in America/Recife
      const { year, month } = getSaoPauloParts(referenceDate);
      let startYear = year;
      let startMonth = month - 11;
      while (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
      }
      const startOf12M = new Date(Date.UTC(startYear, startMonth - 1, 1, 3, 0, 0, 0));
      return { startDate: startOf12M, endDate: endOfToday };
    }
    case "ALL":
      return { startDate: new Date(0), endDate: endOfToday };
    case "30D":
    default:
      // 30 calendar days ending today (29 days prior + today)
      return {
        startDate: new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
      };
  }
}

/**
 * Generates dynamic performance data series grouped by time according to the selected period.
 * Strictly respects America/Sao_Paulo timezone so orders late in the evening (e.g. 23:06 BRT)
 * are NEVER shifted to the next day due to UTC offset.
 */
export function generatePerformanceSeries(
  ordersList: Array<{
    status: string;
    total: string | number | null;
    paidAt?: Date | string | null;
    createdAt: Date | string;
  }>,
  period: string = "30D",
  referenceDate: Date = new Date()
): PerformancePoint[] {
  const normalizedPeriod = (period || "30D").toUpperCase();
  const points: PerformancePoint[] = [];

  // Exclusively consider paid orders for financial performance curves
  const paidOrders = ordersList.filter((o) => o.status === "paid");

  if (normalizedPeriod === "TODAY") {
    // Group into 2-hour intervals for today (00:00 to 22:00 BRT)
    const { year, month, day } = getSaoPauloParts(referenceDate);
    for (let h = 0; h < 24; h += 2) {
      const intervalLabel = `${String(h).padStart(2, "0")}:00`;
      // In America/Sao_Paulo (UTC-3), hour h corresponds to UTC hour (3 + h)
      const startHourUTC = new Date(Date.UTC(year, month - 1, day, 3 + h, 0, 0, 0));
      const endHourUTC = new Date(startHourUTC.getTime() + 2 * 60 * 60 * 1000);

      const matchingOrders = paidOrders.filter((o) => {
        const orderDate = new Date(o.paidAt || o.createdAt);
        return orderDate >= startHourUTC && orderDate < endHourUTC;
      });

      const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const roundedRev = Math.round(revenue * 100) / 100;
      points.push({
        dateStr: intervalLabel,
        dateKey: intervalLabel,
        dateLabel: intervalLabel,
        dayName: "Hoje",
        fullDate: `Hoje às ${intervalLabel}`,
        revenue: roundedRev,
        formattedRevenue: formatBRLCurrency(roundedRev),
        salesCount: matchingOrders.length,
      });
    }
    return points;
  }

  if (normalizedPeriod === "12M" || normalizedPeriod === "ALL") {
    // Group by month (12 months ending in current month in America/Recife)
    const { year, month } = getSaoPauloParts(referenceDate);
    for (let i = 11; i >= 0; i--) {
      let targetYear = year;
      let targetMonth = month - i;
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }

      const startOfMonthUTC = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 3, 0, 0, 0));
      let nextYear = targetYear;
      let nextMonth = targetMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const endOfMonthUTC = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 3, 0, 0, 0));

      const monthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
      const rawMonthLabel = getSaoPauloMonthLabel(startOfMonthUTC).replace(".", "");
      const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);

      const matchingOrders = paidOrders.filter((o) => {
        const orderDate = new Date(o.paidAt || o.createdAt);
        return orderDate >= startOfMonthUTC && orderDate < endOfMonthUTC;
      });

      const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const roundedRev = Math.round(revenue * 100) / 100;

      points.push({
        dateStr: monthKey,
        dateKey: monthKey,
        dateLabel: monthLabel,
        dayName: monthLabel,
        fullDate: `${monthLabel} de ${targetYear}`,
        revenue: roundedRev,
        formattedRevenue: formatBRLCurrency(roundedRev),
        salesCount: matchingOrders.length,
      });
    }
    return points;
  }

  if (normalizedPeriod === "THIS_YEAR") {
    const { year, month } = getSaoPauloParts(referenceDate);
    for (let m = 1; m <= month; m++) {
      const startOfMonthUTC = new Date(Date.UTC(year, m - 1, 1, 3, 0, 0, 0));
      const endOfMonthUTC = m === 12
        ? new Date(Date.UTC(year + 1, 0, 1, 3, 0, 0, 0))
        : new Date(Date.UTC(year, m, 1, 3, 0, 0, 0));

      const monthKey = `${year}-${String(m).padStart(2, "0")}`;
      const rawMonthLabel = getSaoPauloMonthLabel(startOfMonthUTC).replace(".", "");
      const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);

      const matchingOrders = paidOrders.filter((o) => {
        const orderDate = new Date(o.paidAt || o.createdAt);
        return orderDate >= startOfMonthUTC && orderDate < endOfMonthUTC;
      });

      const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const roundedRev = Math.round(revenue * 100) / 100;

      points.push({
        dateStr: monthKey,
        dateKey: monthKey,
        dateLabel: monthLabel,
        dayName: monthLabel,
        fullDate: `${monthLabel} de ${year}`,
        revenue: roundedRev,
        formattedRevenue: formatBRLCurrency(roundedRev),
        salesCount: matchingOrders.length,
      });
    }
    return points;
  }

  if (normalizedPeriod === "THIS_MONTH") {
    const { year, month, day } = getSaoPauloParts(referenceDate);
    for (let d = 1; d <= day; d++) {
      const dayStart = new Date(Date.UTC(year, month - 1, d, 3, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(year, month - 1, d + 1, 3, 0, 0, 0));

      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateLabel = `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      const weekday = getSaoPauloWeekdayShort(dayStart);

      const matchingOrders = paidOrders.filter((o) => {
        const orderDate = new Date(o.paidAt || o.createdAt);
        return orderDate >= dayStart && orderDate < dayEnd;
      });

      const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const roundedRev = Math.round(revenue * 100) / 100;

      points.push({
        dateStr: dateKey,
        dateKey,
        dateLabel,
        dayName: weekday,
        fullDate: `${weekday}, ${dateLabel}`,
        revenue: roundedRev,
        formattedRevenue: formatBRLCurrency(roundedRev),
        salesCount: matchingOrders.length,
      });
    }
    return points;
  }

  if (normalizedPeriod === "LAST_MONTH") {
    const { year, month } = getSaoPauloParts(referenceDate);
    let targetYear = year;
    let targetMonth = month - 1;
    if (targetMonth <= 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
    // Days in targetMonth: day 0 of month after targetMonth
    const totalDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    for (let d = 1; d <= totalDays; d++) {
      const dayStart = new Date(Date.UTC(targetYear, targetMonth - 1, d, 3, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(targetYear, targetMonth - 1, d + 1, 3, 0, 0, 0));

      const dateKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateLabel = `${String(d).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}`;
      const weekday = getSaoPauloWeekdayShort(dayStart);

      const matchingOrders = paidOrders.filter((o) => {
        const orderDate = new Date(o.paidAt || o.createdAt);
        return orderDate >= dayStart && orderDate < dayEnd;
      });

      const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const roundedRev = Math.round(revenue * 100) / 100;

      points.push({
        dateStr: dateKey,
        dateKey,
        dateLabel,
        dayName: weekday,
        fullDate: `${weekday}, ${dateLabel}`,
        revenue: roundedRev,
        formattedRevenue: formatBRLCurrency(roundedRev),
        salesCount: matchingOrders.length,
      });
    }
    return points;
  }

  if (normalizedPeriod.startsWith("CUSTOM:")) {
    const { startDate, endDate } = resolvePeriodDateRange(normalizedPeriod, referenceDate);
    const msDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(1, Math.ceil(msDiff / (24 * 60 * 60 * 1000)));

    if (totalDays <= 35) {
      // Daily points
      for (let i = 0; i < totalDays; i++) {
        const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dateKey = getSaoPauloDateKey(dayStart);
        const dateLabel = getSaoPauloDateLabel(dayStart);
        const weekday = getSaoPauloWeekdayShort(dayStart);

        const matchingOrders = paidOrders.filter((o) => {
          const orderDate = new Date(o.paidAt || o.createdAt);
          return orderDate >= dayStart && orderDate < dayEnd;
        });

        const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const roundedRev = Math.round(revenue * 100) / 100;

        points.push({
          dateStr: dateKey,
          dateKey,
          dateLabel,
          dayName: weekday,
          fullDate: `${weekday}, ${dateLabel}`,
          revenue: roundedRev,
          formattedRevenue: formatBRLCurrency(roundedRev),
          salesCount: matchingOrders.length,
        });
      }
      return points;
    }
  }

  // Daily grouping for 7D, 30D, 90D
  const daysCount = normalizedPeriod === "7D" ? 7 : normalizedPeriod === "90D" ? 90 : 30;
  const startOfToday = getSaoPauloStartOfDay(referenceDate);

  for (let i = daysCount - 1; i >= 0; i--) {
    const dayStart = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const dateKey = getSaoPauloDateKey(dayStart);
    const dateLabel = getSaoPauloDateLabel(dayStart);
    const weekday = getSaoPauloWeekdayShort(dayStart);

    const matchingOrders = paidOrders.filter((o) => {
      const orderDate = new Date(o.paidAt || o.createdAt);
      return orderDate >= dayStart && orderDate < dayEnd;
    });

    const revenue = matchingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const roundedRev = Math.round(revenue * 100) / 100;

    points.push({
      dateStr: dateKey,
      dateKey,
      dateLabel,
      dayName: weekday,
      fullDate: `${weekday}, ${dateLabel}`,
      revenue: roundedRev,
      formattedRevenue: formatBRLCurrency(roundedRev),
      salesCount: matchingOrders.length,
    });
  }

  return points;
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
  return generatePerformanceSeries(ordersList, "7D", referenceDate);
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
    performanceSeries: PerformancePoint[];
    last7DaysPerformance: PerformancePoint[];
  } {

    const { 
      period = "30D", 
      referenceDate = new Date(), 
      customTargetGoal = null, 
      simulatedVisits = null, 
      simulatedBotStarts = null,
      botId = null,
    } = options;
    const { startDate, endDate } = resolvePeriodDateRange(period, referenceDate);

    // Apply bot-scoping if botId is specified
    const scopedOrders = botId
      ? ordersList.filter((o: any) => {
          if (o.botId === botId) return true;
          if (o.items && Array.isArray(o.items) && o.items.some((it: any) => it?.product?.botId === botId)) return true;
          return false;
        })
      : ordersList;

    // 1. Exclude pending, cancelled, refunded or expired orders. Consider exclusively paid orders.
    // Date boundary uses paidAt, with fallback to createdAt if paidAt was not recorded.
    // Standard business rule: start inclusive [startDate, endDate)
    const paidOrdersInPeriod = scopedOrders.filter((o) => {
      if (o.status !== "paid") return false;
      const orderDate = new Date(o.paidAt || o.createdAt);
      return orderDate >= startDate && orderDate < endDate;
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
    const allOrdersInPeriod = scopedOrders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startDate && d < endDate;
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
    // Business Rule: Count exclusively the FIRST /start of each user on each bot.
    // If a user sent /start multiple times to the same bot, only the earliest occurrence is counted.
    // Unique identification is strictly per (botId, userId) combination.
    let botStarts: CommercialBotStarts;
    if (simulatedBotStarts !== null && Array.isArray(simulatedBotStarts)) {
      let candidateStarts = simulatedBotStarts;
      if (options.botId) {
        candidateStarts = candidateStarts.filter((s) => s.botId === options.botId);
      }

      // Group by (botId, userId) to find the absolute earliest start timestamp
      const firstStartMap = new Map<string, { userId: string; botId: string; firstTimestamp: Date }>();
      for (const start of candidateStarts) {
        const key = `${start.botId || "global"}__${start.userId}`;
        const d = new Date(start.timestamp);
        const existing = firstStartMap.get(key);
        if (!existing || d.getTime() < existing.firstTimestamp.getTime()) {
          firstStartMap.set(key, {
            userId: start.userId,
            botId: start.botId,
            firstTimestamp: d,
          });
        }
      }

      // Only count first starts whose earliest occurrence happened within [startDate, endDate]
      const firstStartsInPeriod = Array.from(firstStartMap.values()).filter((item) => {
        return item.firstTimestamp >= startDate && item.firstTimestamp <= endDate;
      });

      const totalStarts = firstStartsInPeriod.length;
      const uniqueUsersSet = new Set(firstStartsInPeriod.map((item) => item.userId));
      const uniqueUsers = uniqueUsersSet.size;

      botStarts = {
        totalStarts,
        formatted: String(totalStarts),
        isTelemetryAvailable: true,
        uniqueUsers,
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

    // 6. Metric: Dynamic Performance Series for Period + Backward Compatibility 7D
    const performanceSeries = generatePerformanceSeries(scopedOrders, period, referenceDate);
    const last7DaysPerformance = generateLast7DaysPerformance(scopedOrders, referenceDate);

    return {
      approvedSales,
      conversionRate,
      botStarts,
      averageTicket,
      performanceSeries,
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
    const normalizedPeriod = (period || "30D").toUpperCase();

    try {
      // Fetch orders belonging strictly to the requested store
      // Standard [startDate, endDate) bounds
      const storeOrders = await db.query.orders.findMany({
        where: normalizedPeriod === "ALL"
          ? eq(orders.storeId, storeId)
          : and(
              eq(orders.storeId, storeId),
              or(
                and(gte(orders.createdAt, startDate), lt(orders.createdAt, endDate)),
                and(gte(orders.paidAt, startDate), lt(orders.paidAt, endDate))
              )
            ),
        with: {
          items: {
            with: {
              product: {
                columns: {
                  botId: true,
                },
              },
            },
          },
        },
        orderBy: [desc(orders.createdAt)],
      });

      const calculated = this.calculateMetrics(storeOrders, {
        period,
        referenceDate: options.referenceDate,
        customTargetGoal: options.customTargetGoal,
        simulatedVisits: options.simulatedVisits,
        simulatedBotStarts: options.simulatedBotStarts,
        botId: options.botId,
      });

      // 1. Fetch real starts metrics from database if not simulated
      let realStarts: CommercialBotStarts | null = null;
      if (options.simulatedBotStarts === undefined || options.simulatedBotStarts === null) {
        try {
          const { BotStartEventService } = await import("@/lib/analytics/bot-start-service");
          const startsResult = await BotStartEventService.getStartsMetrics(
            storeId,
            startDate,
            endDate,
            options.botId
          );
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
        performanceSeries: [],
        last7DaysPerformance: [],
      };
    }
  }
}
