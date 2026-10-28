import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommercialMetricsService } from "../commercial-metrics-service";
import { BotStartEventService } from "../bot-start-service";

// Mock database
vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      execute: vi.fn(),
      query: {
        orders: {
          findMany: vi.fn(),
        },
      },
    },
  };
});

describe("WebGran — Contagem de Starts Únicos por Usuário em Cada Bot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const refDate = new Date("2026-10-28T12:00:00.000Z");

  describe("1. Primeiro /start de um usuário no bot contabiliza uma ocorrência", () => {
    it("contabiliza exatamente 1 start quando o usuário envia /start pela primeira vez", () => {
      const simulatedStarts = [
        {
          id: "start-1",
          userId: "user-alpha",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:00:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      expect(metrics.botStarts.totalStarts).toBe(1);
      expect(metrics.botStarts.uniqueUsers).toBe(1);
      expect(metrics.botStarts.formatted).toBe("1");
    });
  });

  describe("2. Repetições do mesmo usuário no mesmo bot não incrementam a métrica", () => {
    it("não incrementa a contagem quando o mesmo usuário envia /start múltiplas vezes (2x ou 20x)", () => {
      const startsSameUser: Array<{ id: string; userId: string; botId: string; timestamp: Date }> = [
        // 1st start
        {
          id: "start-1",
          userId: "user-alpha",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:00:00.000Z"),
        },
      ];

      // Add 20 repeated starts from the same user on the same bot
      for (let i = 2; i <= 21; i++) {
        startsSameUser.push({
          id: `start-${i}`,
          userId: "user-alpha",
          botId: "bot-1",
          timestamp: new Date(new Date("2026-10-10T10:00:00.000Z").getTime() + i * 60000),
        });
      }

      const metrics = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: startsSameUser,
      });

      // Must strictly remain 1 start and 1 unique user despite 21 total events
      expect(metrics.botStarts.totalStarts).toBe(1);
      expect(metrics.botStarts.uniqueUsers).toBe(1);
      expect(metrics.botStarts.formatted).toBe("1");
    });
  });

  describe("3. Usuários diferentes são contabilizados separadamente", () => {
    it("contabiliza separadamente cada usuário distinto no mesmo bot", () => {
      const simulatedStarts = [
        {
          id: "start-user-a-1",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:00:00.000Z"),
        },
        {
          id: "start-user-a-2",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-11T10:00:00.000Z"), // repeat User A
        },
        {
          id: "start-user-b-1",
          userId: "user-b",
          botId: "bot-1",
          timestamp: new Date("2026-10-12T10:00:00.000Z"),
        },
        {
          id: "start-user-c-1",
          userId: "user-c",
          botId: "bot-1",
          timestamp: new Date("2026-10-13T10:00:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      // 3 distinct users (A, B, C) -> 3 starts, 3 unique users
      expect(metrics.botStarts.totalStarts).toBe(3);
      expect(metrics.botStarts.uniqueUsers).toBe(3);
    });
  });

  describe("4. O mesmo usuário em bots diferentes gera uma ocorrência para cada bot", () => {
    it("contabiliza 1 ocorrência para cada bot diferente iniciado pelo mesmo usuário", () => {
      const simulatedStarts = [
        // User A starts Bot 1 (2 times)
        {
          id: "start-1",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:00:00.000Z"),
        },
        {
          id: "start-2",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:05:00.000Z"),
        },
        // User A starts Bot 2 (1st time)
        {
          id: "start-3",
          userId: "user-a",
          botId: "bot-2",
          timestamp: new Date("2026-10-11T10:00:00.000Z"),
        },
      ];

      const metrics = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      // Total starts = 2 (1 for Bot 1 + 1 for Bot 2)
      // Unique users = 1 (only user-a)
      expect(metrics.botStarts.totalStarts).toBe(2);
      expect(metrics.botStarts.uniqueUsers).toBe(1);
    });
  });

  describe("5. Webhooks duplicados e eventos concorrentes não geram contagens duplicadas", () => {
    it("garante idempotência no webhook via telegramUpdateId retornando isDuplicate: true", async () => {
      const { db } = await import("@/db");

      // Customer upsert mock
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "customer-1" }]),
        }),
      });

      // Check first start query mock
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // 1st request: inserts successfully
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "event-1" }]),
          }),
        }),
      });

      const firstCall = await BotStartEventService.recordStartEvent({
        storeId: "store-1",
        botId: "bot-1",
        telegramUserId: "111222",
        telegramUpdateId: 888123,
      });

      expect(firstCall.success).toBe(true);
      expect(firstCall.recorded).toBe(true);
      expect(firstCall.isDuplicate).toBe(false);
      expect(firstCall.isFirstStart).toBe(true);

      // Customer upsert mock for retry
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "customer-1" }]),
        }),
      });

      // Check first start query mock
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "event-1" }]),
          }),
        }),
      });

      // 2nd request (duplicate webhook with same updateId): onConflictDoNothing returns empty
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const duplicateCall = await BotStartEventService.recordStartEvent({
        storeId: "store-1",
        botId: "bot-1",
        telegramUserId: "111222",
        telegramUpdateId: 888123, // Same update ID
      });

      expect(duplicateCall.success).toBe(true);
      expect(duplicateCall.recorded).toBe(false);
      expect(duplicateCall.isDuplicate).toBe(true);
    });
  });

  describe("6. Os filtros por período utilizam a data do primeiro start", () => {
    it("não contabiliza repetições em um novo período se o primeiro start ocorreu em período anterior", () => {
      // User A first started in September (outside October 30D window)
      // User A sent /start again in October (inside 30D window)
      // User B first started in October (inside 30D window)
      const simulatedStarts = [
        {
          id: "user-a-sep",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-09-01T12:00:00.000Z"), // Earliest start for (bot-1, user-a)
        },
        {
          id: "user-a-oct",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-15T12:00:00.000Z"), // Repeated start in Oct
        },
        {
          id: "user-b-oct",
          userId: "user-b",
          botId: "bot-1",
          timestamp: new Date("2026-10-16T12:00:00.000Z"), // Earliest start for (bot-1, user-b)
        },
      ];

      // In 30D (October window ending Oct 28):
      // - User A's first start was 2026-09-01, so NOT in October window.
      // - User B's first start was 2026-10-16, so YES in October window.
      const metrics30D = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      expect(metrics30D.botStarts.totalStarts).toBe(1); // Only User B
      expect(metrics30D.botStarts.uniqueUsers).toBe(1);

      // In ALL (historical):
      // Both User A and User B first starts are included
      const metricsAll = CommercialMetricsService.calculateMetrics([], {
        period: "ALL",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      expect(metricsAll.botStarts.totalStarts).toBe(2); // User A + User B
      expect(metricsAll.botStarts.uniqueUsers).toBe(2);
    });
  });

  describe("7. Os filtros por bot e o total geral apresentam contagens consistentes", () => {
    it("a soma das contagens dos filtros por bot é exatamente igual ao total geral sem filtro", () => {
      const simulatedStarts = [
        // User A starts Bot 1 & Bot 2
        {
          id: "start-a1",
          userId: "user-a",
          botId: "bot-1",
          timestamp: new Date("2026-10-10T10:00:00.000Z"),
        },
        {
          id: "start-a2",
          userId: "user-a",
          botId: "bot-2",
          timestamp: new Date("2026-10-11T10:00:00.000Z"),
        },
        // User B starts Bot 1
        {
          id: "start-b1",
          userId: "user-b",
          botId: "bot-1",
          timestamp: new Date("2026-10-12T10:00:00.000Z"),
        },
        // User C starts Bot 2
        {
          id: "start-c2",
          userId: "user-c",
          botId: "bot-2",
          timestamp: new Date("2026-10-13T10:00:00.000Z"),
        },
      ];

      // Bot 1 filter
      const metricsBot1 = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
        botId: "bot-1",
      });

      // Bot 2 filter
      const metricsBot2 = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
        botId: "bot-2",
      });

      // General (all bots)
      const metricsGeneral = CommercialMetricsService.calculateMetrics([], {
        period: "30D",
        referenceDate: refDate,
        simulatedBotStarts: simulatedStarts,
      });

      // Bot 1: user-a and user-b = 2 starts
      expect(metricsBot1.botStarts.totalStarts).toBe(2);
      expect(metricsBot1.botStarts.uniqueUsers).toBe(2);

      // Bot 2: user-a and user-c = 2 starts
      expect(metricsBot2.botStarts.totalStarts).toBe(2);
      expect(metricsBot2.botStarts.uniqueUsers).toBe(2);

      // General: Bot 1 starts (2) + Bot 2 starts (2) = 4 starts
      // Unique users across all bots: user-a, user-b, user-c = 3 unique users
      expect(metricsGeneral.botStarts.totalStarts).toBe(4);
      expect(metricsGeneral.botStarts.totalStarts).toBe(
        metricsBot1.botStarts.totalStarts! + metricsBot2.botStarts.totalStarts!
      );
      expect(metricsGeneral.botStarts.uniqueUsers).toBe(3);
    });
  });

  describe("8. Os dados históricos não são apagados ou duplicados", () => {
    it("armazena eventos subsequentes sem alterar nem deletar o registro histórico original", async () => {
      const { db } = await import("@/db");

      // Mock customer upsert
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "cust-1" }]),
        }),
      });

      // Mock first start check query returning an existing record (meaning user has previous start)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "original-historical-start-id" }]),
          }),
        }),
      });

      // Mock insert of the new second start event
      let insertedPayload: any = null;
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockImplementation((val) => {
          insertedPayload = val;
          return {
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-start-event-id" }]),
            }),
          };
        }),
      });

      const secondStart = await BotStartEventService.recordStartEvent({
        storeId: "store-1",
        botId: "bot-1",
        telegramUserId: "user-veteran",
        telegramUpdateId: 999902,
      });

      expect(secondStart.success).toBe(true);
      expect(secondStart.recorded).toBe(true);
      // isFirstStart is correctly marked false for the repeat, preserving history without overwriting
      expect(secondStart.isFirstStart).toBe(false);
      expect(insertedPayload?.metadata?.isFirstStart).toBe(false);
    });
  });
});
