import { db } from "@/db";
import { 
  orders, 
  orderItems, 
  products, 
  telegramCustomers, 
  accesses, 
  categories, 
  stores,
  telegramBots,
  botStartEvents
} from "@/db/schema";
import { eq, and, gte, lte, count, desc, sum, sql } from "drizzle-orm";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { CommercialMetricsService, CommercialMetrics, resolvePeriodDateRange } from "@/lib/analytics/commercial-metrics-service";
import {
  BUSINESS_TIMEZONE,
  getBusinessDateKey,
  getBusinessDateLabel,
  getBusinessStartOfDay,
  getBusinessEndOfDay,
  getBusinessParts,
  parseCivilDate,
  formatCivilDateToBR,
} from "@/lib/analytics/timezone-utils";

export interface KpiMetric {
  value: number;
  formatted: string;
  changePercent: number | null;
  trend: 'up' | 'down' | 'neutral' | 'none';
  subtitle: string;
}

export interface ChartPoint {
  dateLabel: string;
  fullDate: string;
  revenue: number;
  salesCount: number;
}

export interface ChannelItem {
  channel: string;
  label: string;
  revenue: number;
  salesCount: number;
  percentage: number;
  photoUrl?: string | null;
  username?: string | null;
  uniqueStarts?: number;
  uniqueBuyers?: number;
  conversionRate?: number | null;
}

export interface TopProductItem {
  id: string;
  title: string;
  coverUrl: string | null;
  salesCount: number;
  revenue: number;
  percentage?: number;
}

export interface RecentOrder {
  id: string;
  customerName: string;
  productTitle: string;
  total: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  timeAgo: string;
}

export interface HourlySalesPoint {
  hour: number;
  hourLabel: string;
  salesCount: number;
  revenue: number;
}

export interface ActivityStats {
  salesToday: number;
  newCustomersPeriod: number;
  customersToday: number;
  activeAccesses: number;
  pendingPayments: number;
  pendingDeliveries: number;
}

export interface CatalogOverview {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  categoriesCount: number;
}

export type ActivityLogType = 'lead' | 'sale_approved' | 'payment_pending';

export interface ActivityLogItem {
  id: string;
  type: ActivityLogType;
  title: string;
  targetName: string;
  description: string;
  timestamp: string;
  dateFormatted: string;
  timeFormatted: string;
  botName?: string | null;
  statusBadge?: 'success' | 'pending' | 'info';
}

export interface StoreAnalyticsData {
  period: string;
  storeName: string;
  userName?: string;
  kpis: {
    revenue: KpiMetric;
    salesCount: KpiMetric;
    customersCount: KpiMetric;
    averageTicket: KpiMetric;
  };
  chartSeries: ChartPoint[];
  channels: ChannelItem[];
  topProducts: TopProductItem[];
  recentOrders: RecentOrder[];
  hourlySales: HourlySalesPoint[];
  activity: ActivityStats;
  activityLog: ActivityLogItem[];
  catalog: CatalogOverview;
  hasSales: boolean;
  commercialMetrics: CommercialMetrics;
}

