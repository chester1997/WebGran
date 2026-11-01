import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => {
  const dbMock = {
    select: vi.fn(),
  };
  return { db: dbMock };
});

import { db } from "@/db";
import { AdminReportsService } from "../admin-reports-service";
import {
  BUSINESS_TIMEZONE,
  getBusinessDateKey,
  getBusinessDateLabel,
  getBusinessStartOfDay,
} from "@/lib/analytics/timezone-utils";

describe("AdminReportsService — Evolução ao Longo do Tempo (Fuso America/Recife & Série Contínua)", () => {
  it("resolve 7d como janela contínua de exatamente 7 dias civis terminando em hoje", () => {
    const { start, end } = AdminReportsService.resolveDateRange("7d");
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    // start é 6 dias antes de hoje (às 00:00 America/Recife), mais a fração do dia de hoje = ~6-7 dias
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);

    // O início deve coincidir com 03:00:00Z em UTC (meia-noite de Recife)
    expect(start.getUTCHours()).toBe(3);
  });

  it("resolve 30d como janela contínua de exatamente 30 dias civis terminando em hoje", () => {
    const { start, end } = AdminReportsService.resolveDateRange("30d");
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(30);
    expect(start.getUTCHours()).toBe(3);
  });

  it("resolve 90d com suporte a períodos trimestrais", () => {
    const { start, end } = AdminReportsService.resolveDateRange("90d");
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(90);
  });

  it("resolve mês atual começando no dia 1 às 03:00Z (00:00 America/Recife)", () => {
    const { start } = AdminReportsService.resolveDateRange("month");
    expect(start.getUTCHours()).toBe(3);
    expect(start.getUTCDate()).toBe(1);
  });

  it("garante série contínua sem buracos preenchendo dias vazios com 0", async () => {
    let callIndex = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callIndex++;
      const currentCall = callIndex;
      return {
        from: vi.fn(() => ({
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => {
            if (currentCall === 1) return Promise.resolve([{ count: 5 }]);
            if (currentCall === 2) {
              return Promise.resolve([
                { totalOrders: 10, approvedSales: 8, gmv: "1000", totalFees: "50", uniqueCustomers: 7 },
              ]);
            }
            if (currentCall === 3) {
              return {
                groupBy: vi.fn(() =>
                  Promise.resolve([{ gateway: "mercadopago", count: 8, gmv: "1000", fee: "50" }])
                ),
              };
            }
            if (currentCall === 4) {
              const todayKey = getBusinessDateKey(new Date());
              return {
                groupBy: vi.fn(() => ({
                  orderBy: vi.fn(() =>
                    Promise.resolve([
                      { timeBucket: todayKey, salesCount: 3, gmv: "300", platformFee: "15" },
                    ])
                  ),
                })),
              };
            }
            if (currentCall === 5) return Promise.resolve([{ count: 8 }]);
            if (currentCall === 6) {
              return {
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn(() => Promise.resolve([])),
                  })),
                })),
              };
            }
            return {
              orderBy: vi.fn(() => Promise.resolve([])),
            };
          }),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      } as any;
    });

    const report = await AdminReportsService.getReportData({ period: "7d" });

    // Em 7d devem haver exatamente 7 pontos contínuos
    expect(report.timeSeries.length).toBe(7);

    // O último ponto é hoje com 3 vendas e 300 de GMV
    const lastPoint = report.timeSeries[report.timeSeries.length - 1];
    expect(lastPoint.salesCount).toBe(3);
    expect(lastPoint.gmv).toBe(300);
    expect(lastPoint.platformFee).toBe(15);
    expect(lastPoint.fullDate).toBeDefined();

    // Os dias anteriores sem vendas devem estar zerados (sem sumir da série)
    const emptyDays = report.timeSeries.slice(0, 6);
    expect(emptyDays.length).toBe(6);
    for (const day of emptyDays) {
      expect(day.salesCount).toBe(0);
      expect(day.gmv).toBe(0);
      expect(day.platformFee).toBe(0);
      expect(day.fullDate).toBeDefined();
    }
  });
});
