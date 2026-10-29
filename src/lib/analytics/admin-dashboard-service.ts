import { db } from "@/db";
import {
  stores,
  users,
  telegramBots,
  products,
  orders,
  telegramCustomers,
} from "@/db/schema";
import { eq, sql, gte, lte, and, desc, inArray, isNotNull } from "drizzle-orm";
import {
  BUSINESS_TIMEZONE,
  getBusinessParts,
  getBusinessStartOfDay,
  getBusinessChartDateLabel,
  getBusinessDateKey,
} from "@/lib/analytics/timezone-utils";

export type AdminDashboardPeriod = "7d" | "30d" | "90d";

export interface PeriodResolution {
  period: AdminDashboardPeriod;
  periodLabel: string;
  days: number;
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  startOfToday: Date;
}

export interface MetricItem {
  total: number;
  current: number;
  changePercent: number | null;
}

export interface DailyEvolutionItem {
  date: string;
  label: string;
  ordersCount: number;
  gmv: number;
  pixGenerated: number;
}

export interface SellerRankingItem {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  storeName: string | null;
  storeSlug: string | null;
  paidOrdersCount: number;
  approvedGmv: number;
  processedFees: number;
  totalFeesExpected: number;
}

export interface AdminDashboardData {
  period: AdminDashboardPeriod;
  periodLabel: string;
  updatedAt: string;
  startDate: string;
  endDate: string;
  kpis: {
    sellers: MetricItem;
    stores: MetricItem;
    bots: MetricItem;
    products: MetricItem;
    telegramCustomers: MetricItem;
    paidOrders: MetricItem;
    gmv: MetricItem;
    processedFees: MetricItem;
  };
  salesAndPayments: {
    pixGeneratedCount: number;
    pixPaidCount: number;
    pixConversionRate: number | null;
    paidOrdersCount: number;
    gmvApproved: number;
    dailyEvolution: DailyEvolutionItem[];
  };
  platformFees: {
    expectedFeeTotal: number;
    processedFeeTotal: number;
    processedCount: number;
    settledFeeTotal: number;
    settledCount: number;
    pendingFeeTotal: number;
    pendingCount: number;
    skippedFeeTotal: number;
    skippedCount: number;
    failedFeeTotal: number;
    failedCount: number;
  };
  sellerRanking: SellerRankingItem[];
  telegramStats: {
    totalBots: number;
    activeBots: number;
    totalCustomers: number;
    newCustomersPeriod: number;
    attributionNote: string;
  };
  recentSales: Array<{
    id: string;
    total: number;
    status: string;
    paymentMethod: string | null;
    splitStatus: string | null;
    splitAmountCents: number | null;
    createdAt: string;
    customerName: string;
    storeName: string;
    sellerName: string;
  }>;
}

