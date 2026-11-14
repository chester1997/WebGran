import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommercialMetricsService } from "../commercial-metrics-service";
import { AnalyticsService } from "../analytics-service";
import { SellerMetricsOverview } from "@/components/analytics/SellerMetricsOverview";
import { db } from "@/db";

// Mock db for financial dashboard tests
vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findMany: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      telegramBots: {
        findMany: vi.fn(),
      },
      accesses: {
        findMany: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
      },
      categories: {
        findMany: vi.fn(),
      },
      telegramCustomers: {
        findMany: vi.fn(),
      },
      botStartEvents: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
}));

function normalizeBRL(str: string): string {
  return str.replace(/\u00a0/g, " ");
}

describe("Financial Dashboard Divergence Fix Suite (926 vendas / R$ 5.748,00)", () => {
  const storeId = "store-test-divergence-926";
  const botA = "bot-alpha-uuid";
  const botB = "bot-beta-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper que gera 1400 pedidos simulando o cenário real de produção:
   * - 926 pedidos 'paid', somando exatamente R$ 5.748,00
   * - 350 pedidos 'pending' (não pagos / aguardando Pix)
   * - 124 pedidos 'cancelled' / expirados
   * - Distribuídos entre 01/11/2026 e 14/11/2026
   */
  function generateProductionScenarioOrders() {
    const ordersList: Array<{
      id: string;
      storeId: string;
      status: string;
      total: string;
      subtotal: string;
      discount: string;
      platformFee: string;
      netAmount: string;
      paidAt: Date | null;
      createdAt: Date;
      paymentMethod: string;
      paymentId: string;
      pixQrCode: string;
      pixExpiresAt: Date | null;
      originBotId: string;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        unitPrice: string;
        total: string;
        product: { id: string; title: string; botId: string; coverUrl: string | null };
      }>;
    }> = [];

    // Gerar 926 pedidos pagos somando exatamente R$ 5.748,00:
    // 925 pedidos de R$ 6,20 = R$ 5.735,00
    // 1 pedido de R$ 13,00 = R$ 5.748,00
    for (let i = 1; i <= 926; i++) {
      const orderAmount = i === 926 ? "13.00" : "6.20";
      const dayOffset = (i % 14) + 1; // Dias 1 a 14 de novembro de 2026
      const orderDate = new Date(`2026-11-${String(dayOffset).padStart(2, "0")}T14:30:00.000Z`);
      const assignedBot = i % 2 === 0 ? botA : botB;

      ordersList.push({
        id: `order-paid-${i}`,
        storeId,
        status: "paid",
        total: orderAmount,
        subtotal: orderAmount,
        discount: "0.00",
        platformFee: "0.50",
        netAmount: (Number(orderAmount) - 0.50).toFixed(2),
        paidAt: orderDate,
        createdAt: orderDate,
        paymentMethod: "PIX",
        paymentId: `pay-pix-${i}`,
        pixQrCode: `pix-code-${i}`,
        pixExpiresAt: null,
        originBotId: assignedBot,
        items: [
          {
            id: `item-${i}`,
            productId: `prod-${i % 5}`,
            quantity: 1,
            unitPrice: orderAmount,
            total: orderAmount,
            product: {
              id: `prod-${i % 5}`,
              title: `Produto Digital ${(i % 5) + 1}`,
              botId: assignedBot,
              coverUrl: null,
            },
          },
        ],
      });
    }

    // 350 pedidos pendentes
    for (let j = 1; j <= 350; j++) {
      const dayOffset = (j % 14) + 1;
      const orderDate = new Date(`2026-11-${String(dayOffset).padStart(2, "0")}T10:00:00.000Z`);
      ordersList.push({
        id: `order-pending-${j}`,
        storeId,
        status: "pending",
        total: "15.00",
        subtotal: "15.00",
        discount: "0.00",
        platformFee: "0.50",
        netAmount: "14.50",
        paidAt: null,
        createdAt: orderDate,
        paymentMethod: "PIX",
        paymentId: `pay-pend-${j}`,
        pixQrCode: `pix-code-pend-${j}`,
        pixExpiresAt: new Date(orderDate.getTime() + 30 * 60 * 1000),
        originBotId: botA,
        items: [
          {
            id: `item-pend-${j}`,
            productId: `prod-1`,
            quantity: 1,
            unitPrice: "15.00",
            total: "15.00",
            product: {
              id: `prod-1`,
              title: "Produto Pendente",
              botId: botA,
              coverUrl: null,
            },
          },
        ],
      });
    }

    // 124 pedidos cancelados/expirados
    for (let k = 1; k <= 124; k++) {
      const orderDate = new Date(`2026-11-05T08:00:00.000Z`);
      ordersList.push({
        id: `order-cancelled-${k}`,
        storeId,
        status: "cancelled",
        total: "20.00",
        subtotal: "20.00",
        discount: "0.00",
        platformFee: "0.50",
        netAmount: "19.50",
        paidAt: null,
        createdAt: orderDate,
        paymentMethod: "PIX",
        paymentId: `pay-canc-${k}`,
        pixQrCode: `pix-code-canc-${k}`,
        pixExpiresAt: orderDate,
        originBotId: botB,
        items: [
          {
            id: `item-canc-${k}`,
            productId: `prod-2`,
            quantity: 1,
            unitPrice: "20.00",
            total: "20.00",
            product: {
              id: `prod-2`,
              title: "Produto Cancelado",
              botId: botB,
              coverUrl: null,
            },
          },
        ],
      });
    }

    return ordersList;
  }

  describe("1. Cálculo correto com mais de 500 pedidos no período", () => {
    it("processa 1.400 pedidos e extrai exatamente 926 vendas pagas somando R$ 5.748,00", () => {
      const allOrders = generateProductionScenarioOrders();
      expect(allOrders.length).toBe(1400);

      const calculated = CommercialMetricsService.calculateMetrics(allOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
      });

      const metrics = {
        period: "CUSTOM:2026-11-01:2026-11-14",
        storeId,
        ...calculated,
      };

      // Total de vendas aprovadas
      expect(metrics.approvedSales.count).toBe(926);
      expect(metrics.approvedSales.total).toBe(5748.00);
      expect(normalizeBRL(metrics.approvedSales.formatted)).toBe("R$ 5.748,00");

      // Ticket Médio: 5.748 / 926 = 6.2073... -> R$ 6,21
      expect(metrics.averageTicket.averageTicket).toBe(6.21);
      expect(metrics.averageTicket.consideredSalesCount).toBe(926);
      expect(normalizeBRL(metrics.averageTicket.formatted)).toBe("R$ 6,21");
    });
  });

  describe("2. Pedidos pendentes e cancelados não contabilizados", () => {
    it("não contabiliza os 350 pedidos pendentes e 124 cancelados na receita", () => {
      const allOrders = generateProductionScenarioOrders();
      const calculated = CommercialMetricsService.calculateMetrics(allOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
      });

      const metrics = {
        period: "CUSTOM:2026-11-01:2026-11-14",
        storeId,
        ...calculated,
      };

      // Se pendentes e cancelados fossem somados, a receita seria 5748 + (350*15) + (124*20) = R$ 13.478,00
      expect(metrics.approvedSales.total).toBe(5748.00);
      expect(metrics.approvedSales.count).toBe(926);
      // Conversão Pix: 926 pagos de 1400 Pix gerados no total
      expect(metrics.conversionRate.totalPixPagos).toBe(926);
      expect(metrics.conversionRate.totalPixGerados).toBe(1400);
    });
  });

  describe("3. Consistência Visual entre Card 1, Card 2 e Gráfico em SellerMetricsOverview", () => {
    it("garante que Card 1, Card 2 e Gráfico exibam exatamente os mesmos R$ 5.748,00 e R$ 6,21 para as 926 vendas", () => {
      const allOrders = generateProductionScenarioOrders();
      const calculated = CommercialMetricsService.calculateMetrics(allOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
      });

      const metrics = {
        period: "CUSTOM:2026-11-01:2026-11-14",
        storeId,
        ...calculated,
      };

      // Simula kpis que anteriormente vinham truncados (R$ 2.694,00)
      const mockTruncatedKpis = {
        revenue: { value: 2694.00, formatted: "R$ 2.694,00", changePercent: 0, trend: "neutral" as const, subtitle: "" },
        salesCount: { value: 434, formatted: "434", changePercent: 0, trend: "neutral" as const, subtitle: "" },
        customersCount: { value: 400, formatted: "400", changePercent: 0, trend: "neutral" as const, subtitle: "" },
        averageTicket: { value: 6.21, formatted: "R$ 6,21", changePercent: 0, trend: "neutral" as const, subtitle: "" },
      };

      const html = renderToStaticMarkup(
        <SellerMetricsOverview
          metrics={metrics}
          kpis={mockTruncatedKpis}
          periodLabel="01/11/2026 — 14/11/2026"
        />
      ).replace(/\u00a0/g, " ");

      // 1. Card 1 (Vendas aprovadas): DEVE exibir R$ 5.748,00 e 926 vendas (NÃO R$ 2.694,00)
      expect(html).toContain("Vendas aprovadas");
      expect(html).toContain("R$ 5.748,00");
      expect(html).toContain("926 vendas");
      expect(html).not.toContain("R$ 2.694,00");

      // 2. Card 2 (Valor médio por venda): DEVE exibir R$ 6,21 e Média de 926 vendas
      expect(html).toContain("Valor médio por venda");
      expect(html).toContain("R$ 6,21");
      expect(html).toContain("Média de 926 vendas");

      // 3. Gráfico de vendas: DEVE exibir R$ 5.748,00 e 926 vendas confirmadas
      expect(html).toContain("R$ 5.748,00");
      expect(html).toContain("926 vendas confirmadas");
    });
  });

  describe("4. Filtro por Bot Específico vs Todos os Bots", () => {
    it("filtra corretamente por bot quando especificado e agrega todos quando omitido", () => {
      const allOrders = generateProductionScenarioOrders();

      // Filtro Bot A (pedidos pares: 926 / 2 = 463 vendas pagas)
      const metricsBotA = CommercialMetricsService.calculateMetrics(allOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
        botId: botA,
      });

      expect(metricsBotA.approvedSales.count).toBe(463);

      // Filtro Todos os Bots (null / omitido): soma todas as 926 vendas
      const metricsAll = CommercialMetricsService.calculateMetrics(allOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
        botId: null,
      });

      expect(metricsAll.approvedSales.count).toBe(926);
      expect(metricsAll.approvedSales.total).toBe(5748.00);
    });
  });

  describe("5. Filtro de Datas e Período ALL", () => {
    it("exclui pedidos fora do intervalo e inclui todos no período ALL", () => {
      const baseOrders = [
        {
          id: "ord-out-before",
          storeId,
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-31T22:00:00.000Z"),
          createdAt: new Date("2026-10-31T22:00:00.000Z"),
        },
        {
          id: "ord-in-1",
          storeId,
          status: "paid",
          total: "200.00",
          paidAt: new Date("2026-11-05T12:00:00.000Z"),
          createdAt: new Date("2026-11-05T12:00:00.000Z"),
        },
        {
          id: "ord-out-after",
          storeId,
          status: "paid",
          total: "300.00",
          paidAt: new Date("2026-11-15T08:00:00.000Z"),
          createdAt: new Date("2026-11-15T08:00:00.000Z"),
        },
      ];

      // Período 01/11 a 14/11: apenas ord-in-1
      const metricsCustom = CommercialMetricsService.calculateMetrics(baseOrders as any, {
        period: "CUSTOM:2026-11-01:2026-11-14",
        referenceDate: new Date("2026-11-14T23:59:59.000Z"),
      });
      expect(metricsCustom.approvedSales.count).toBe(1);
      expect(metricsCustom.approvedSales.total).toBe(200.00);

      // Período ALL com referenceDate após todos os pedidos: inclui todos os 3 pedidos
      const metricsAll = CommercialMetricsService.calculateMetrics(baseOrders as any, {
        period: "ALL",
        referenceDate: new Date("2026-11-16T23:59:59.000Z"),
      });
      expect(metricsAll.approvedSales.count).toBe(3);
      expect(metricsAll.approvedSales.total).toBe(600.00);
    });
  });

  describe("6. Consulta de Pedidos Recentes limitada a 10 sem afetar agregações", () => {
    it("mantém a listagem de pedidos recentes limitada a 10 registros enquanto a agregação totaliza 926", async () => {
      const allOrders = generateProductionScenarioOrders();

      // Mock stores.findFirst
      (db.query.stores.findFirst as any).mockResolvedValue({
        id: storeId,
        name: "Minha Loja 926",
        ownerId: "owner-1",
        owner: { name: "Proprietário" },
      });

      // Mock telegramBots
      (db.query.telegramBots.findMany as any).mockResolvedValue([
        { id: botA, username: "bot_alpha", displayName: "Bot Alpha", photoUrl: null },
        { id: botB, username: "bot_beta", displayName: "Bot Beta", photoUrl: null },
      ]);

      // Mock accesses, products, categories, customers, botStarts
      (db.query.accesses.findMany as any).mockResolvedValue([]);
      (db.query.products.findMany as any).mockResolvedValue([]);
      (db.query.categories.findMany as any).mockResolvedValue([]);
      (db.query.telegramCustomers.findMany as any).mockResolvedValue([]);
      (db.query.botStartEvents.findMany as any).mockResolvedValue([]);

      // Mock orders.findMany:
      // Retorna recentOrders se limit for 10, senão retorna allOrders
      (db.query.orders.findMany as any).mockImplementation((args: any) => {
        if (args?.limit === 10) {
          return Promise.resolve(allOrders.slice(0, 10));
        }
        return Promise.resolve(allOrders);
      });

      const analytics = await AnalyticsService.getStoreAnalytics(storeId, "CUSTOM:2026-11-01:2026-11-14");

      // 1. Pedidos recentes DEVE ter exatamente 10 itens
      expect(analytics.recentOrders.length).toBeLessThanOrEqual(10);
      expect(analytics.recentOrders.length).toBe(10);

      // 2. Agregação financeira DEVE considerar os 926 pedidos e R$ 5.748,00
      expect(analytics.kpis.revenue.value).toBe(5748.00);
      expect(normalizeBRL(analytics.kpis.revenue.formatted)).toBe("R$ 5.748,00");
      expect(analytics.kpis.salesCount.value).toBe(926);
      expect(analytics.kpis.salesCount.formatted).toBe("926");
      expect(analytics.kpis.averageTicket.value).toBe(6.21);
      expect(normalizeBRL(analytics.kpis.averageTicket.formatted)).toBe("R$ 6,21");

      // 3. CommercialMetrics sincronizado
      expect(analytics.commercialMetrics.approvedSales.total).toBe(5748.00);
      expect(analytics.commercialMetrics.approvedSales.count).toBe(926);

      // 4. FinancialSummary consistente
      expect(analytics.financialSummary?.grossRevenue).toBe(5748.00);
      expect(analytics.financialSummary?.paidOrdersCount).toBe(926);
    });
  });
});
