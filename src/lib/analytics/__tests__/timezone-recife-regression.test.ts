import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  getBusinessParts,
  getBusinessStartOfDay,
  getBusinessEndOfDay,
  getBusinessDateKey,
  getBusinessDateLabel,
  getBusinessChartDateLabel,
  getBusinessMonthKey,
  getBusinessMonthLabel,
  getBusinessStartOfMonth,
  getBusinessStartOfNextMonth,
  formatBusinessDateTime,
  formatBusinessDate,
  parseCivilDate,
  formatCivilDateToBR,
} from "../timezone-utils";

describe("WEBGRAN — Fuso Horário Oficial America/Recife & Auditoria Geral", () => {
  it("define America/Recife como fuso horário comercial oficial do WebGran", () => {
    expect(BUSINESS_TIMEZONE).toBe("America/Recife");
  });

  describe("1. Instantes Absolutos em UTC vs Horário Local em Recife (PE)", () => {
    it("instante 2026-10-23T01:30:00Z deve corresponder a 22/10/2026 22:30 em Recife", () => {
      const instant = new Date("2026-10-23T01:30:00.000Z");
      const parts = getBusinessParts(instant);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(22);
      expect(parts.hour).toBe(22);
      expect(parts.minute).toBe(30);

      const formatted = formatBusinessDateTime(instant);
      expect(formatted).toBe("22/10/2026 22:30");
    });

    it("instante 2026-10-23T02:00:00Z deve corresponder a 22/10/2026 23:00 em Recife", () => {
      const instant = new Date("2026-10-23T02:00:00.000Z");
      const parts = getBusinessParts(instant);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(22);
      expect(parts.hour).toBe(23);
      expect(parts.minute).toBe(0);

      const formatted = formatBusinessDateTime(instant);
      expect(formatted).toBe("22/10/2026 23:00");
    });

    it("instante 2026-10-23T03:00:00Z deve corresponder exatamente à meia-noite (00:00) de 23/10/2026 em Recife", () => {
      const instant = new Date("2026-10-23T03:00:00.000Z");
      const parts = getBusinessParts(instant);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(23);
      expect(parts.hour).toBe(0);
      expect(parts.minute).toBe(0);

      const formatted = formatBusinessDateTime(instant);
      expect(formatted).toBe("23/10/2026 00:00");
    });
  });

  describe("2. Vendas Antes e Depois da Meia-Noite Local (Dia Comercial Correto)", () => {
    it("atribui vendas às 23:59:59 ao dia anterior e 00:00:00 ao novo dia comercial", () => {
      // 23:59:59.999 em Recife no dia 22/10 -> 02:59:59.999Z em UTC no dia 23/10
      const saleBeforeMidnight = new Date("2026-10-23T02:59:59.999Z");
      // 00:00:00.000 em Recife no dia 23/10 -> 03:00:00.000Z em UTC no dia 23/10
      const saleAfterMidnight = new Date("2026-10-23T03:00:00.000Z");

      const keyBefore = getBusinessDateKey(saleBeforeMidnight);
      const labelBefore = getBusinessChartDateLabel(saleBeforeMidnight);
      expect(keyBefore).toBe("2026-10-22");
      expect(labelBefore).toContain("22");
      expect(labelBefore).toContain("out");

      const keyAfter = getBusinessDateKey(saleAfterMidnight);
      const labelAfter = getBusinessChartDateLabel(saleAfterMidnight);
      expect(keyAfter).toBe("2026-10-23");
      expect(labelAfter).toContain("23");
      expect(labelAfter).toContain("out");
    });

    it("preserva a integridade financeira agregando valores no dia comercial correto", () => {
      const orders = [
        { id: "ord-1", total: 100.50, createdAt: new Date("2026-10-23T01:30:00.000Z") }, // 22/10 22:30
        { id: "ord-2", total: 49.50, createdAt: new Date("2026-10-23T02:45:00.000Z") },  // 22/10 23:45
        { id: "ord-3", total: 200.00, createdAt: new Date("2026-10-23T03:05:00.000Z") }, // 23/10 00:05
      ];

      const dailyTotals: Record<string, number> = {};
      for (const ord of orders) {
        const key = getBusinessDateKey(ord.createdAt);
        dailyTotals[key] = (dailyTotals[key] || 0) + ord.total;
      }

      // Vendas do dia comercial 22/10 em Recife
      expect(dailyTotals["2026-10-22"]).toBe(150.00);
      // Vendas do dia comercial 23/10 em Recife
      expect(dailyTotals["2026-10-23"]).toBe(200.00);

      // Soma total preservada rigorosamente
      const totalSum = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
      expect(totalSum).toBe(350.00);
    });
  });

  describe("3. Limites de Início e Fim (Sem Perda Nem Duplicação)", () => {
    it("startOfDay e endOfDay definem janela estrita de 24 horas no fuso America/Recife", () => {
      const refDate = new Date("2026-10-23T01:30:00.000Z"); // 22/10 22:30 Recife
      const start = getBusinessStartOfDay(refDate);
      const end = getBusinessEndOfDay(refDate);

      // Início do dia 22/10 em Recife é 2026-10-22 00:00:00 BRT = 2026-10-22 03:00:00.000Z
      expect(start.toISOString()).toBe("2026-10-22T03:00:00.000Z");
      // Fim do dia 22/10 em Recife é 2026-10-23 00:00:00 BRT = 2026-10-23 03:00:00.000Z
      expect(end.toISOString()).toBe("2026-10-23T03:00:00.000Z");

      // Janela estrita de exatamente 86.400.000 ms (24h)
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);

      // O instante de 22:30 está estritamente dentro da janela
      expect(refDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(refDate.getTime()).toBeLessThan(end.getTime());
    });

    it("filtro de ontem e hoje não possui lacuna nem sobreposição de períodos", () => {
      const now = new Date("2026-10-23T01:30:00.000Z"); // 22/10 22:30 Recife
      const todayStart = getBusinessStartOfDay(now);
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);

      // Ontem termina exatamente 1 ms antes de hoje começar
      expect(yesterdayEnd.getTime() + 1).toBe(todayStart.getTime());
      expect(yesterdayStart.toISOString()).toBe("2026-10-21T03:00:00.000Z");
    });
  });

  describe("4. Gráfico do Dashboard — Coerência Eixo X, Tooltip e Ponto Atual", () => {
    it("não exibe 23/10 quando o horário em Recife ainda for 22/10 antes das 23h", () => {
      // Simulação do cenário relatado pelo usuário: 22/10/2026 antes das 23h em Recife
      const simulatedNow = new Date("2026-10-23T01:45:00.000Z"); // 22:45 BRT em 22/10

      const startOfToday = getBusinessStartOfDay(simulatedNow);
      const daysCount = 30;
      const keys: string[] = [];

      for (let i = daysCount - 1; i >= 0; i--) {
        const dayInstant = new Date(startOfToday.getTime() - i * 24 * 3600 * 1000);
        keys.push(getBusinessChartDateLabel(dayInstant));
      }

      // O último ponto da série temporal DEVE ser 22 de out. e NUNCA 23 de out.
      const lastKey = keys[keys.length - 1];
      expect(lastKey).toContain("22");
      expect(lastKey).toContain("out");
      expect(lastKey).not.toContain("23");

      // Verificação do pedido criado às 22:45
      const orderCreatedAt = simulatedNow;
      const orderKey = getBusinessChartDateLabel(orderCreatedAt);
      expect(orderKey).toBe(lastKey); // Agrupado perfeitamente no último ponto!
    });
  });

  describe("5. Datas Civis (YYYY-MM-DD) sem Distorção de Horário", () => {
    it("preserva a data civil 2026-10-22 sem mudar para 2026-10-21 ou 2026-10-23", () => {
      const civilStr = "2026-10-22";
      const parts = parseCivilDate(civilStr);

      expect(parts).not.toBeNull();
      expect(parts!.year).toBe(2026);
      expect(parts!.month).toBe(10);
      expect(parts!.day).toBe(22);

      const formattedBR = formatCivilDateToBR(civilStr);
      expect(formattedBR).toBe("22/10/2026");
    });
  });

  describe("6. Limites de Mês Comercial em America/Recife", () => {
    it("calcula startOfMonth e startOfNextMonth alinhados à meia-noite de Recife", () => {
      const refDate = new Date("2026-10-23T01:30:00.000Z"); // 22/10 22:30 Recife
      const startOfMonth = getBusinessStartOfMonth(refDate);
      const startOfNextMonth = getBusinessStartOfNextMonth(refDate);

      // 01/10 00:00:00 BRT = 2026-10-01 03:00:00.000Z
      expect(startOfMonth.toISOString()).toBe("2026-10-01T03:00:00.000Z");
      // 01/11 00:00:00 BRT = 2026-11-01 03:00:00.000Z
      expect(startOfNextMonth.toISOString()).toBe("2026-11-01T03:00:00.000Z");

      // Verificação em horário local
      expect(formatBusinessDateTime(startOfMonth)).toBe("01/10/2026 00:00");
      expect(formatBusinessDateTime(startOfNextMonth)).toBe("01/11/2026 00:00");
    });
  });
});