export class AdminDashboardService {
  /**
   * Resolves period boundaries in America/Recife timezone (UTC-3).
   * Guarantees exact, consistent day counts for current and prior periods.
   */
  public static resolvePeriod(
    periodParam: string = "30d",
    referenceDate: Date = new Date()
  ): PeriodResolution {
    const validPeriod: AdminDashboardPeriod =
      periodParam === "7d" || periodParam === "90d" ? periodParam : "30d";

    const days = validPeriod === "7d" ? 7 : validPeriod === "90d" ? 90 : 30;
    const periodLabel =
      validPeriod === "7d"
        ? "Últimos 7 dias"
        : validPeriod === "90d"
        ? "Últimos 90 dias"
        : "Últimos 30 dias";

    const startOfToday = getBusinessStartOfDay(referenceDate);

    // Current period spans (days - 1) full days before today plus today
    const startDate = new Date(startOfToday.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const endDate = referenceDate;

    // Previous equivalent period spans identical duration immediately before startDate
    const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    const previousEndDate = new Date(startDate.getTime() - 1);

    return {
      period: validPeriod,
      periodLabel,
      days,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      startOfToday,
    };
  }

  /**
   * Calculates percentage variation safely. Returns null when comparison is meaningless.
   */
  public static calculatePercentage(current: number, previous: number): number | null {
    if (previous <= 0) {
      return current > 0 ? 100 : null;
    }
    const val = ((current - previous) / previous) * 100;
    return Number(val.toFixed(1));
  }

  /**
   * Loads all real metrics for the admin dashboard using grouped SQL aggregations.
   */
  public static async getDashboardStats(
    periodParam: string = "30d",
    now: Date = new Date()
  ): Promise<AdminDashboardData> {
    const resolution = this.resolvePeriod(periodParam, now);
    const { startDate, previousStartDate, previousEndDate, startOfToday, days } = resolution;

    // 1. Parallel Aggregations for Primary KPIs
    const [
      // Sellers
      totalSellersRes,
      currSellersRes,
      prevSellersRes,

      // Stores
      totalStoresRes,
      currStoresRes,
      prevStoresRes,

      // Bots
      totalBotsRes,
      currBotsRes,
      prevBotsRes,

      // Products
      totalProductsRes,
      currProductsRes,
      prevProductsRes,

      // Telegram Customers
      totalCustomersRes,
      currCustomersRes,
      prevCustomersRes,

      // Paid Orders
      totalPaidOrdersRes,
      currPaidOrdersRes,
      prevPaidOrdersRes,

      // GMV
      totalGmvRes,
      currGmvRes,
      prevGmvRes,

      // Platform Processed Fees
      totalProcessedFeesRes,
      currProcessedFeesRes,
      prevProcessedFeesRes,

      // Pix Generated in Current Period
      currPixGeneratedRes,

      // Pix Paid in Current Period
      currPixPaidRes,
    ] = await Promise.all([
      // Sellers
      db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "seller")),
      db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "seller"), gte(users.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "seller"), gte(users.createdAt, previousStartDate), lte(users.createdAt, previousEndDate))),

      // Stores
      db.select({ count: sql<number>`count(*)` }).from(stores),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(gte(stores.createdAt, startDate)),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(and(gte(stores.createdAt, previousStartDate), lte(stores.createdAt, previousEndDate))),

      // Bots
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(eq(telegramBots.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(and(eq(telegramBots.status, "active"), gte(telegramBots.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(and(eq(telegramBots.status, "active"), gte(telegramBots.createdAt, previousStartDate), lte(telegramBots.createdAt, previousEndDate))),

      // Products
      db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.status, "active"), gte(products.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.status, "active"), gte(products.createdAt, previousStartDate), lte(products.createdAt, previousEndDate))),

      // Customers
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers),
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers).where(gte(telegramCustomers.createdAt, startDate)),
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers).where(and(gte(telegramCustomers.createdAt, previousStartDate), lte(telegramCustomers.createdAt, previousEndDate))),

      // Paid Orders
      db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "paid")),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.createdAt, previousStartDate), lte(orders.createdAt, previousEndDate))),

      // GMV
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)` }).from(orders).where(eq(orders.status, "paid")),
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)` }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.createdAt, startDate))),
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.total} as numeric)), 0)` }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.createdAt, previousStartDate), lte(orders.createdAt, previousEndDate))),

      // Processed Fees (Confirmed/Accepted Splits)
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.splitAmountCents} as numeric) / 100), 0)` })
        .from(orders)
        .where(and(eq(orders.status, "paid"), inArray(orders.splitStatus, ["PROCESSED", "CONFIRMED", "GATEWAY_ACCEPTED"]))),
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.splitAmountCents} as numeric) / 100), 0)` })
        .from(orders)
        .where(and(eq(orders.status, "paid"), inArray(orders.splitStatus, ["PROCESSED", "CONFIRMED", "GATEWAY_ACCEPTED"]), gte(orders.createdAt, startDate))),
      db.select({ sum: sql<number>`coalesce(sum(cast(${orders.splitAmountCents} as numeric) / 100), 0)` })
        .from(orders)
        .where(and(
          eq(orders.status, "paid"),
          inArray(orders.splitStatus, ["PROCESSED", "CONFIRMED", "GATEWAY_ACCEPTED"]),
          gte(orders.createdAt, previousStartDate),
          lte(orders.createdAt, previousEndDate)
        )),

      // Pix Generated in Current Period
      db.select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
          gte(orders.createdAt, startDate),
          sql`(${orders.paymentMethod} = 'pix' OR ${orders.pixQrCode} IS NOT NULL)`
        )),

      // Pix Paid in Current Period
      db.select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
          eq(orders.status, "paid"),
          eq(orders.paymentMethod, "pix"),
          gte(orders.createdAt, startDate)
        )),
    ]);

    const totalSellers = Number(totalSellersRes[0]?.count || 0);
    const currSellers = Number(currSellersRes[0]?.count || 0);
    const prevSellers = Number(prevSellersRes[0]?.count || 0);

    const totalStores = Number(totalStoresRes[0]?.count || 0);
    const currStores = Number(currStoresRes[0]?.count || 0);
    const prevStores = Number(prevStoresRes[0]?.count || 0);

    const totalBots = Number(totalBotsRes[0]?.count || 0);
    const currBots = Number(currBotsRes[0]?.count || 0);
    const prevBots = Number(prevBotsRes[0]?.count || 0);

    const totalProducts = Number(totalProductsRes[0]?.count || 0);
    const currProducts = Number(currProductsRes[0]?.count || 0);
    const prevProducts = Number(prevProductsRes[0]?.count || 0);

    const totalCustomers = Number(totalCustomersRes[0]?.count || 0);
    const currCustomers = Number(currCustomersRes[0]?.count || 0);
    const prevCustomers = Number(prevCustomersRes[0]?.count || 0);

    const totalPaidOrders = Number(totalPaidOrdersRes[0]?.count || 0);
    const currPaidOrders = Number(currPaidOrdersRes[0]?.count || 0);
    const prevPaidOrders = Number(prevPaidOrdersRes[0]?.count || 0);

    const totalGmv = Number(totalGmvRes[0]?.sum || 0);
    const currGmv = Number(currGmvRes[0]?.sum || 0);
    const prevGmv = Number(prevGmvRes[0]?.sum || 0);

    const totalProcessedFees = Number(totalProcessedFeesRes[0]?.sum || 0);
    const currProcessedFees = Number(currProcessedFeesRes[0]?.sum || 0);
    const prevProcessedFees = Number(prevProcessedFeesRes[0]?.sum || 0);

    const pixGeneratedCount = Number(currPixGeneratedRes[0]?.count || 0);
    const pixPaidCount = Number(currPixPaidRes[0]?.count || 0);
    const pixConversionRate =
      pixGeneratedCount > 0
        ? Number(((pixPaidCount / pixGeneratedCount) * 100).toFixed(1))
        : null;

    // 2. Build Daily Evolution Map in America/Recife
    const dailyMap = new Map<string, { date: string; label: string; ordersCount: number; gmv: number; pixGenerated: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const dayInstant = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
      const key = getBusinessDateKey(dayInstant);
      const label = getBusinessChartDateLabel(dayInstant);
      dailyMap.set(key, { date: key, label, ordersCount: 0, gmv: 0, pixGenerated: 0 });
    }

    // Load period orders to aggregate daily evolution and platform fee breakdown
    const periodOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        paymentMethod: orders.paymentMethod,
        pixQrCode: orders.pixQrCode,
        splitStatus: orders.splitStatus,
        splitAmountCents: orders.splitAmountCents,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(gte(orders.createdAt, startDate));

    // Platform Fee Breakdown Counters
    let expectedFeeTotal = 0;
    let processedFeeTotal = 0;
    let processedCount = 0;
    let settledFeeTotal = 0;
    let settledCount = 0;
    let pendingFeeTotal = 0;
    let pendingCount = 0;
    let skippedFeeTotal = 0;
    let skippedCount = 0;
    let failedFeeTotal = 0;
    let failedCount = 0;

    for (const ord of periodOrders) {
      const key = getBusinessDateKey(new Date(ord.createdAt));
      const entry = dailyMap.get(key);

      const isPaid = ord.status === "paid";
      const isPix = ord.paymentMethod === "pix" || Boolean(ord.pixQrCode);

      if (entry) {
        if (isPix) {
          entry.pixGenerated += 1;
        }
        if (isPaid) {
          entry.ordersCount += 1;
          entry.gmv += Number(ord.total || 0);
        }
      }

      // Platform fee categorization exclusively for paid orders
      if (isPaid) {
        const feeCents = typeof ord.splitAmountCents === "number" ? ord.splitAmountCents : 50;
        const feeReais = feeCents / 100;
        expectedFeeTotal += feeReais;

        const st = (ord.splitStatus || "PENDING").toUpperCase();
        if (st === "SETTLED") {
          settledFeeTotal += feeReais;
          settledCount += 1;
        } else if (st === "PROCESSED" || st === "CONFIRMED" || st === "GATEWAY_ACCEPTED") {
          processedFeeTotal += feeReais;
          processedCount += 1;
        } else if (st === "SKIPPED") {
          skippedFeeTotal += feeReais;
          skippedCount += 1;
        } else if (st === "FAILED") {
          failedFeeTotal += feeReais;
          failedCount += 1;
        } else {
          // PENDING or REQUESTED
          pendingFeeTotal += feeReais;
          pendingCount += 1;
        }
      }
    }

    const dailyEvolution: DailyEvolutionItem[] = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      label: d.label,
      ordersCount: d.ordersCount,
      gmv: Number(d.gmv.toFixed(2)),
      pixGenerated: d.pixGenerated,
    }));

    // 3. Top Sellers Ranking (Single aggregated SQL query)
    const sellerRankingRaw = await db
      .select({
        sellerId: users.id,
        sellerName: users.name,
        sellerEmail: users.email,
        storeName: stores.name,
        storeSlug: stores.slug,
        paidOrdersCount: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
        approvedGmv: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
        processedFees: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' and ${orders.splitStatus} in ('PROCESSED', 'CONFIRMED', 'GATEWAY_ACCEPTED') then cast(${orders.splitAmountCents} as numeric) / 100 else 0 end), 0)`,
        totalFeesExpected: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then cast(coalesce(${orders.splitAmountCents}, 50) as numeric) / 100 else 0 end), 0)`,
      })
      .from(users)
      .leftJoin(stores, eq(stores.ownerId, users.id))
      .leftJoin(
        orders,
        and(eq(orders.storeId, stores.id), gte(orders.createdAt, startDate))
      )
      .where(eq(users.role, "seller"))
      .groupBy(users.id, users.name, users.email, stores.id, stores.name, stores.slug)
      .orderBy(desc(sql`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`))
      .limit(10);

    const sellerRanking: SellerRankingItem[] = sellerRankingRaw.map((s) => ({
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      sellerEmail: s.sellerEmail,
      storeName: s.storeName || null,
      storeSlug: s.storeSlug || null,
      paidOrdersCount: Number(s.paidOrdersCount || 0),
      approvedGmv: Number(Number(s.approvedGmv || 0).toFixed(2)),
      processedFees: Number(Number(s.processedFees || 0).toFixed(2)),
      totalFeesExpected: Number(Number(s.totalFeesExpected || 0).toFixed(2)),
    }));

    // 4. Recent Sales (Last 10 paid orders)
    const recentSalesRaw = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        splitStatus: orders.splitStatus,
        splitAmountCents: orders.splitAmountCents,
        createdAt: orders.createdAt,
        customerFirstName: telegramCustomers.firstName,
        customerUsername: telegramCustomers.username,
        storeName: stores.name,
        sellerName: users.name,
      })
      .from(orders)
      .innerJoin(telegramCustomers, eq(orders.customerId, telegramCustomers.id))
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .innerJoin(users, eq(stores.ownerId, users.id))
      .where(eq(orders.status, "paid"))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const recentSales = recentSalesRaw.map((s) => ({
      id: s.id,
      total: Number(s.total),
      status: s.status,
      paymentMethod: s.paymentMethod,
      splitStatus: s.splitStatus,
      splitAmountCents: s.splitAmountCents,
      createdAt: s.createdAt.toISOString(),
      customerName: s.customerFirstName || (s.customerUsername ? `@${s.customerUsername}` : "Cliente Telegram"),
      storeName: s.storeName,
      sellerName: s.sellerName,
    }));

    return {
      period: resolution.period,
      periodLabel: resolution.periodLabel,
      updatedAt: new Intl.DateTimeFormat("pt-BR", {
        timeZone: BUSINESS_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now),
      startDate: resolution.startDate.toISOString(),
      endDate: resolution.endDate.toISOString(),
      kpis: {
        sellers: {
          total: totalSellers,
          current: currSellers,
          changePercent: this.calculatePercentage(currSellers, prevSellers),
        },
        stores: {
          total: totalStores,
          current: currStores,
          changePercent: this.calculatePercentage(currStores, prevStores),
        },
        bots: {
          total: totalBots,
          current: currBots,
          changePercent: this.calculatePercentage(currBots, prevBots),
        },
        products: {
          total: totalProducts,
          current: currProducts,
          changePercent: this.calculatePercentage(currProducts, prevProducts),
        },
        telegramCustomers: {
          total: totalCustomers,
          current: currCustomers,
          changePercent: this.calculatePercentage(currCustomers, prevCustomers),
        },
        paidOrders: {
          total: totalPaidOrders,
          current: currPaidOrders,
          changePercent: this.calculatePercentage(currPaidOrders, prevPaidOrders),
        },
        gmv: {
          total: Number(totalGmv.toFixed(2)),
          current: Number(currGmv.toFixed(2)),
          changePercent: this.calculatePercentage(currGmv, prevGmv),
        },
        processedFees: {
          total: Number(totalProcessedFees.toFixed(2)),
          current: Number(currProcessedFees.toFixed(2)),
          changePercent: this.calculatePercentage(currProcessedFees, prevProcessedFees),
        },
      },
      salesAndPayments: {
        pixGeneratedCount,
        pixPaidCount,
        pixConversionRate,
        paidOrdersCount: currPaidOrders,
        gmvApproved: Number(currGmv.toFixed(2)),
        dailyEvolution,
      },
      platformFees: {
        expectedFeeTotal: Number(expectedFeeTotal.toFixed(2)),
        processedFeeTotal: Number(processedFeeTotal.toFixed(2)),
        processedCount,
        settledFeeTotal: Number(settledFeeTotal.toFixed(2)),
        settledCount,
        pendingFeeTotal: Number(pendingFeeTotal.toFixed(2)),
        pendingCount,
        skippedFeeTotal: Number(skippedFeeTotal.toFixed(2)),
        skippedCount,
        failedFeeTotal: Number(failedFeeTotal.toFixed(2)),
        failedCount,
      },
      sellerRanking,
      telegramStats: {
        totalBots,
        activeBots: totalBots,
        totalCustomers,
        newCustomersPeriod: currCustomers,
        attributionNote:
          "Os pedidos e faturamentos são liquidados por loja. O WebGran não realiza atribuições artificiais de faturamento a bots específicos caso múltiplos bots estejam vinculados à mesma loja.",
      },
      recentSales,
    };
  }
}