function calcChange(curr: number, prev: number): { changePercent: number | null; trend: 'up' | 'down' | 'neutral' | 'none' } {
  if (prev <= 0 && curr <= 0) return { changePercent: 0, trend: 'neutral' };
  if (prev <= 0) return { changePercent: 100, trend: 'up' };
  const diff = curr - prev;
  const pct = Math.round((diff / prev) * 100);
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (pct > 0) trend = 'up';
  if (pct < 0) trend = 'down';
  return { changePercent: pct, trend };
}

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "agora mesmo";
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 172800) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short"
  }).format(date);
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export class AnalyticsService {
  public static async getStoreAnalytics(
    storeId: string, 
    period: string = "30D",
    options?: { botId?: string | null }
  ): Promise<StoreAnalyticsData> {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      with: {
        owner: true
      }
    });

    if (store?.ownerId) {
      const allowed = await hasFeature(store.ownerId, "analytics_reports_enabled");
      if (!allowed) {
        throw new Error("Relatórios analíticos não estão disponíveis no seu plano. Faça upgrade.");
      }
    }

    const storeName = store?.name || "Minha Loja";
    const userName = store?.owner?.name || "";

    const now = new Date();
    const startOfToday = getBusinessStartOfDay(now);
    const { startDate, endDate } = resolvePeriodDateRange(period, now);
    const currentStart = startDate;
    const currentEnd = endDate;

    let prevStart: Date | null = null;
    let prevEnd: Date | null = null;

    if (period.startsWith("CUSTOM:")) {
      const duration = currentEnd.getTime() - currentStart.getTime();
      prevEnd = currentStart;
      prevStart = new Date(prevEnd.getTime() - duration);
    } else {
      switch (period) {
        case "TODAY": {
          prevStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
          prevEnd = currentStart;
          break;
        }
        case "7D": {
          prevStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          prevEnd = currentStart;
          break;
        }
        case "90D": {
          prevStart = new Date(currentStart.getTime() - 90 * 24 * 60 * 60 * 1000);
          prevEnd = currentStart;
          break;
        }
        case "THIS_MONTH": {
          const { year, month } = getBusinessParts(now);
          let pYear = year;
          let pMonth = month - 1;
          if (pMonth <= 0) {
            pMonth = 12;
            pYear -= 1;
          }
          prevStart = new Date(Date.UTC(pYear, pMonth - 1, 1, 3, 0, 0, 0));
          prevEnd = currentStart;
          break;
        }
        case "LAST_MONTH": {
          const { year, month } = getBusinessParts(now);
          let targetYear = year;
          let targetMonth = month - 1;
          if (targetMonth <= 0) {
            targetMonth = 12;
            targetYear -= 1;
          }
          let pYear = targetYear;
          let pMonth = targetMonth - 1;
          if (pMonth <= 0) {
            pMonth = 12;
            pYear -= 1;
          }
          prevStart = new Date(Date.UTC(pYear, pMonth - 1, 1, 3, 0, 0, 0));
          prevEnd = currentStart;
          break;
        }
        case "THIS_YEAR": {
          const { year } = getBusinessParts(now);
          prevStart = new Date(Date.UTC(year - 1, 0, 1, 3, 0, 0, 0));
          prevEnd = currentStart;
          break;
        }
        case "12M": {
          const { year, month } = getBusinessParts(now);
          let startYear = year;
          let startMonth = month - 11;
          while (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
          }
          prevStart = new Date(Date.UTC(startYear - 1, startMonth - 1, 1, 3, 0, 0, 0));
          prevEnd = currentStart;
          break;
        }
        case "ALL": {
          prevStart = null;
          prevEnd = null;
          break;
        }
        case "30D":
        default: {
          prevStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
          prevEnd = currentStart;
          break;
        }
      }
    }

    // Fetch store data concurrently with date range optimization
    const oldestDate = prevStart || currentStart;
    const orderWhere = period === "ALL" 
      ? eq(orders.storeId, storeId)
      : and(eq(orders.storeId, storeId), gte(orders.createdAt, oldestDate));

    const fetchBotStarts = async () => {
      try {
        if (db.query?.botStartEvents?.findMany) {
          return await db.query.botStartEvents.findMany({
            where: period === "ALL"
              ? eq(botStartEvents.storeId, storeId)
              : and(eq(botStartEvents.storeId, storeId), gte(botStartEvents.createdAt, oldestDate)),
            columns: {
              id: true,
              botId: true,
              telegramUserId: true,
              telegramUsername: true,
              telegramFirstName: true,
              createdAt: true,
            },
            orderBy: [desc(botStartEvents.createdAt)],
            limit: 40,
          });
        }
        if (typeof db.select === "function") {
          return await db
            .select({
              id: botStartEvents.id,
              botId: botStartEvents.botId,
              telegramUserId: botStartEvents.telegramUserId,
              telegramUsername: botStartEvents.telegramUsername,
              telegramFirstName: botStartEvents.telegramFirstName,
              createdAt: botStartEvents.createdAt,
            })
            .from(botStartEvents)
            .where(
              period === "ALL"
                ? eq(botStartEvents.storeId, storeId)
                : and(eq(botStartEvents.storeId, storeId), gte(botStartEvents.createdAt, oldestDate))
            )
            .orderBy(desc(botStartEvents.createdAt))
            .limit(40);
        }
        return [];
      } catch (err: any) {
        console.warn("[AnalyticsService] Warning querying botStartEvents for activity log:", err?.message);
        return [];
      }
    };

    const [allOrders, allStoreAccesses, allStoreProducts, allStoreCategories, botStarts, storeBots] = await Promise.all([
      db.query.orders.findMany({
        where: orderWhere,
        with: {
          customer: true,
          items: {
            with: {
              product: true
            }
          }
        },
        orderBy: [desc(orders.createdAt)],
        limit: period === "ALL" ? 1000 : 500
      }),
      db.query.accesses.findMany({
        where: eq(accesses.storeId, storeId),
        columns: { id: true, status: true, deliveryStatus: true, orderId: true }
      }),
      db.query.products.findMany({
        where: eq(products.storeId, storeId),
        columns: { id: true, status: true }
      }),
      db.query.categories.findMany({
        where: eq(categories.storeId, storeId),
        columns: { id: true }
      }),
      fetchBotStarts(),
      db.query.telegramBots.findMany({
        where: eq(telegramBots.storeId, storeId),
      }),
    ]);

    // Apply bot-scoping if options.botId is provided (strictly based on explicit product.botId linkage)
    const selectedBotId = options?.botId;
    const orderMatchesBot = (o: typeof allOrders[0]) => {
      if (!selectedBotId) return true;
      if (o.items && o.items.some(it => it.product?.botId === selectedBotId)) return true;
      return false;
    };

    const scopedOrders = selectedBotId ? allOrders.filter(orderMatchesBot) : allOrders;
    const scopedBotStarts = selectedBotId
      ? (botStarts || []).filter(bs => (bs as any).botId === selectedBotId)
      : (botStarts || []);

    const paidOrders = scopedOrders.filter(o => o.status === 'paid');
    const pendingOrders = scopedOrders.filter(o => o.status === 'pending');

    // Filter paid orders for current vs previous periods (start inclusive, end exclusive)
    const currentPaidOrders = paidOrders.filter(o => {
      const d = new Date(o.paidAt || o.createdAt);
      return d >= currentStart && d < currentEnd;
    });

    const prevPaidOrders = prevStart && prevEnd ? paidOrders.filter(o => {
      const d = new Date(o.paidAt || o.createdAt);
      return d >= prevStart! && d < prevEnd!;
    }) : [];

    // Current KPIs
    const currRevenue = currentPaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const prevRevenue = prevPaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const revChange = prevStart ? calcChange(currRevenue, prevRevenue) : { changePercent: null, trend: 'none' as const };

    const currSales = currentPaidOrders.length;
    const prevSales = prevPaidOrders.length;
    const salesChange = prevStart ? calcChange(currSales, prevSales) : { changePercent: null, trend: 'none' as const };

    const currTicket = currSales > 0 ? currRevenue / currSales : 0;
    const prevTicket = prevSales > 0 ? prevRevenue / prevSales : 0;
    const ticketChange = prevStart ? calcChange(currTicket, prevTicket) : { changePercent: null, trend: 'none' as const };

    // Customers in period
    const allCustomers = await db.query.telegramCustomers.findMany({
      where: eq(telegramCustomers.storeId, storeId)
    });

    const currCustomersList = allCustomers.filter(c => {
      const d = new Date(c.createdAt);
      return d >= currentStart && d < currentEnd;
    });
    const prevCustomersList = prevStart && prevEnd ? allCustomers.filter(c => {
      const d = new Date(c.createdAt);
      return d >= prevStart! && d < prevEnd!;
    }) : [];

    const currCustCount = currCustomersList.length;
    const prevCustCount = prevCustomersList.length;
    const custChange = prevStart ? calcChange(currCustCount, prevCustCount) : { changePercent: null, trend: 'none' as const };

    // Format Period Label for Subtitle
    let periodLabel = `vs ${period} anteriores`;
    if (period === "TODAY") periodLabel = "vs ontem";
    else if (period === "THIS_MONTH") periodLabel = "vs mês anterior";
    else if (period === "LAST_MONTH") periodLabel = "vs 2 meses atrás";
    else if (period === "THIS_YEAR") periodLabel = "vs ano anterior";
    else if (period === "ALL") periodLabel = "todo o período";
    else if (period.startsWith("CUSTOM:")) periodLabel = "vs período anterior";

    // 1. Chart Series Generation (Grouped by Day or Month)
    const chartMap = new Map<string, { fullDate: string; revenue: number; salesCount: number }>();

    if (period === "TODAY") {
      // 24 hours of today
      for (let h = 0; h < 24; h += 2) {
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        chartMap.set(hourStr, { fullDate: hourStr, revenue: 0, salesCount: 0 });
      }
      currentPaidOrders.forEach(o => {
        const d = new Date(o.paidAt || o.createdAt);
        const businessHour = getBusinessParts(d).hour;
        const h = Math.floor(businessHour / 2) * 2;
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        const item = chartMap.get(hourStr);
        if (item) {
          item.revenue += Number(o.total || 0);
          item.salesCount += 1;
        }
      });
    } else if (period === "12M" || period === "ALL") {
      // Group by Month (12 months)
      const months = 12;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleDateString("pt-BR", { month: "short" });
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        chartMap.set(monthKey, { fullDate: monthLabel, revenue: 0, salesCount: 0 });
      }
      currentPaidOrders.forEach(o => {
        const d = new Date(o.paidAt || o.createdAt);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const item = chartMap.get(monthKey);
        if (item) {
          item.revenue += Number(o.total || 0);
          item.salesCount += 1;
        }
      });
    } else {
      // Group by Day (7D, 30D, 90D) in America/Recife timezone
      const days = period === "7D" ? 7 : period === "90D" ? 90 : 30;
      const step = period === "90D" ? 3 : 1; // Group every 3 days for 90D to keep SVG chart clean
      
      for (let i = days - 1; i >= 0; i -= step) {
        const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = getBusinessDateKey(d);
        const dateLabel = getBusinessDateLabel(d);
        chartMap.set(dateKey, { fullDate: dateLabel, revenue: 0, salesCount: 0 });
      }

      currentPaidOrders.forEach(o => {
        const d = new Date(o.paidAt || o.createdAt);
        const dateKey = getBusinessDateKey(d);
        // Find closest date key if stepped
        let targetKey = dateKey;
        if (!chartMap.has(targetKey)) {
          const keys = Array.from(chartMap.keys());
          targetKey = keys.reduce((prev, curr) => 
            Math.abs(new Date(curr).getTime() - d.getTime()) < Math.abs(new Date(prev).getTime() - d.getTime()) ? curr : prev, keys[0]);
        }
        const item = chartMap.get(targetKey);
        if (item) {
          item.revenue += Number(o.total || 0);
          item.salesCount += 1;
        }
      });
    }

    const chartSeries: ChartPoint[] = Array.from(chartMap.entries()).map(([key, val]) => ({
      dateLabel: val.fullDate,
      fullDate: val.fullDate,
      revenue: Math.round(val.revenue * 100) / 100,
      salesCount: val.salesCount
    }));

    // 2. Channels Breakdown (Registered Telegram Bots Only)
    const botStatsMap = new Map<string, {
      id: string;
      label: string;
      username: string | null;
      photoUrl: string | null;
      revenue: number;
      salesCount: number;
      uniqueBuyers: Set<string>;
      uniqueStarts: number;
    }>();

    storeBots.forEach(b => {
      const cleanUser = b.username ? (b.username.startsWith("@") ? b.username : `@${b.username}`) : null;
      let label = cleanUser || b.displayName || "Bot Telegram";
      if (b.displayName && cleanUser && b.displayName.toLowerCase() !== cleanUser.toLowerCase()) {
        label = `${b.displayName} (${cleanUser})`;
      }
      botStatsMap.set(b.id, {
        id: b.id,
        label,
        username: cleanUser,
        photoUrl: b.photoUrl,
        revenue: 0,
        salesCount: 0,
        uniqueBuyers: new Set<string>(),
        uniqueStarts: 0,
      });
    });

    let fallbackTelegramRevenue = 0;
    let fallbackTelegramCount = 0;

    currentPaidOrders.forEach(o => {
      const orderTotal = Number(o.total || 0);

      let matchedBotId: string | null = null;
      if (o.items && o.items.length > 0) {
        for (const item of o.items) {
          if (item.product?.botId) {
            matchedBotId = item.product.botId;
            break;
          }
        }
      }

      if (matchedBotId && botStatsMap.has(matchedBotId)) {
        const stats = botStatsMap.get(matchedBotId)!;
        stats.revenue += orderTotal;
        stats.salesCount += 1;
        if (o.customerId) stats.uniqueBuyers.add(o.customerId);
      } else {
        fallbackTelegramRevenue += orderTotal;
        fallbackTelegramCount += 1;
      }
    });

    // Calculate unique starts per bot in period from botStarts
    (botStarts || []).forEach(bs => {
      const bId = (bs as any).botId;
      if (bId && botStatsMap.has(bId)) {
        botStatsMap.get(bId)!.uniqueStarts += 1;
      }
    });

    let botTotalRevenue = 0;
    botStatsMap.forEach(s => { botTotalRevenue += s.revenue; });
    botTotalRevenue += fallbackTelegramRevenue;
    const totalBotRev = botTotalRevenue || 1;

    const channels: ChannelItem[] = [];

    botStatsMap.forEach(stats => {
      const avatarUrl = stats.id ? `/api/telegram/bot-avatar?botId=${stats.id}` : (stats.photoUrl || null);
      const conversionRate = stats.uniqueStarts > 0
        ? Math.round((stats.salesCount / stats.uniqueStarts) * 1000) / 10
        : (stats.salesCount > 0 ? 100 : null);

      channels.push({
        channel: stats.id,
        label: stats.label,
        revenue: Math.round(stats.revenue * 100) / 100,
        salesCount: stats.salesCount,
        percentage: Math.round((stats.revenue / totalBotRev) * 100),
        photoUrl: avatarUrl,
        username: stats.username,
        uniqueStarts: stats.uniqueStarts,
        uniqueBuyers: stats.uniqueBuyers.size,
        conversionRate,
      });
    });

    if (fallbackTelegramCount > 0 || (storeBots.length === 0 && (currSales === 0 || fallbackTelegramCount > 0))) {
      channels.push({
        channel: "telegram_other",
        label: "Bot Telegram",
        revenue: Math.round(fallbackTelegramRevenue * 100) / 100,
        salesCount: fallbackTelegramCount,
        percentage: Math.round((fallbackTelegramRevenue / totalBotRev) * 100),
        uniqueStarts: 0,
        uniqueBuyers: fallbackTelegramCount,
        conversionRate: null,
      });
    }

    channels.sort((a, b) => b.revenue - a.revenue);

    // 3. Top Products Sold (From orderItems in current paid orders)
    const productStatsMap = new Map<string, { id: string; title: string; coverUrl: string | null; salesCount: number; revenue: number }>();

    currentPaidOrders.forEach(o => {
      o.items?.forEach(item => {
        if (!item.productId) return;
        const prodId = item.productId;
        const prodTitle = item.product?.title || "Produto Digital";
        const coverUrl = item.product?.coverUrl || null;
        const qty = item.quantity || 1;
        const rev = Number(item.total || Number(item.unitPrice || 0) * qty);

        const existing = productStatsMap.get(prodId) || {
          id: prodId,
          title: prodTitle,
          coverUrl,
          salesCount: 0,
          revenue: 0
        };

        existing.salesCount += qty;
        existing.revenue += rev;
        productStatsMap.set(prodId, existing);
      });
    });

    const topProducts: TopProductItem[] = Array.from(productStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount)
      .slice(0, 5)
      .map(p => ({
        ...p,
        percentage: currRevenue > 0 ? Math.round((p.revenue / currRevenue) * 100) : 0,
      }));

    // 4. Recent Orders (Latest 10)
    const recentOrders: RecentOrder[] = allOrders.slice(0, 10).map(o => {
      const prodTitle = o.items?.[0]?.product?.title || "Produto Digital";
      const customerName = o.customer?.firstName 
        ? `${o.customer.firstName} ${o.customer.lastName || ''}`.trim() 
        : o.customer?.username ? `@${o.customer.username}` : "Cliente Telegram";

      return {
        id: o.id,
        customerName,
        productTitle: prodTitle,
        total: Number(o.total || 0),
        status: o.status,
        paymentMethod: o.paymentMethod || "PIX",
        createdAt: new Date(o.createdAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(o.createdAt))
      };
    });

    // 5. Hourly Sales Distribution (24 Hours 00..23)
    const hourlyMap = new Array(24).fill(0).map((_, h) => ({
      hour: h,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      salesCount: 0,
      revenue: 0
    }));

    currentPaidOrders.forEach(o => {
      const d = new Date(o.paidAt || o.createdAt);
      const h = getBusinessParts(d).hour;
      hourlyMap[h].salesCount += 1;
      hourlyMap[h].revenue += Number(o.total || 0);
    });

    // 6. Activity & Health Indicators (Fuso Oficial America/Recife)
    const recifeStartOfToday = getBusinessStartOfDay(now);
    const recifeEndOfToday = getBusinessEndOfDay(now);

    // Vendas hoje: pedidos estritamente confirmados como 'paid' dentro do dia oficial de Recife
    const salesToday = paidOrders.filter(o => {
      if (o.status !== 'paid') return false;
      const d = new Date(o.paidAt || o.createdAt);
      return d >= recifeStartOfToday && d < recifeEndOfToday;
    }).length;

    // Clientes cadastrados hoje no fuso oficial
    const customersToday = allCustomers.filter(c => {
      const d = new Date(c.createdAt);
      return d >= recifeStartOfToday && d < recifeEndOfToday;
    }).length;

    // Acessos liberados: apenas acessos ACTIVE vinculados a pedidos legítimos com pagamento confirmado
    const paidOrderIdsSet = new Set(paidOrders.map(o => o.id));
    const activeAccesses = allStoreAccesses.filter(a => {
      if (a.status !== 'ACTIVE') return false;
      // Se possui orderId associado, o pedido precisa obrigatoriamente estar pago
      if (a.orderId && !paidOrderIdsSet.has(a.orderId)) return false;
      return true;
    }).length;

    const pendingDeliveries = allStoreAccesses.filter(a => a.deliveryStatus === 'PENDING' || a.deliveryStatus === 'FAILED').length;

    // Pix pendentes: apenas pedidos que estejam REALMENTE aguardando pagamento (não expirados)
    const pendingPayments = pendingOrders.filter(o => {
      if (o.status !== 'pending') return false;
      if (o.pixExpiresAt) {
        return new Date(o.pixExpiresAt) > now;
      }
      // Se não possui expiração explícita, considerar pendente apenas se criado há menos de 1 hora
      const ageMs = now.getTime() - new Date(o.createdAt).getTime();
      return ageMs < 60 * 60 * 1000;
    }).length;

    const activity: ActivityStats = {
      salesToday,
      newCustomersPeriod: currCustCount,
      customersToday,
      activeAccesses,
      pendingPayments,
      pendingDeliveries
    };

    // 7. Catalog Overview
    const catalog: CatalogOverview = {
      totalProducts: allStoreProducts.length,
      activeProducts: allStoreProducts.filter(p => p.status === 'active').length,
      inactiveProducts: allStoreProducts.filter(p => p.status !== 'active').length,
      categoriesCount: allStoreCategories.length
    };

    // 8. Commercial Metrics (4 Reference KPI Cards)
    const commercialMetrics = await CommercialMetricsService.getCommercialMetrics(storeId, period, {
      botId: options?.botId,
    });

    // 9. Activity Log (Tempo real / Acontecimentos da Loja: Novo Lead, Venda Aprovada, Pagamento Pendente)
    const formatEventDateTime = (rawDate: any) => {
      const d = rawDate ? new Date(rawDate) : new Date();
      const validDate = isNaN(d.getTime()) ? new Date() : d;
      const parts = getBusinessParts(validDate);
      return {
        dateFormatted: `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`,
        timeFormatted: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
        isoString: validDate.toISOString(),
      };
    };

    const botNameLookup = new Map<string, string>();
    storeBots.forEach(b => {
      const name = b.displayName || (b.username ? `@${b.username.replace(/^@/, '')}` : 'Bot');
      botNameLookup.set(b.id, name);
    });

    const leadEvents: ActivityLogItem[] = scopedBotStarts.map((bs) => {
      const dt = formatEventDateTime(bs.createdAt);
      const targetName = bs.telegramFirstName?.trim()
        ? bs.telegramFirstName.trim()
        : bs.telegramUsername?.trim()
        ? `@${bs.telegramUsername.trim()}`
        : "Novo Lead";

      const bId = (bs as any).botId || null;
      const botName = bId ? botNameLookup.get(bId) || null : null;

      return {
        id: `lead-${bs.id}`,
        type: "lead" as const,
        title: "Novo Lead",
        targetName,
        description: "Iniciou conversa",
        timestamp: dt.isoString,
        dateFormatted: dt.dateFormatted,
        timeFormatted: dt.timeFormatted,
        botName,
        statusBadge: "info" as const,
      };
    });

    const saleEvents: ActivityLogItem[] = paidOrders.map((o) => {
      const dt = formatEventDateTime(o.paidAt || o.updatedAt || o.createdAt);
      const firstProduct = o.items?.[0]?.product?.title;
      const targetName = firstProduct
        ? o.items && o.items.length > 1
          ? `${firstProduct} (+${o.items.length - 1})`
          : firstProduct
        : "Produto Digital";

      const totalValue = Number(o.total || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      let bId: string | null = null;
      if (o.items && o.items.length > 0) {
        for (const it of o.items) {
          if (it.product?.botId) {
            bId = it.product.botId;
            break;
          }
        }
      }
      const botName = bId ? botNameLookup.get(bId) || null : null;

      return {
        id: `sale-${o.id}`,
        type: "sale_approved" as const,
        title: "Venda Aprovada",
        targetName,
        description: `Pagou R$ ${totalValue}`,
        timestamp: dt.isoString,
        dateFormatted: dt.dateFormatted,
        timeFormatted: dt.timeFormatted,
        botName,
        statusBadge: "success" as const,
      };
    });

    const pendingEvents: ActivityLogItem[] = pendingOrders.map((o) => {
      const dt = formatEventDateTime(o.createdAt);
      const firstProduct = o.items?.[0]?.product?.title;
      const targetName = firstProduct
        ? o.items && o.items.length > 1
          ? `${firstProduct} (+${o.items.length - 1})`
          : firstProduct
        : "Produto Digital";

      let bId: string | null = null;
      if (o.items && o.items.length > 0) {
        for (const it of o.items) {
          if (it.product?.botId) {
            bId = it.product.botId;
            break;
          }
        }
      }
      const botName = bId ? botNameLookup.get(bId) || null : null;

      return {
        id: `pending-${o.id}`,
        type: "payment_pending" as const,
        title: "Pagamento Pendente",
        targetName,
        description: "Aguardando pagamento",
        timestamp: dt.isoString,
        dateFormatted: dt.dateFormatted,
        timeFormatted: dt.timeFormatted,
        botName,
        statusBadge: "pending" as const,
      };
    });

    const combinedLog = [...leadEvents, ...saleEvents, ...pendingEvents];
    combinedLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const activityLog = combinedLog.slice(0, 30);

    return {
      period,
      storeName,
      userName,
      kpis: {
        revenue: {
          value: currRevenue,
          formatted: formatCurrency(currRevenue),
          changePercent: revChange.changePercent,
          trend: revChange.trend,
          subtitle: periodLabel
        },
        salesCount: {
          value: currSales,
          formatted: String(currSales),
          changePercent: salesChange.changePercent,
          trend: salesChange.trend,
          subtitle: periodLabel
        },
        customersCount: {
          value: currCustCount,
          formatted: String(currCustCount),
          changePercent: custChange.changePercent,
          trend: custChange.trend,
          subtitle: periodLabel
        },
        averageTicket: {
          value: currTicket,
          formatted: formatCurrency(currTicket),
          changePercent: ticketChange.changePercent,
          trend: ticketChange.trend,
          subtitle: periodLabel
        }
      },
      chartSeries,
      channels,
      topProducts,
      recentOrders,
      hourlySales: hourlyMap,
      activity,
      activityLog,
      catalog,
      hasSales: paidOrders.length > 0,
      commercialMetrics,
    };
  }
}
