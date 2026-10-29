import { db } from "@/db";
import { orders, stores, users, products, telegramCustomers } from "@/db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";

export interface ReportFilterParams {
  sellerId?: string | null;
  period?: "7d" | "30d" | "month" | "year" | "custom";
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ReportKPIs {
  uniqueCustomers: number;
  activeProducts: number;
  approvedSalesCount: number;
  totalOrdersCount: number;
  gmv: number;
  formattedGmv: string;
  avgTicket: number;
  formattedAvgTicket: string;
  conversionRate: number;
  formattedConversionRate: string;
  totalPlatformFees: number;
  formattedTotalPlatformFees: string;
}

export interface GatewayFeeBreakdown {
  gateway: string;
  gatewayLabel: string;
  salesCount: number;
  gmv: number;
  formattedGmv: string;
  feeAmount: number;
  formattedFeeAmount: string;
  percentageOfFees: number;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  salesCount: number;
  gmv: number;
  platformFee: number;
}

export interface ReportDetailedOrder {
  id: string;
  createdAt: string;
  formattedDate: string;
  customerName: string;
  customerUsername: string | null;
  storeName: string;
  sellerName: string;
  total: number;
  formattedTotal: string;
  platformFee: number;
  formattedPlatformFee: string;
  paymentMethod: string;
  status: string;
}

export interface ReportSellerOption {
  id: string;
  name: string;
  email: string | null;
  storeName: string | null;
}

export interface AdminReportResponse {
  filters: {
    sellerId: string;
    period: string;
    startDate: string;
    endDate: string;
    page: number;
    pageSize: number;
  };
  kpis: ReportKPIs;
  gatewayBreakdown: GatewayFeeBreakdown[];
  timeSeries: TimeSeriesPoint[];
  orders: {
    items: ReportDetailedOrder[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  availableSellers: ReportSellerOption[];
}

export class AdminReportsService {
  /**
   * Resolve o intervalo de datas de acordo com o período selecionado
   */
  static resolveDateRange(period?: string, startDate?: string | null, endDate?: string | null): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);

    if (period === "custom" && startDate) {
      const s = new Date(startDate);
      const e = endDate ? new Date(endDate) : new Date(now);
      e.setHours(23, 59, 59, 999);
      return { start: isNaN(s.getTime()) ? new Date(now.getTime() - 30 * 86400000) : s, end: isNaN(e.getTime()) ? now : e };
    }

    if (period === "7d") {
      const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

    // Default: 30d
    const s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    s.setHours(0, 0, 0, 0);
    return { start: s, end };
  }

  /**
   * Busca vendedores cadastrados para alimentar o filtro
   */
  static async getAvailableSellers(): Promise<ReportSellerOption[]> {
    try {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          storeName: stores.name,
        })
        .from(users)
        .leftJoin(stores, eq(stores.ownerId, users.id))
        .where(eq(users.role, "seller"))
        .orderBy(users.name);

      const uniqueMap = new Map<string, ReportSellerOption>();
      for (const r of rows) {
        if (!uniqueMap.has(r.id)) {
          uniqueMap.set(r.id, {
            id: r.id,
            name: r.name || "Vendedor sem nome",
            email: r.email,
            storeName: r.storeName || null,
          });
        }
      }

      return Array.from(uniqueMap.values());
    } catch (err) {
      console.error("[AdminReportsService] Erro ao buscar vendedores:", err);
      return [];
    }
  }

