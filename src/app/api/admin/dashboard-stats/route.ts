import { NextResponse } from "next/server";
import { db } from "@/db";
import { 
  stores, 
  users, 
  telegramBots, 
  products, 
  orders, 
  orderItems, 
  telegramCustomers, 
  subscriptions 
} from "@/db/schema";
import { eq, sql, gte, lte, and, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";

    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      previousEndDate = new Date(startDate.getTime() - 1);
    } else if (period === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEndDate = new Date(startDate.getTime() - 1);
    } else if (period === "12m") {
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      previousStartDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      previousEndDate = new Date(startDate.getTime() - 1);
    } else {
      // Default: 30d
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      previousEndDate = new Date(startDate.getTime() - 1);
    }

    // 1. Parallel Aggregations for KPI Metrics
    const [
      totalStoresRes,
      currentStoresRes,
      prevStoresRes,

      totalSellersRes,
      currentSellersRes,
      prevSellersRes,

      totalBotsRes,
      currentBotsRes,
      prevBotsRes,

      totalProductsRes,
      currentProductsRes,
      prevProductsRes,

      totalOrdersPaidRes,
      currentOrdersPaidRes,
      prevOrdersPaidRes,

      totalRevenueRes,
      currentRevenueRes,
      prevRevenueRes,

      totalCustomersRes,
      currentCustomersRes,
      prevCustomersRes,

      totalSubsActiveRes,
      currentSubsActiveRes,
      prevSubsActiveRes
    ] = await Promise.all([
      // Stores
      db.select({ count: sql<number>`count(*)` }).from(stores),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(gte(stores.createdAt, startDate)),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(and(gte(stores.createdAt, previousStartDate), lte(stores.createdAt, previousEndDate))),

      // Sellers
      db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'seller')),
      db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'seller'), gte(users.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'seller'), gte(users.createdAt, previousStartDate), lte(users.createdAt, previousEndDate))),

      // Bots
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(eq(telegramBots.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(and(eq(telegramBots.status, 'active'), gte(telegramBots.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(telegramBots).where(and(eq(telegramBots.status, 'active'), gte(telegramBots.createdAt, previousStartDate), lte(telegramBots.createdAt, previousEndDate))),

      // Products
      db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.status, 'active'), gte(products.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.status, 'active'), gte(products.createdAt, previousStartDate), lte(products.createdAt, previousEndDate))),

      // Paid Orders
      db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'paid')),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.status, 'paid'), gte(orders.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.status, 'paid'), gte(orders.createdAt, previousStartDate), lte(orders.createdAt, previousEndDate))),

      // Revenue
      db.select({ sum: sql<number>`coalesce(sum(CAST(total AS NUMERIC)), 0)` }).from(orders).where(eq(orders.status, 'paid')),
      db.select({ sum: sql<number>`coalesce(sum(CAST(total AS NUMERIC)), 0)` }).from(orders).where(and(eq(orders.status, 'paid'), gte(orders.createdAt, startDate))),
      db.select({ sum: sql<number>`coalesce(sum(CAST(total AS NUMERIC)), 0)` }).from(orders).where(and(eq(orders.status, 'paid'), gte(orders.createdAt, previousStartDate), lte(orders.createdAt, previousEndDate))),

      // Customers
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers),
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers).where(gte(telegramCustomers.createdAt, startDate)),
      db.select({ count: sql<number>`count(*)` }).from(telegramCustomers).where(and(gte(telegramCustomers.createdAt, previousStartDate), lte(telegramCustomers.createdAt, previousEndDate))),

      // Active Subscriptions
      db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, 'ACTIVE')),
      db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(and(eq(subscriptions.status, 'ACTIVE'), gte(subscriptions.createdAt, startDate))),
      db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(and(eq(subscriptions.status, 'ACTIVE'), gte(subscriptions.createdAt, previousStartDate), lte(subscriptions.createdAt, previousEndDate)))
    ]);

    const calculatePercentage = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const metrics = {
      activeStores: {
        total: Number(totalStoresRes[0].count),
        current: Number(currentStoresRes[0].count),
        changePercent: calculatePercentage(Number(currentStoresRes[0].count), Number(prevStoresRes[0].count))
      },
      sellers: {
        total: Number(totalSellersRes[0].count),
        current: Number(currentSellersRes[0].count),
        changePercent: calculatePercentage(Number(currentSellersRes[0].count), Number(prevSellersRes[0].count))
      },
      connectedBots: {
        total: Number(totalBotsRes[0].count),
        current: Number(currentBotsRes[0].count),
        changePercent: calculatePercentage(Number(currentBotsRes[0].count), Number(prevBotsRes[0].count))
      },
      products: {
        total: Number(totalProductsRes[0].count),
        current: Number(currentProductsRes[0].count),
        changePercent: calculatePercentage(Number(currentProductsRes[0].count), Number(prevProductsRes[0].count))
      },
      paidOrders: {
        total: Number(totalOrdersPaidRes[0].count),
        current: Number(currentOrdersPaidRes[0].count),
        changePercent: calculatePercentage(Number(currentOrdersPaidRes[0].count), Number(prevOrdersPaidRes[0].count))
      },
      revenue: {
        total: Number(totalRevenueRes[0].sum),
        current: Number(currentRevenueRes[0].sum),
        changePercent: calculatePercentage(Number(currentRevenueRes[0].sum), Number(prevRevenueRes[0].sum))
      },
      telegramCustomers: {
        total: Number(totalCustomersRes[0].count),
        current: Number(currentCustomersRes[0].count),
        changePercent: calculatePercentage(Number(currentCustomersRes[0].count), Number(prevCustomersRes[0].count))
      },
      activeSubscriptions: {
        total: Number(totalSubsActiveRes[0].count),
        current: Number(currentSubsActiveRes[0].count),
        changePercent: calculatePercentage(Number(currentSubsActiveRes[0].count), Number(prevSubsActiveRes[0].count))
      }
    };

    // 2. Fetch Orders in period for time series & status distribution
    const periodOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt
      })
      .from(orders)
      .where(gte(orders.createdAt, startDate))
      .orderBy(desc(orders.createdAt));

    // Time series grouping (by day or hour)
    const timeMap = new Map<string, { revenue: number; ordersCount: number }>();
    const growthMap = new Map<string, { sellers: number; stores: number }>();

    // Pre-populate date keys for smooth chart lines
    const daysCount = period === "today" ? 1 : period === "7d" ? 7 : period === "12m" ? 12 : 30;
    for (let i = daysCount - 1; i >= 0; i--) {
      let dateKey: string;
      if (period === "12m") {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        dateKey = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      } else if (period === "today") {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        dateKey = `${String(d.getHours()).padStart(2, '0')}:00`;
      } else {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        dateKey = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      }
      timeMap.set(dateKey, { revenue: 0, ordersCount: 0 });
      growthMap.set(dateKey, { sellers: 0, stores: 0 });
    }

    periodOrders.forEach((ord) => {
      let key: string;
      if (period === "12m") {
        key = new Date(ord.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      } else if (period === "today") {
        key = `${String(new Date(ord.createdAt).getHours()).padStart(2, '0')}:00`;
      } else {
        key = new Date(ord.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      }

      if (timeMap.has(key)) {
        const existing = timeMap.get(key)!;
        if (ord.status === "paid") {
          existing.revenue += Number(ord.total);
          existing.ordersCount += 1;
        }
      }
    });

    const revenueTimeSeries = Array.from(timeMap.entries()).map(([date, val]) => ({
      date,
      revenue: Number(val.revenue.toFixed(2))
    }));

    const ordersTimeSeries = Array.from(timeMap.entries()).map(([date, val]) => ({
      date,
      count: val.ordersCount
    }));

    // Growth TimeSeries (Sellers & Stores)
    const [periodSellers, periodStores] = await Promise.all([
      db.select({ createdAt: users.createdAt }).from(users).where(and(eq(users.role, 'seller'), gte(users.createdAt, startDate))),
      db.select({ createdAt: stores.createdAt }).from(stores).where(gte(stores.createdAt, startDate))
    ]);

    periodSellers.forEach((s) => {
      let key: string;
      if (period === "12m") {
        key = new Date(s.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      } else if (period === "today") {
        key = `${String(new Date(s.createdAt).getHours()).padStart(2, '0')}:00`;
      } else {
        key = new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      }
      if (growthMap.has(key)) {
        growthMap.get(key)!.sellers += 1;
      }
    });

    periodStores.forEach((st) => {
      let key: string;
      if (period === "12m") {
        key = new Date(st.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      } else if (period === "today") {
        key = `${String(new Date(st.createdAt).getHours()).padStart(2, '0')}:00`;
      } else {
        key = new Date(st.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      }
      if (growthMap.has(key)) {
        growthMap.get(key)!.stores += 1;
      }
    });

    const growthTimeSeries = Array.from(growthMap.entries()).map(([date, val]) => ({
      date,
      sellers: val.sellers,
      stores: val.stores
    }));

    // Order Status Distribution (All time or Period)
    const allOrdersStatus = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .groupBy(orders.status);

    const totalOrdersAll = allOrdersStatus.reduce((acc, curr) => acc + Number(curr.count), 0);
    const statusColorMap: Record<string, string> = {
      paid: "#10B981",       // Verde
      pending: "#F59E0B",    // Amarelo/Laranja
      cancelled: "#EF4444",  // Vermelho
      failed: "#6B7280"      // Cinza
    };

    const statusNameMap: Record<string, string> = {
      paid: "Pagos",
      pending: "Pendentes",
      cancelled: "Cancelados",
      failed: "Falhos"
    };

    const orderStatusDistribution = allOrdersStatus.map((item) => {
      const count = Number(item.count);
      return {
        status: item.status,
        name: statusNameMap[item.status] || item.status,
        count,
        percentage: totalOrdersAll > 0 ? Number(((count / totalOrdersAll) * 100).toFixed(1)) : 0,
        color: statusColorMap[item.status] || "#8B5CF6"
      };
    });

    // 3. Top Selling Products
    const topProductsRes = await db
      .select({
        productId: products.id,
        name: products.title,
        quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(CAST(${orderItems.total} AS NUMERIC)), 0)`
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.status, 'paid'))
      .groupBy(products.id, products.title)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(5);

    const topProducts = topProductsRes.map((p) => ({
      id: p.productId,
      name: p.name,
      quantity: Number(p.quantity),
      revenue: Number(Number(p.revenue).toFixed(2))
    }));

    // 4. Recent Sales (Last 10)
    const recentSalesRes = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
        customerFirstName: telegramCustomers.firstName,
        customerUsername: telegramCustomers.username,
        storeName: stores.name,
        sellerName: users.name
      })
      .from(orders)
      .innerJoin(telegramCustomers, eq(orders.customerId, telegramCustomers.id))
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .innerJoin(users, eq(stores.ownerId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const recentSales = recentSalesRes.map((sale) => ({
      id: sale.id,
      customer: sale.customerFirstName || `@${sale.customerUsername}` || "Cliente Telegram",
      product: "Pedido Store",
      seller: sale.sellerName,
      store: sale.storeName,
      amount: Number(sale.total),
      status: sale.status,
      date: new Date(sale.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    }));

    // 5. Recent Stores
    const recentStoresRes = await db
      .select({
        id: stores.id,
        name: stores.name,
        status: stores.status,
        logoUrl: stores.logoUrl,
        createdAt: stores.createdAt,
        ownerName: users.name
      })
      .from(stores)
      .innerJoin(users, eq(stores.ownerId, users.id))
      .orderBy(desc(stores.createdAt))
      .limit(6);

    const recentStores = await Promise.all(
      recentStoresRes.map(async (st) => {
        const [botRes, prodRes] = await Promise.all([
          db.select({ username: telegramBots.username }).from(telegramBots).where(eq(telegramBots.storeId, st.id)).limit(1),
          db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.storeId, st.id))
        ]);

        return {
          id: st.id,
          name: st.name,
          owner: st.ownerName,
          logoUrl: st.logoUrl,
          botName: botRes[0] ? `@${botRes[0].username}` : null,
          productCount: Number(prodRes[0].count),
          status: st.status,
          createdAt: new Date(st.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        };
      })
    );

    // 6. Recent Activity Timeline
    const [newUsers, newStoresList, newOrdersList] = await Promise.all([
      db.select({ name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.role, 'seller')).orderBy(desc(users.createdAt)).limit(4),
      db.select({ name: stores.name, createdAt: stores.createdAt }).from(stores).orderBy(desc(stores.createdAt)).limit(4),
      db.select({ total: orders.total, createdAt: orders.createdAt }).from(orders).where(eq(orders.status, 'paid')).orderBy(desc(orders.createdAt)).limit(4)
    ]);

    const activityTimeline = [
      ...newUsers.map((u) => ({
        id: `usr-${u.createdAt.getTime()}`,
        title: "Novo Vendedor",
        description: `${u.name} se cadastrou na plataforma`,
        type: "seller",
        timestamp: u.createdAt
      })),
      ...newStoresList.map((st) => ({
        id: `st-${st.createdAt.getTime()}`,
        title: "Nova Loja Criada",
        description: `Loja ${st.name} foi publicada`,
        type: "store",
        timestamp: st.createdAt
      })),
      ...newOrdersList.map((ord) => ({
        id: `ord-${ord.createdAt.getTime()}`,
        title: "Pedido Pago",
        description: `Nova venda realizada no valor de R$ ${Number(ord.total).toFixed(2)}`,
        type: "sale",
        timestamp: ord.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8)
      .map((item) => {
        const diffMinutes = Math.floor((now.getTime() - new Date(item.timestamp).getTime()) / 60000);
        let timeAgo = `${diffMinutes} min atrás`;
        if (diffMinutes >= 60) {
          const hours = Math.floor(diffMinutes / 60);
          timeAgo = `${hours}h atrás`;
        }
        if (diffMinutes >= 1440) {
          const days = Math.floor(diffMinutes / 1440);
          timeAgo = `${days}d atrás`;
        }

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.type,
          timestamp: item.timestamp.toISOString(),
          timeAgo
        };
      });

    return NextResponse.json({
      period,
      updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      metrics,
      revenueTimeSeries,
      ordersTimeSeries,
      growthTimeSeries,
      orderStatusDistribution,
      topProducts,
      recentSales,
      recentStores,
      recentActivity: activityTimeline
    });
  } catch (error: any) {
    console.error("ADMIN DASHBOARD STATS ERROR:", error);
    return NextResponse.json({ error: "Erro ao carregar métricas administrativas." }, { status: 500 });
  }
}
