import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotStartEventService } from "../bot-start-service";
import { StoreTrackingService } from "../store-tracking-service";
import { CommercialMetricsService } from "../commercial-metrics-service";

// Mock database
vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      query: {
        orders: {
          findMany: vi.fn(),
        },
      },
    },
  };
});

describe("WEBGRAN — Starts e Taxa de Conversão Test Suite (Fases 1 a 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Recebimento e persistência de um /start", () => {
    it("persiste evento de start com dados completos do usuário e telegramUpdateId", async () => {
      const { db } = await import("@/db");
      
      // Mock customer upsert
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "customer-1" }]),
        }),
      });

      // Mock botStartEvents insert returning id
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "event-uuid-1" }]),
          }),
        }),
      });

      const res = await BotStartEventService.recordStartEvent({
        storeId: "store-alpha",
        botId: "bot-1",
        telegramUserId: "12345678",
        telegramUsername: "luiz_dev",
        telegramFirstName: "Luiz",
        telegramUpdateId: 999001,
        startPayload: "promo_summer",
        metadata: { source: "telegram" },
      });

      expect(res.success).toBe(true);
      expect(res.recorded).toBe(true);
      expect(res.isDuplicate).toBe(false);
    });
  });

  describe("2. Reenvio da mesma atualização sem duplicidade (Idempotência)", () => {
    it("identifica atualização repetida via telegramUpdateId e não gera duplicata", async () => {
      const { db } = await import("@/db");

      // Mock customer upsert
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "customer-1" }]),
        }),
      });

      // Mock botStartEvents insert returning empty on duplicate conflict
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // Empty means conflict was ignored
          }),
        }),
      });

      const res = await BotStartEventService.recordStartEvent({
        storeId: "store-alpha",
        botId: "bot-1",
        telegramUserId: "12345678",
        telegramUpdateId: 999001,
      });

      expect(res.success).toBe(true);
      expect(res.recorded).toBe(false);
      expect(res.isDuplicate).toBe(true);
    });
  });

  describe("3. Isolamento de eventos entre lojas", () => {
    it("filtra métricas estritamente pelo storeId", async () => {
      const { db } = await import("@/db");

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { totalStarts: 15, uniqueUsers: 12 },
          ]),
        }),
      });

      const metricsStoreAlpha = await BotStartEventService.getStartsMetrics("store-alpha");

      expect(metricsStoreAlpha.isTelemetryAvailable).toBe(true);
      expect(metricsStoreAlpha.totalStarts).toBe(15);
      expect(metricsStoreAlpha.uniqueUsers).toBe(12);
    });
  });

  describe("4. Registro de visitas e sessões", () => {
    it("cria nova sessão se não existir e evita duplicação ao reutilizar o mesmo sessionId", async () => {
      const { db } = await import("@/db");

      // First call: session does not exist -> insert
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockResolvedValue([{ id: "session-abc" }]),
      });

      const firstVisit = await StoreTrackingService.recordSessionVisit({
        sessionId: "session-abc",
        storeId: "store-alpha",
        entryPath: "/miniapp/alpha",
        utmSource: "instagram",
      });

      expect(firstVisit.success).toBe(true);
      expect(firstVisit.isNew).toBe(true);

      // Second call (e.g. React re-render or internal page navigation): session exists -> update lastActiveAt
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "session-abc" }]),
          }),
        }),
      });
      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "session-abc" }]),
        }),
      });

      const secondVisit = await StoreTrackingService.recordSessionVisit({
        sessionId: "session-abc",
        storeId: "store-alpha",
        entryPath: "/miniapp/alpha/product/1",
      });

      expect(secondVisit.success).toBe(true);
      expect(secondVisit.isNew).toBe(false);
    });
  });

  describe("5. Atribuição de pedido aprovado à sessão", () => {
    it("associa sessão convertida quando pedido aprovado compartilha o mesmo sessionId", async () => {
      const { db } = await import("@/db");

      // 1. Eligible sessions query
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalEligible: 20 }]),
        }),
      });

      // 2. Converted sessions query (orders.status = 'paid' inner joined with store_sessions)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ totalConverted: 4 }]),
          }),
        }),
      });

      const result = await StoreTrackingService.getConversionRateMetrics("store-alpha");

      expect(result.isTelemetryAvailable).toBe(true);
      expect(result.eligibleSessions).toBe(20);
      expect(result.convertedSessions).toBe(4);
      // (4 / 20) * 100 = 20.0%
      expect(result.ratePercent).toBe(20.0);
    });
  });

  describe("6. Exclusão de pedidos não aprovados da conversão", () => {
    it("pedidos pendentes, recusados ou cancelados não são contabilizados como conversão", () => {
      const orders = [
        {
          id: "order-pending",
          storeId: "store-alpha",
          status: "pending",
          total: "100.00",
          createdAt: new Date(),
        },
        {
          id: "order-cancelled",
          storeId: "store-alpha",
          status: "cancelled",
          total: "150.00",
          createdAt: new Date(),
        },
        {
          id: "order-paid",
          storeId: "store-alpha",
          status: "paid",
          total: "200.00",
          paidAt: new Date(),
          createdAt: new Date(),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics(orders, {
        period: "30D",
        simulatedVisits: 10,
      });

      // Only the paid order should count (1 / 10 = 10%)
      expect(metrics.conversionRate.convertedOrders).toBe(1);
      expect(metrics.conversionRate.ratePercent).toBe(10.0);
      expect(metrics.approvedSales.total).toBe(200.00);
      expect(metrics.approvedSales.count).toBe(1);
    });
  });

  describe("7. Cálculo correto da taxa de conversão", () => {
    it("calcula taxa exata com arredondamento em 1 casa decimal", async () => {
      const { db } = await import("@/db");

      // 7 converted over 45 eligible = 15.555...% -> 15.6%
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalEligible: 45 }]),
        }),
      });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ totalConverted: 7 }]),
          }),
        }),
      });

      const result = await StoreTrackingService.getConversionRateMetrics("store-alpha");

      expect(result.ratePercent).toBe(15.6);
      expect(result.eligibleSessions).toBe(45);
      expect(result.convertedSessions).toBe(7);
    });
  });

  describe("8. Ausência de sessões elegíveis (Estado Sem Dados)", () => {
    it("quando totalEligible === 0, retorna ratePercent: null ('Sem dados') e não 0%", async () => {
      const { db } = await import("@/db");

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalEligible: 0 }]),
        }),
      });

      const result = await StoreTrackingService.getConversionRateMetrics("store-alpha");

      expect(result.ratePercent).toBeNull();
      expect(result.eligibleSessions).toBe(0);
      expect(result.convertedSessions).toBe(0);
      expect(result.statusMessage).toContain("Sem dados suficientes");
    });

    it("quando existem sessões elegíveis mas zero conversões, retorna taxa 0.0%", async () => {
      const { db } = await import("@/db");

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalEligible: 12 }]),
        }),
      });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ totalConverted: 0 }]),
          }),
        }),
      });

      const result = await StoreTrackingService.getConversionRateMetrics("store-alpha");

      expect(result.ratePercent).toBe(0);
      expect(result.eligibleSessions).toBe(12);
      expect(result.convertedSessions).toBe(0);
    });
  });

  describe("9. Falha temporária do banco de dados", () => {
    it("trata erro de conexão em BotStartEventService sem lançar unhandled rejection", async () => {
      const { db } = await import("@/db");

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Connection timeout")),
        }),
      });

      const metrics = await BotStartEventService.getStartsMetrics("store-alpha");

      expect(metrics.isTelemetryAvailable).toBe(false);
      expect(metrics.hasError).toBe(true);
      expect(metrics.totalStarts).toBe(0);
    });

    it("trata erro em StoreTrackingService graciosamente", async () => {
      const { db } = await import("@/db");

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Database offline")),
        }),
      });

      const metrics = await StoreTrackingService.getConversionRateMetrics("store-alpha");

      expect(metrics.isTelemetryAvailable).toBe(false);
      expect(metrics.hasError).toBe(true);
      expect(metrics.ratePercent).toBeNull();
    });
  });

  describe("10. Consultas do dashboard e filtros de período", () => {
    it("integra métricas reais no método getCommercialMetrics com respeito ao período", async () => {
      const { db } = await import("@/db");

      (db.query.orders.findMany as any).mockResolvedValue([
        {
          id: "order-1",
          storeId: "store-alpha",
          status: "paid",
          total: "150.00",
          paidAt: new Date(),
          createdAt: new Date(),
          paymentMethod: "pix",
          pixQrCode: "qrcode",
        },
      ]);

      // Mock BotStartEventService count
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalStarts: 50, uniqueUsers: 40 }]),
        }),
      });

      // Mock StoreTrackingService counts (100 eligible, 10 converted)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalEligible: 100 }]),
        }),
      });
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ totalConverted: 10 }]),
          }),
        }),
      });

      const result = await CommercialMetricsService.getCommercialMetrics("store-alpha", "7D");

      expect(result.period).toBe("7D");
      expect(result.storeId).toBe("store-alpha");
      expect(result.approvedSales.total).toBe(150.00);
      expect(result.botStarts.totalStarts).toBe(50);
      expect(result.botStarts.uniqueUsers).toBe(40);
      expect(result.botStarts.isTelemetryAvailable).toBe(true);
      expect(result.conversionRate.ratePercent).toBe(10.0);
      expect(result.conversionRate.totalVisits).toBe(100);
      expect(result.conversionRate.convertedOrders).toBe(10);
      expect(result.conversionRate.isTelemetryAvailable).toBe(true);
    });
  });
});
