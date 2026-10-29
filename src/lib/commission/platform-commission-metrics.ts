import { db } from "@/db";
import { orders, stores, users } from "@/db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";

export interface CommissionSellerBreakdownItem {
  sellerId: string;
  sellerName: string;
  sellerEmail: string | null;
  storeName: string;
  salesCount: number;
  totalGmv: number;
  formattedTotalGmv: string;
  totalFees: number;
  formattedTotalFees: string;
}

export interface CommissionSplitOrderDetail {
  id: string;
  createdAt: string;
  formattedDate: string;
  total: number;
  formattedTotal: string;
  platformFee: number;
  formattedPlatformFee: string;
  splitStatus: string;
  paymentMethod: string;
  status: string;
}

export class PlatformCommissionMetricsService {
  /**
   * Resolve o intervalo de datas
   */
  static resolveDateRange(period?: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);

    if (period === "7d") {
      const s = new Date(now.getTime() - 7 * 86400000);
      s.setHours(0, 0, 0, 0);
      return { start: s, end };
    }
    if (period === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: s, end };
    }
    if (period === "year") {
      const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start: s, end };
    }

    // Default 30d
    const s = new Date(now.getTime() - 30 * 86400000);
    s.setHours(0, 0, 0, 0);
    return { start: s, end };
  }

  /**
   * Retorna os dados consolidados de comissão por vendedor, série temporal e KPIs
   */
  static async getCommissionDashboard(params: {
    sellerId?: string | null;
    period?: "7d" | "30d" | "month" | "year";
    page?: number;
    pageSize?: number;
  }) {
    const period = params.period || "30d";
    const { start, end } = this.resolveDateRange(period);
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(5, Math.min(50, params.pageSize || 10));

    let filterStoreIds: string[] | null = null;
    if (params.sellerId && params.sellerId !== "all") {
      const sellerStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.ownerId, params.sellerId));
      filterStoreIds = sellerStores.map((s) => s.id);
      if (filterStoreIds.length === 0) {
        filterStoreIds = ["00000000-0000-0000-0000-000000000000"];
      }
    }

    const whereConditions = and(
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
      filterStoreIds ? inArray(orders.storeId, filterStoreIds) : undefined
    );

    // 1. KPIs
    let totalRetainedFees = 0;
    let totalSettledOrders = 0;
    let totalGmv = 0;
    let distinctSellersCount = 0;

    try {
      const agg = await db
        .select({
          retained: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
          settled: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
          gmv: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
          distinctSellers: sql<number>`count(distinct case when ${orders.status} = 'paid' then ${orders.storeId} end)`,
        })
        .from(orders)
        .where(whereConditions);

      if (agg.length > 0) {
        totalRetainedFees = parseFloat(String(agg[0].retained || "0"));
        totalSettledOrders = Number(agg[0].settled || 0);
        totalGmv = parseFloat(String(agg[0].gmv || "0"));
        distinctSellersCount = Number(agg[0].distinctSellers || 0);
      }
    } catch (err) {
      console.warn("[PlatformCommissionMetrics] Erro ao calcular KPIs:", err);
    }

    const avgFeePerSeller = distinctSellersCount > 0 ? totalRetainedFees / distinctSellersCount : 0;

    // 2. Série temporal
    const timeSeries: { date: string; label: string; fees: number; ordersCount: number }[] = [];
    try {
      const tsRows = await db
        .select({
          day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
          feeAmount: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
          ordersCount: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
        })
        .from(orders)
        .where(whereConditions)
        .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

      for (const r of tsRows) {
        const d = String(r.day);
        const parts = d.split("-");
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
        timeSeries.push({
          date: d,
          label,
          fees: parseFloat(String(r.feeAmount || "0")),
          ordersCount: Number(r.ordersCount || 0),
        });
      }
    } catch (err) {
      console.warn("[PlatformCommissionMetrics] Erro na série temporal:", err);
    }

    // 3. Breakdown por vendedor paginado
    let sellersBreakdown: CommissionSellerBreakdownItem[] = [];
    let totalSellersCount = 0;

    try {
      const breakdownRows = await db
        .select({
          sellerId: users.id,
          sellerName: users.name,
          sellerEmail: users.email,
          storeName: stores.name,
          salesCount: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
          totalGmv: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
          totalFees: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
        })
        .from(users)
        .innerJoin(stores, eq(stores.ownerId, users.id))
        .leftJoin(
          orders,
          and(
            eq(orders.storeId, stores.id),
            gte(orders.createdAt, start),
            lte(orders.createdAt, end)
          )
        )
        .where(params.sellerId && params.sellerId !== "all" ? eq(users.id, params.sellerId) : undefined)
        .groupBy(users.id, users.name, users.email, stores.name)
        .orderBy(desc(sql`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`));

      totalSellersCount = breakdownRows.length;
      const offset = (page - 1) * pageSize;
      const paginated = breakdownRows.slice(offset, offset + pageSize);

      sellersBreakdown = paginated.map((r) => {
        const fees = parseFloat(String(r.totalFees || "0"));
        const gmv = parseFloat(String(r.totalGmv || "0"));
        return {
          sellerId: r.sellerId,
          sellerName: r.sellerName || "Vendedor sem nome",
          sellerEmail: r.sellerEmail,
          storeName: r.storeName || "Loja",
          salesCount: Number(r.salesCount || 0),
          totalGmv: gmv,
          formattedTotalGmv: this.formatCurrency(gmv),
          totalFees: fees,
          formattedTotalFees: this.formatCurrency(fees),
        };
      });
    } catch (err) {
      console.warn("[PlatformCommissionMetrics] Erro no breakdown de vendedores:", err);
    }

    return {
      kpis: {
        totalRetainedFees,
        formattedTotalRetainedFees: this.formatCurrency(totalRetainedFees),
        totalSettledOrders,
        totalGmv,
        formattedTotalGmv: this.formatCurrency(totalGmv),
        distinctSellersCount,
        avgFeePerSeller,
        formattedAvgFeePerSeller: this.formatCurrency(avgFeePerSeller),
      },
      timeSeries,
      sellers: {
        items: sellersBreakdown,
        total: totalSellersCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalSellersCount / pageSize) || 1,
      },
    };
  }

  /**
   * Drill-down: busca as ordens vinculadas à retenção de um vendedor específico
   */
  static async getSellerSplitOrders(sellerId: string, page = 1, pageSize = 10): Promise<{
    items: CommissionSplitOrderDetail[];
    total: number;
    totalPages: number;
    page: number;
  }> {
    try {
      const sellerStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.ownerId, sellerId));
      const storeIds = sellerStores.map((s) => s.id);

      if (storeIds.length === 0) {
        return { items: [], total: 0, totalPages: 1, page: 1 };
      }

      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(inArray(orders.storeId, storeIds), eq(orders.status, "paid")));

      const total = Number(countRes[0]?.count || 0);
      const offset = (page - 1) * pageSize;

      const rows = await db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          total: orders.total,
          platformFee: orders.platformFee,
          splitAmountCents: orders.splitAmountCents,
          splitStatus: orders.splitStatus,
          paymentMethod: orders.paymentMethod,
          status: orders.status,
        })
        .from(orders)
        .where(and(inArray(orders.storeId, storeIds), eq(orders.status, "paid")))
        .orderBy(desc(orders.createdAt))
        .limit(pageSize)
        .offset(offset);

      const items: CommissionSplitOrderDetail[] = rows.map((r) => {
        const ordTotal = parseFloat(String(r.total || "0"));
        const rawFee = r.platformFee ? parseFloat(String(r.platformFee)) : (r.splitAmountCents ? r.splitAmountCents / 100 : 0);
        return {
          id: r.id,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          formattedDate: r.createdAt
            ? new Date(r.createdAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-",
          total: ordTotal,
          formattedTotal: this.formatCurrency(ordTotal),
          platformFee: rawFee,
          formattedPlatformFee: this.formatCurrency(rawFee),
          splitStatus: r.splitStatus || "CONFIRMED",
          paymentMethod: r.paymentMethod || "pushinpay",
          status: r.status,
        };
      });

      return {
        items,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        page,
      };
    } catch (err) {
      console.error("[PlatformCommissionMetrics] Erro no drilldown de ordens:", err);
      return { items: [], total: 0, totalPages: 1, page: 1 };
    }
  }

  private static formatCurrency(val: number): string {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
}

