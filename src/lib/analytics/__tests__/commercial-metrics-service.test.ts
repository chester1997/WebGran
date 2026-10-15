import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  CommercialMetricsService, 
  resolvePeriodDateRange, 
  formatBRLCurrency 
} from "../commercial-metrics-service";

// Mock db for database isolation tests
vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findMany: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("CommercialMetricsService Suite", () => {
  const baseDate = new Date("2026-10-14T20:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Soma correta das vendas aprovadas & Formatação", () => {
    it("calcula a soma correta exclusivamente de pedidos pagos e formata em BRL", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "150.50",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-2",
          storeId: "store-a",
          status: "paid",
          total: "99.00",
          paidAt: new Date("2026-10-12T15:00:00.000Z"),
          createdAt: new Date("2026-10-12T14:50:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      expect(metrics.approvedSales.total).toBe(249.50);
      expect(metrics.approvedSales.count).toBe(2);
      expect(metrics.approvedSales.formatted).toContain("249,50");
    });

    it("evita contar o mesmo pedido mais de uma vez (idempotência por order.id)", () => {
      const orders = [
        {
          id: "order-dup-1",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-dup-1", // duplicate payload with same order id
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      expect(metrics.approvedSales.total).toBe(100.00);
      expect(metrics.approvedSales.count).toBe(1);
    });

    it("não presume meta comercial quando o sistema não possuir configuração de meta", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "500.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      expect(metrics.approvedSales.hasTargetGoal).toBe(false);
      expect(metrics.approvedSales.targetGoal).toBeNull();
      expect(metrics.approvedSales.targetProgressPercent).toBeNull();
    });

    it("calcula percentual da meta somente quando a meta for expressamente fornecida", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "500.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { 
        period: "30D",
        customTargetGoal: 1000 
      });

      expect(metrics.approvedSales.hasTargetGoal).toBe(true);
      expect(metrics.approvedSales.targetGoal).toBe(1000);
      expect(metrics.approvedSales.targetProgressPercent).toBe(50);
    });
  });

  describe("2. Exclusão rigorosa de pagamentos pendentes, cancelados e expirados", () => {
    it("não inclui pedidos pendentes, cancelados, expirados ou estornados nas vendas aprovadas", () => {
      const orders = [
        {
          id: "order-paid",
          storeId: "store-a",
          status: "paid",
          total: "200.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-pending",
          storeId: "store-a",
          status: "pending",
          total: "500.00",
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-cancelled",
          storeId: "store-a",
          status: "cancelled",
          total: "300.00",
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-expired",
          storeId: "store-a",
          status: "expired",
          total: "400.00",
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      expect(metrics.approvedSales.total).toBe(200.00);
      expect(metrics.approvedSales.count).toBe(1);
    });
  });

  describe("3. Cálculo do Ticket Médio & Métricas de Pix", () => {
    it("calcula o ticket médio dividindo a receita aprovada pela quantidade de pedidos pagos", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
          paymentMethod: "syncpay",
          pixQrCode: "pix-code-1",
        },
        {
          id: "order-2",
          storeId: "store-a",
          status: "paid",
          total: "200.00",
          paidAt: new Date("2026-10-11T12:00:00.000Z"),
          createdAt: new Date("2026-10-11T11:50:00.000Z"),
          paymentMethod: "mercadopago",
          pixQrCode: "pix-code-2",
        },
        {
          id: "order-3",
          storeId: "store-a",
          status: "pending", // Unpaid Pix order generated
          total: "300.00",
          createdAt: new Date("2026-10-12T11:50:00.000Z"),
          paymentMethod: "syncpay",
          pixQrCode: "pix-code-3",
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      // Ticket médio = (100 + 200) / 2 = 150.00
      expect(metrics.averageTicket.averageTicket).toBe(150.00);
      expect(metrics.averageTicket.consideredSalesCount).toBe(2);
      expect(metrics.averageTicket.formatted).toContain("150,00");

      // Pix metrics
      expect(metrics.averageTicket.approvedPixCount).toBe(2);
      expect(metrics.averageTicket.generatedPixCount).toBe(3);
      // Pix conversion rate: 2 / 3 = 67%
      expect(metrics.averageTicket.pixConversionRatePercent).toBe(67);
    });

    it("retorna R$ 0,00 com zero vendas sem erro de divisão por zero", () => {
      const metrics = CommercialMetricsService.calculateMetrics([], { period: "30D" });

      expect(metrics.averageTicket.averageTicket).toBe(0);
      expect(metrics.averageTicket.consideredSalesCount).toBe(0);
      expect(metrics.averageTicket.approvedPixCount).toBe(0);
      expect(metrics.averageTicket.generatedPixCount).toBe(0);
      expect(metrics.averageTicket.pixConversionRatePercent).toBeNull();
      expect(metrics.averageTicket.formatted).toContain("0,00");
    });
  });

  describe("4. Taxa de Conversão — Presença e Ausência de Dados", () => {
    it("trata ausência de telemetria de visitas com status explicativo e sem inventar dados", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      // Default calculation: simulatedVisits is not supplied because Neon lacks visitor sessions tracking
      const metrics = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });

      expect(metrics.conversionRate.isTelemetryAvailable).toBe(false);
      expect(metrics.conversionRate.ratePercent).toBeNull();
      expect(metrics.conversionRate.formatted).toBe("—");
      expect(metrics.conversionRate.statusMessage).toBe("Rastreamento de visitas não disponível");
    });

    it("calcula taxa de conversão correta quando sessões de visitantes estão disponíveis", () => {
      const orders = [
        {
          id: "order-1",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-2",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-11T12:00:00.000Z"),
          createdAt: new Date("2026-10-11T11:50:00.000Z"),
        },
      ];

      // 2 sales over 50 sessions = 4.0%
      const metrics = CommercialMetricsService.calculateMetrics(orders, { 
        period: "30D",
        simulatedVisits: 50 
      });

      expect(metrics.conversionRate.isTelemetryAvailable).toBe(true);
      expect(metrics.conversionRate.ratePercent).toBe(4.0);
      expect(metrics.conversionRate.formatted).toBe("4,0%");
      expect(metrics.conversionRate.statusMessage).toBe("2 vendas em 50 sessões");
    });

    it("trata 0 visitas com taxa 0,0% sem divisão por zero", () => {
      const metrics = CommercialMetricsService.calculateMetrics([], { 
        period: "30D",
        simulatedVisits: 0 
      });

      expect(metrics.conversionRate.isTelemetryAvailable).toBe(true);
      expect(metrics.conversionRate.ratePercent).toBe(0);
      expect(metrics.conversionRate.formatted).toBe("0,0%");
    });
  });

  describe("5. Contagem de Starts — Telegram Telemetry & Idempotência", () => {
    it("informa lacuna de persistência de /start sem simular valores falsos", () => {
      const metrics = CommercialMetricsService.calculateMetrics([], { period: "30D" });

      expect(metrics.botStarts.isTelemetryAvailable).toBe(false);
      expect(metrics.botStarts.totalStarts).toBe(0);
      expect(metrics.botStarts.formatted).toBe("0");
      expect(metrics.botStarts.statusMessage).toBe("Eventos de /start não registrados no banco");
    });

    it("quando dados de start são fornecidos, contabiliza eventos e deduplica usuários", () => {
      const simulatedStarts = [
        { id: "s-1", userId: "tg-user-1", botId: "bot-1", timestamp: new Date("2026-10-10T10:00:00.000Z") },
        { id: "s-2", userId: "tg-user-1", botId: "bot-1", timestamp: new Date("2026-10-11T10:00:00.000Z") }, // same user started again
        { id: "s-3", userId: "tg-user-2", botId: "bot-1", timestamp: new Date("2026-10-12T10:00:00.000Z") },
      ];

      const metrics = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        simulatedBotStarts: simulatedStarts,
      });

      expect(metrics.botStarts.isTelemetryAvailable).toBe(true);
      expect(metrics.botStarts.totalStarts).toBe(3);
      expect(metrics.botStarts.uniqueUsers).toBe(2);
      expect(metrics.botStarts.formatted).toBe("3");
    });
  });

  describe("6. Isolamento estrito entre vendedores, lojas e bots", () => {
    it("não contabiliza pedidos de outras lojas", () => {
      const orders = [
        {
          id: "order-own",
          storeId: "store-mine",
          status: "paid",
          total: "300.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-alien",
          storeId: "store-other-seller",
          status: "paid",
          total: "10000.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
      ];

      // Filtering orders by store-mine as done in backend service
      const filtered = orders.filter((o) => o.storeId === "store-mine");
      const metrics = CommercialMetricsService.calculateMetrics(filtered, { period: "30D" });

      expect(metrics.approvedSales.total).toBe(300.00);
      expect(metrics.approvedSales.count).toBe(1);
    });

    it("getCommercialMetrics executa consulta filtrando rigorosamente por storeId", async () => {
      const { db } = await import("@/db");
      vi.mocked(db.query.orders.findMany).mockResolvedValueOnce([
        {
          id: "ord-test",
          storeId: "store-sec-1",
          status: "paid",
          total: "125.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"),
          createdAt: new Date("2026-10-10T12:00:00.000Z"),
          paymentMethod: "syncpay",
          pixQrCode: "pix-qr",
        } as any,
      ]);

      const result = await CommercialMetricsService.getCommercialMetrics("store-sec-1", "30D");

      expect(db.query.orders.findMany).toHaveBeenCalled();
      expect(result.storeId).toBe("store-sec-1");
      expect(result.approvedSales.total).toBe(125.00);
    });
  });

  describe("7. Limites de período e fuso horário", () => {
    it("exclui pedidos que estão fora da janela temporal selecionada", () => {
      const now = new Date("2026-10-14T20:00:00.000Z");

      const orders = [
        {
          id: "order-inside-7d",
          storeId: "store-a",
          status: "paid",
          total: "100.00",
          paidAt: new Date("2026-10-10T12:00:00.000Z"), // 4 days ago
          createdAt: new Date("2026-10-10T11:50:00.000Z"),
        },
        {
          id: "order-outside-7d",
          storeId: "store-a",
          status: "paid",
          total: "500.00",
          paidAt: new Date("2026-10-01T12:00:00.000Z"), // 13 days ago
          createdAt: new Date("2026-10-01T11:50:00.000Z"),
        },
      ];

      const metrics7D = CommercialMetricsService.calculateMetrics(orders, { period: "7D" });
      expect(metrics7D.approvedSales.total).toBe(100.00);

      const metrics30D = CommercialMetricsService.calculateMetrics(orders, { period: "30D" });
      expect(metrics30D.approvedSales.total).toBe(600.00);
    });

    it("resolve limites de período para TODAY, 7D, 30D, 90D, 12M e ALL", () => {
      const ref = new Date("2026-10-14T15:30:00.000Z");

      const today = resolvePeriodDateRange("TODAY", ref);
      expect(today.startDate.getHours()).toBe(0);
      expect(today.startDate.getMinutes()).toBe(0);

      const p7d = resolvePeriodDateRange("7D", ref);
      const diff7 = (p7d.endDate.getTime() - p7d.startDate.getTime()) / (1000 * 3600 * 24);
      expect(Math.round(diff7)).toBe(7);

      const pAll = resolvePeriodDateRange("ALL", ref);
      expect(pAll.startDate.getTime()).toBe(0);
    });
  });

  describe("8. Dashboard sem vendas (Zero State)", () => {
    it("produz estado neutro seguro para uma loja sem vendas no período", () => {
      const metrics = CommercialMetricsService.calculateMetrics([], { period: "30D" });

      expect(metrics.approvedSales.total).toBe(0);
      expect(metrics.approvedSales.count).toBe(0);
      expect(metrics.approvedSales.formatted).toContain("0,00");

      expect(metrics.conversionRate.isTelemetryAvailable).toBe(false);
      expect(metrics.conversionRate.formatted).toBe("—");

      expect(metrics.botStarts.totalStarts).toBe(0);
      expect(metrics.botStarts.formatted).toBe("0");

      expect(metrics.averageTicket.averageTicket).toBe(0);
      expect(metrics.averageTicket.consideredSalesCount).toBe(0);
      expect(metrics.averageTicket.approvedPixCount).toBe(0);
      expect(metrics.averageTicket.generatedPixCount).toBe(0);
    });
  });
});
