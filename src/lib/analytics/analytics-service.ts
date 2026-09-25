import { db } from "@/db";
import { 
  orders, 
  orderItems, 
  products, 
  telegramCustomers, 
  accesses, 
  categories, 
  stores,
  telegramBots
} from "@/db/schema";
import { eq, and, gte, lte, count, desc, sum, sql } from "drizzle-orm";

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
}

export interface TopProductItem {
  id: string;
  title: string;
  coverUrl: string | null;
  salesCount: number;
  revenue: number;
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
  catalog: CatalogOverview;
  hasSales: boolean;
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
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export class AnalyticsService {
  public static async getStoreAnalytics(storeId: string, period: string = "30D"): Promise<StoreAnalyticsData> {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      with: {
        owner: true
      }
    });

    const storeName = store?.name || "Minha Loja";
    const userName = store?.owner?.name || "";

    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date(now);
    let prevStart: Date | null = new Date();
    let prevEnd: Date | null = new Date();

    switch (period) {
      case "TODAY": {
        currentStart.setHours(0, 0, 0, 0);
        prevStart.setDate(prevStart.getDate() - 1);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevEnd.setHours(23, 59, 59, 999);
        break;
      }
      case "7D": {
        currentStart.setDate(currentStart.getDate() - 7);
        prevStart.setDate(prevStart.getDate() - 14);
        prevEnd.setDate(prevEnd.getDate() - 7);
        break;
      }
      case "90D": {
        currentStart.setDate(currentStart.getDate() - 90);
        prevStart.setDate(prevStart.getDate() - 180);
        prevEnd.setDate(prevEnd.getDate() - 90);
        break;
      }
      case "12M": {
        currentStart.setFullYear(currentStart.getFullYear() - 1);
        prevStart.setFullYear(prevStart.getFullYear() - 2);
        prevEnd.setFullYear(prevEnd.getFullYear() - 1);
        break;
      }
      case "ALL": {
        currentStart = new Date(0);
        prevStart = null;
        prevEnd = null;
        break;
      }
      case "30D":
      default: {
        currentStart.setDate(currentStart.getDate() - 30);
        prevStart.setDate(prevStart.getDate() - 60);
        prevEnd.setDate(prevEnd.getDate() - 30);
        break;
      }
    }

    // Fetch store data concurrently with date range optimization
    const oldestDate = prevStart || currentStart;
    const orderWhere = period === "ALL" 
      ? eq(orders.storeId, storeId)
      : and(eq(orders.storeId, storeId), gte(orders.createdAt, oldestDate));

    const [allOrders, allStoreAccesses, allStoreProducts, allStoreCategories] = await Promise.all([
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
        columns: { id: true, status: true, deliveryStatus: true }
      }),
      db.query.products.findMany({
        where: eq(products.storeId, storeId),
        columns: { id: true, status: true }
      }),
      db.query.categories.findMany({
        where: eq(categories.storeId, storeId),
        columns: { id: true }
      })
    ]);

    const paidOrders = allOrders.filter(o => o.status === 'paid');
    const pendingOrders = allOrders.filter(o => o.status === 'pending');

    // Filter paid orders for current vs previous periods
    const currentPaidOrders = paidOrders.filter(o => {
      const d = new Date(o.paidAt || o.createdAt);
      return d >= currentStart && d <= currentEnd;
    });

    const prevPaidOrders = prevStart && prevEnd ? paidOrders.filter(o => {
      const d = new Date(o.paidAt || o.createdAt);
      return d >= prevStart! && d <= prevEnd!;
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
      return d >= currentStart && d <= currentEnd;
    });
    const prevCustomersList = prevStart && prevEnd ? allCustomers.filter(c => {
      const d = new Date(c.createdAt);
      return d >= prevStart! && d <= prevEnd!;
    }) : [];

    const currCustCount = currCustomersList.length;
    const prevCustCount = prevCustomersList.length;
    const custChange = prevStart ? calcChange(currCustCount, prevCustCount) : { changePercent: null, trend: 'none' as const };

    // Format Period Label for Subtitle
    const periodLabel = period === "TODAY" ? "vs ontem" : period === "ALL" ? "todo o período" : `vs ${period} anteriores`;

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
        const h = Math.floor(d.getHours() / 2) * 2;
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
      // Group by Day (7D, 30D, 90D)
      const days = period === "7D" ? 7 : period === "90D" ? 90 : 30;
      const step = period === "90D" ? 3 : 1; // Group every 3 days for 90D to keep SVG chart clean
      
      for (let i = days - 1; i >= 0; i -= step) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split("T")[0];
        const dateLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        chartMap.set(dateKey, { fullDate: dateLabel, revenue: 0, salesCount: 0 });
      }

      currentPaidOrders.forEach(o => {
        const d = new Date(o.paidAt || o.createdAt);
        const dateKey = d.toISOString().split("T")[0];
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
    const storeBots = await db.query.telegramBots.findMany({
      where: eq(telegramBots.storeId, storeId)
    });

    const botStatsMap = new Map<string, {
      id: string;
      label: string;
      username: string | null;
      photoUrl: string | null;
      revenue: number;
      salesCount: number;
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
        salesCount: 0
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
      } else {
        if (storeBots.length === 1 && botStatsMap.has(storeBots[0].id)) {
          const stats = botStatsMap.get(storeBots[0].id)!;
          stats.revenue += orderTotal;
          stats.salesCount += 1;
        } else {
          fallbackTelegramRevenue += orderTotal;
          fallbackTelegramCount += 1;
        }
      }
    });

    let botTotalRevenue = 0;
    botStatsMap.forEach(s => { botTotalRevenue += s.revenue; });
    botTotalRevenue += fallbackTelegramRevenue;
    const totalBotRev = botTotalRevenue || 1;

    const channels: ChannelItem[] = [];

    botStatsMap.forEach(stats => {
      channels.push({
        channel: stats.id,
        label: stats.label,
        revenue: Math.round(stats.revenue * 100) / 100,
        salesCount: stats.salesCount,
        percentage: Math.round((stats.revenue / totalBotRev) * 100),
        photoUrl: stats.photoUrl,
        username: stats.username
      });
    });

    if (fallbackTelegramCount > 0 || (storeBots.length === 0 && (currSales === 0 || fallbackTelegramCount > 0))) {
      channels.push({
        channel: "telegram_other",
        label: "Bot Telegram",
        revenue: Math.round(fallbackTelegramRevenue * 100) / 100,
        salesCount: fallbackTelegramCount,
        percentage: Math.round((fallbackTelegramRevenue / totalBotRev) * 100)
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
      .slice(0, 5);

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
      const h = d.getHours();
      hourlyMap[h].salesCount += 1;
      hourlyMap[h].revenue += Number(o.total || 0);
    });

    // 6. Activity & Health Indicators
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const salesToday = paidOrders.filter(o => new Date(o.paidAt || o.createdAt) >= startOfToday).length;

    const activeAccesses = allStoreAccesses.filter(a => a.status === 'ACTIVE').length;
    const pendingDeliveries = allStoreAccesses.filter(a => a.deliveryStatus === 'PENDING' || a.deliveryStatus === 'FAILED').length;
    const pendingPayments = pendingOrders.length;

    const activity: ActivityStats = {
      salesToday,
      newCustomersPeriod: currCustCount,
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
      catalog,
      hasSales: paidOrders.length > 0
    };
  }
}