  /**
   * Gera o relatório consolidado com KPIs, breakdown de taxas, gráficos e tabela detalhada
   */
  static async getReportData(params: ReportFilterParams): Promise<AdminReportResponse> {
    const period = params.period || "30d";
    const { start, end } = this.resolveDateRange(period, params.startDate, params.endDate);
    const sellerId = params.sellerId && params.sellerId !== "all" ? params.sellerId : null;
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(5, Math.min(100, params.pageSize || 20));

    // 1. Resolver lojas vinculadas caso haja filtro de vendedor
    let filterStoreIds: string[] | null = null;
    if (sellerId) {
      const sellerStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.ownerId, sellerId));
      filterStoreIds = sellerStores.map((s) => s.id);
      if (filterStoreIds.length === 0) {
        // Vendedor não possui lojas; mock com ID fictício para query retornar zero
        filterStoreIds = ["00000000-0000-0000-0000-000000000000"];
      }
    }

    // 2. Montar condições WHERE para pedidos
    const orderDateConditions = and(
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
      filterStoreIds ? inArray(orders.storeId, filterStoreIds) : undefined
    );

    // 3. Consultar contagem de produtos ativos
    let activeProductsCount = 0;
    try {
      const productWhere = filterStoreIds
        ? and(eq(products.status, "active"), inArray(products.storeId, filterStoreIds))
        : eq(products.status, "active");

      const prodRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(productWhere);

      activeProductsCount = Number(prodRes[0]?.count || 0);
    } catch (err) {
      console.warn("[AdminReportsService] Erro ao contar produtos ativos:", err);
    }

    // 4. Agregações principais de vendas e taxas
    let totalOrdersCount = 0;
    let approvedSalesCount = 0;
    let gmv = 0;
    let totalPlatformFees = 0;
    let uniqueCustomers = 0;

    try {
      const aggRes = await db
        .select({
          totalOrders: sql<number>`count(*)`,
          approvedSales: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
          totalGmv: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
          totalFees: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
          uniqueCust: sql<number>`count(distinct case when ${orders.status} = 'paid' then ${orders.customerId} end)`,
        })
        .from(orders)
        .where(orderDateConditions);

      if (aggRes.length > 0) {
        totalOrdersCount = Number(aggRes[0].totalOrders || 0);
        approvedSalesCount = Number(aggRes[0].approvedSales || 0);
        gmv = parseFloat(String(aggRes[0].totalGmv || "0"));
        totalPlatformFees = parseFloat(String(aggRes[0].totalFees || "0"));
        uniqueCustomers = Number(aggRes[0].uniqueCust || 0);
      }
    } catch (err) {
      console.error("[AdminReportsService] Erro na agregação de pedidos:", err);
    }

    const avgTicket = approvedSalesCount > 0 ? gmv / approvedSalesCount : 0;
    const conversionRate = totalOrdersCount > 0 ? (approvedSalesCount / totalOrdersCount) * 100 : 0;

    // 5. Detalhamento de taxas e vendas por Gateway
    const gatewayBreakdown: GatewayFeeBreakdown[] = [];
    try {
      const gwRes = await db
        .select({
          gateway: sql<string>`lower(coalesce(${orders.paymentMethod}, 'pushinpay'))`,
          salesCount: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
          gmv: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
          feeAmount: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
        })
        .from(orders)
        .where(orderDateConditions)
        .groupBy(sql`lower(coalesce(${orders.paymentMethod}, 'pushinpay'))`);

      for (const row of gwRes) {
        const rawGw = (row.gateway || "").trim().toLowerCase();
        let gatewayLabel = "PushinPay";
        if (rawGw.includes("mercado") || rawGw === "mercadopago") {
          gatewayLabel = "Mercado Pago";
        } else if (rawGw.includes("syncpay")) {
          gatewayLabel = "SyncPay";
        } else if (rawGw === "pix") {
          gatewayLabel = "Pix / PushinPay";
        }

        const fee = parseFloat(String(row.feeAmount || "0"));
        const gwGmv = parseFloat(String(row.gmv || "0"));
        const count = Number(row.salesCount || 0);
        const percentage = totalPlatformFees > 0 ? (fee / totalPlatformFees) * 100 : 0;

        gatewayBreakdown.push({
          gateway: rawGw,
          gatewayLabel,
          salesCount: count,
          gmv: gwGmv,
          formattedGmv: this.formatCurrency(gwGmv),
          feeAmount: fee,
          formattedFeeAmount: this.formatCurrency(fee),
          percentageOfFees: Math.round(percentage * 10) / 10,
        });
      }
    } catch (err) {
      console.warn("[AdminReportsService] Erro ao calcular breakdown por gateway:", err);
    }

    // 6. Série temporal inteligente para gráfico
    const timeSeries: TimeSeriesPoint[] = [];
    try {
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const isMonthlyGrouping = diffDays > 65;

      const dateTruncSql = isMonthlyGrouping
        ? sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`
        : sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`;

      const tsRows = await db
        .select({
          timeBucket: dateTruncSql,
          salesCount: sql<number>`count(case when ${orders.status} = 'paid' then 1 end)`,
          gmv: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then cast(${orders.total} as numeric) else 0 end), 0)`,
          platformFee: sql<string>`coalesce(sum(case when ${orders.status} = 'paid' then coalesce(cast(${orders.platformFee} as numeric), cast(${orders.splitAmountCents} as numeric) / 100, 0) else 0 end), 0)`,
        })
        .from(orders)
        .where(orderDateConditions)
        .groupBy(dateTruncSql)
        .orderBy(dateTruncSql);

      for (const row of tsRows) {
        const dateStr = String(row.timeBucket);
        let label = dateStr;
        if (!isMonthlyGrouping && dateStr.length === 10) {
          const parts = dateStr.split("-");
          label = `${parts[2]}/${parts[1]}`;
        } else if (isMonthlyGrouping && dateStr.length === 7) {
          const parts = dateStr.split("-");
          label = `${parts[1]}/${parts[0]}`;
        }

        timeSeries.push({
          date: dateStr,
          label,
          salesCount: Number(row.salesCount || 0),
          gmv: parseFloat(String(row.gmv || "0")),
          platformFee: parseFloat(String(row.platformFee || "0")),
        });
      }
    } catch (err) {
      console.warn("[AdminReportsService] Erro ao gerar série temporal:", err);
    }

    // 7. Lista detalhada de pedidos paginada
    let detailedOrders: ReportDetailedOrder[] = [];
    let totalDetailedCount = 0;

    try {
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(orderDateConditions);

      totalDetailedCount = Number(countRes[0]?.count || 0);

      const offset = (page - 1) * pageSize;

      const orderRows = await db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          total: orders.total,
          platformFee: orders.platformFee,
          splitAmountCents: orders.splitAmountCents,
          paymentMethod: orders.paymentMethod,
          status: orders.status,
          customerFirstName: telegramCustomers.firstName,
          customerLastName: telegramCustomers.lastName,
          customerUsername: telegramCustomers.username,
          storeName: stores.name,
          sellerName: users.name,
          sellerEmail: users.email,
        })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .leftJoin(users, eq(stores.ownerId, users.id))
        .leftJoin(telegramCustomers, eq(orders.customerId, telegramCustomers.id))
        .where(orderDateConditions)
        .orderBy(desc(orders.createdAt))
        .limit(pageSize)
        .offset(offset);

      detailedOrders = orderRows.map((r) => {
        const orderTotal = parseFloat(String(r.total || "0"));
        const rawFee = r.platformFee ? parseFloat(String(r.platformFee)) : (r.splitAmountCents ? r.splitAmountCents / 100 : 0);
        const customerName = [r.customerFirstName, r.customerLastName].filter(Boolean).join(" ") || "Cliente";

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
          customerName,
          customerUsername: r.customerUsername || null,
          storeName: r.storeName || "Loja",
          sellerName: r.sellerName || r.sellerEmail || "Vendedor",
          total: orderTotal,
          formattedTotal: this.formatCurrency(orderTotal),
          platformFee: rawFee,
          formattedPlatformFee: this.formatCurrency(rawFee),
          paymentMethod: r.paymentMethod || "pushinpay",
          status: r.status,
        };
      });
    } catch (err) {
      console.error("[AdminReportsService] Erro ao buscar pedidos detalhados:", err);
    }

    const availableSellers = await this.getAvailableSellers();

    return {
      filters: {
        sellerId: sellerId || "all",
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        page,
        pageSize,
      },
      kpis: {
        uniqueCustomers,
        activeProducts: activeProductsCount,
        approvedSalesCount,
        totalOrdersCount,
        gmv,
        formattedGmv: this.formatCurrency(gmv),
        avgTicket,
        formattedAvgTicket: this.formatCurrency(avgTicket),
        conversionRate: Math.round(conversionRate * 10) / 10,
        formattedConversionRate: `${(Math.round(conversionRate * 10) / 10).toFixed(1)}%`,
        totalPlatformFees,
        formattedTotalPlatformFees: this.formatCurrency(totalPlatformFees),
      },
      gatewayBreakdown,
      timeSeries,
      orders: {
        items: detailedOrders,
        total: totalDetailedCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalDetailedCount / pageSize) || 1,
      },
      availableSellers,
    };
  }

  private static formatCurrency(val: number): string {
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
}

