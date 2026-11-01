import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerMetricsOverview } from "../SellerMetricsOverview";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { getBusinessDateKey } from "@/lib/analytics/timezone-utils";

describe("SellerMetricsOverview Component Suite (Apple Design & HIG)", () => {
  const now = new Date();
  const todayKey = getBusinessDateKey(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getBusinessDateKey(yesterday);

  it("1. Renderiza hero 'Vendas de hoje' com valores corretos de hoje e ontem", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-hero-test",
      approvedSales: { total: 3200, formatted: "R$ 3.200,00", count: 12, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 75, formatted: "75%", isTelemetryAvailable: true, totalVisits: 16, convertedOrders: 12, totalPixGerados: 16, totalPixPagos: 12, statusMessage: "12 pagos de 16 Pix" },
      botStarts: { totalStarts: 28, formatted: "28", isTelemetryAvailable: true, uniqueUsers: 24, statusMessage: "28 inícios" },
      averageTicket: { averageTicket: 266.67, formatted: "R$ 266,67", consideredSalesCount: 12, approvedPixCount: 12, generatedPixCount: 16, pixConversionRatePercent: 75 },
      performanceSeries: [],
      last7DaysPerformance: [
        { dateStr: yesterdayKey, dateKey: yesterdayKey, dateLabel: "Ontem", dayName: "Ontem", revenue: 200, salesCount: 1, formattedRevenue: "R$ 200,00" },
        { dateStr: todayKey, dateKey: todayKey, dateLabel: "Hoje", dayName: "Hoje", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
      ],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} periodLabel="Últimos 30 dias" />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    expect(normalizedHtml).toContain("Vendas de hoje");
    expect(normalizedHtml).toContain("R$ 500,00");
    expect(normalizedHtml).toContain("Ontem:");
    expect(normalizedHtml).toContain("R$ 200,00");
    // Hoje (500) > Ontem (200) -> Pílula verde: ((500-200)/200)*100 = 150%
    expect(normalizedHtml).toContain("+150% vs ontem");
  });

  it("2. Não exibe pílula vermelha quando hoje for menor ou igual a ontem", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-hero-lower",
      approvedSales: { total: 1000, formatted: "R$ 1.000,00", count: 4, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 50, formatted: "50%", isTelemetryAvailable: true, totalVisits: 8, convertedOrders: 4, totalPixGerados: 8, totalPixPagos: 4, statusMessage: "" },
      botStarts: { totalStarts: 5, formatted: "5", isTelemetryAvailable: true, uniqueUsers: 5, statusMessage: "" },
      averageTicket: { averageTicket: 250, formatted: "R$ 250,00", consideredSalesCount: 4, approvedPixCount: 4, generatedPixCount: 8, pixConversionRatePercent: 50 },
      performanceSeries: [],
      last7DaysPerformance: [
        { dateStr: yesterdayKey, dateKey: yesterdayKey, dateLabel: "Ontem", dayName: "Ontem", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
        { dateStr: todayKey, dateKey: todayKey, dateLabel: "Hoje", dayName: "Hoje", revenue: 100, salesCount: 1, formattedRevenue: "R$ 100,00" },
      ],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    expect(normalizedHtml).toContain("Vendas de hoje");
    expect(normalizedHtml).toContain("R$ 100,00");
    expect(normalizedHtml).toContain("Ontem:");
    expect(normalizedHtml).toContain("R$ 500,00");
    // NUNCA deve conter porcentagem de queda nem cor vermelha
    expect(normalizedHtml).not.toContain("% vs ontem");
    expect(normalizedHtml).not.toContain("text-rose");
    expect(normalizedHtml).not.toContain("bg-rose");
  });

  it("3. Exibe teto de '+999%+' quando o crescimento for superior a 999%", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-hero-max",
      approvedSales: { total: 15000, formatted: "R$ 15.000,00", count: 10, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 100, formatted: "100%", isTelemetryAvailable: true, totalVisits: 10, convertedOrders: 10, totalPixGerados: 10, totalPixPagos: 10, statusMessage: "" },
      botStarts: { totalStarts: 10, formatted: "10", isTelemetryAvailable: true, uniqueUsers: 10, statusMessage: "" },
      averageTicket: { averageTicket: 1500, formatted: "R$ 1.500,00", consideredSalesCount: 10, approvedPixCount: 10, generatedPixCount: 10, pixConversionRatePercent: 100 },
      performanceSeries: [],
      last7DaysPerformance: [
        { dateStr: yesterdayKey, dateKey: yesterdayKey, dateLabel: "Ontem", dayName: "Ontem", revenue: 10, salesCount: 1, formattedRevenue: "R$ 10,00" },
        { dateStr: todayKey, dateKey: todayKey, dateLabel: "Hoje", dayName: "Hoje", revenue: 2000, salesCount: 2, formattedRevenue: "R$ 2.000,00" },
      ],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    // ((2000 - 10) / 10) * 100 = 19900% -> deve limitar a +999%+
    expect(html).toContain("+999%+ vs ontem");
  });

  it("4. Renderiza os 3 indicadores com as legendas exatas e linha de starts", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-3-indicators",
      approvedSales: { total: 4500, formatted: "R$ 4.500,00", count: 15, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 60, formatted: "60%", isTelemetryAvailable: true, totalVisits: 25, convertedOrders: 15, totalPixGerados: 25, totalPixPagos: 15, statusMessage: "" },
      botStarts: { totalStarts: 32, formatted: "32", isTelemetryAvailable: true, uniqueUsers: 32, statusMessage: "" },
      averageTicket: { averageTicket: 300, formatted: "R$ 300,00", consideredSalesCount: 15, approvedPixCount: 15, generatedPixCount: 25, pixConversionRatePercent: 60 },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    expect(normalizedHtml).toContain("Receita aprovada");
    expect(normalizedHtml).toContain("15 vendas confirmadas");
    expect(normalizedHtml).toContain("Pagamentos concluídos");
    expect(normalizedHtml).toContain("De 25 Pix gerados, 15 foram pagos");
    expect(normalizedHtml).toContain("Valor médio por venda");
    expect(normalizedHtml).toContain("R$ 300,00");
    expect(normalizedHtml).toContain("pessoas iniciaram conversa no período");
    expect(normalizedHtml).toContain(">32<");
  });

  it("5. Renderiza acessibilidade com role='img' no container do gráfico", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-a11y",
      approvedSales: { total: 0, formatted: "R$ 0,00", count: 0, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: null, formatted: "—", isTelemetryAvailable: false, totalVisits: 0, convertedOrders: 0, totalPixGerados: 0, totalPixPagos: 0, statusMessage: "" },
      botStarts: { totalStarts: 0, formatted: "0", isTelemetryAvailable: false, uniqueUsers: 0, statusMessage: "" },
      averageTicket: { averageTicket: 0, formatted: "R$ 0,00", consideredSalesCount: 0, approvedPixCount: 0, generatedPixCount: 0, pixConversionRatePercent: null },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label=');
  });

  it("6. Suporta skeleton loading suave sem crash", () => {
    const html = renderToStaticMarkup(<SellerMetricsOverview isPending={true} />);
    expect(html).toContain("animate-pulse");
  });
});
