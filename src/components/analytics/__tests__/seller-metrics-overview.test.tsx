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

  it("1. Renderiza cabeçalho minimalista com apenas o título 'Vendas'", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-hero-test",
      approvedSales: { total: 3200, formatted: "R$ 3.200,00", count: 12, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 75, formatted: "75%", isTelemetryAvailable: true, totalVisits: 16, convertedOrders: 12, totalPixGerados: 16, totalPixPagos: 12, statusMessage: "12 pagos de 16 Pix" },
      botStarts: { totalStarts: 28, formatted: "28", isTelemetryAvailable: true, uniqueUsers: 24, statusMessage: "28 inícios" },
      averageTicket: { averageTicket: 266.67, formatted: "R$ 266,67", consideredSalesCount: 12, approvedPixCount: 12, generatedPixCount: 16, pixConversionRatePercent: 75 },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} periodLabel="Últimos 30 dias" />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    expect(normalizedHtml).toContain("Vendas");
    // Não deve conter hoje e ontem no cabeçalho
    expect(normalizedHtml).not.toContain("Vendas de hoje");
    expect(normalizedHtml).not.toContain("ontem");
  });

  it("2. Renderiza ícones em azul escuro (#2563EB) sem fundos, badges ou círculos ao redor", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-icons-test",
      approvedSales: { total: 1000, formatted: "R$ 1.000,00", count: 4, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 50, formatted: "50%", isTelemetryAvailable: true, totalVisits: 8, convertedOrders: 4, totalPixGerados: 8, totalPixPagos: 4, statusMessage: "" },
      botStarts: { totalStarts: 5, formatted: "5", isTelemetryAvailable: true, uniqueUsers: 5, statusMessage: "" },
      averageTicket: { averageTicket: 250, formatted: "R$ 250,00", consideredSalesCount: 4, approvedPixCount: 4, generatedPixCount: 8, pixConversionRatePercent: 50 },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    // Ícones em #2563EB
    expect(normalizedHtml).toContain("text-[#2563EB]");
    // Sem backgrounds circulares ao redor dos ícones
    expect(normalizedHtml).not.toContain("bg-blue-500/10");
  });

  it("3. Renderiza taxa de conversão formatada (incluindo decimais como 54,8%)", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-decimal-test",
      approvedSales: { total: 41, formatted: "R$ 41,00", count: 17, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 54.8, formatted: "54,8%", isTelemetryAvailable: true, totalVisits: 18, convertedOrders: 17, totalPixGerados: 31, totalPixPagos: 17, statusMessage: "" },
      botStarts: { totalStarts: 18, formatted: "18", isTelemetryAvailable: true, uniqueUsers: 18, statusMessage: "" },
      averageTicket: { averageTicket: 2.41, formatted: "R$ 2,41", consideredSalesCount: 17, approvedPixCount: 17, generatedPixCount: 31, pixConversionRatePercent: 54.8 },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const html = renderToStaticMarkup(<SellerMetricsOverview metrics={metrics} isPending={false} />);
    const normalizedHtml = html.replace(/\u00a0/g, " ");
    expect(normalizedHtml).toContain("54,8%");
    expect(normalizedHtml).toContain("17 de 31 pagamentos");
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
    // Card 1
    expect(normalizedHtml).toContain("Vendas aprovadas");
    expect(normalizedHtml).toContain("R$ 4.500,00");
    expect(normalizedHtml).toContain("15 vendas");
    expect(normalizedHtml).toContain("Dinheiro gerado pelas vendas aprovadas.");

    // Card 2
    expect(normalizedHtml).toContain("Valor médio por venda");
    expect(normalizedHtml).toContain("R$ 300,00");
    expect(normalizedHtml).toContain("Média de 15 vendas");
    expect(normalizedHtml).toContain("Quanto cada cliente gastou, em média.");

    // Card 3
    expect(normalizedHtml).toContain("Pagamentos confirmados");
    expect(normalizedHtml).toContain("60%");
    expect(normalizedHtml).toContain("15 de 25 pagamentos");
    expect(normalizedHtml).toContain("Percentual dos Pix gerados que foram pagos.");

    // Starts footer
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
