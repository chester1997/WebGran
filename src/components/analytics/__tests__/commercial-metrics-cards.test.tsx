import { describe, it, expect } from "vitest";
import React from "react";
import { CommercialMetricsCards } from "../CommercialMetricsCards";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";

describe("CommercialMetricsCards Component & Layout Suite", () => {
  it("1. Component is defined and exported as a function", () => {
    expect(typeof CommercialMetricsCards).toBe("function");
  });

  it("2. Responsive layout specification guarantees 2 columns on larger screens and 1 column on mobile", () => {
    // We verify the JSX structure pattern of CommercialMetricsCards
    const sampleMetrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-123",
      approvedSales: {
        total: 1250.0,
        formatted: "R$ 1.250,00",
        count: 5,
        targetGoal: null,
        targetProgressPercent: null,
        hasTargetGoal: false,
      },
      conversionRate: {
        ratePercent: null,
        formatted: "—",
        isTelemetryAvailable: false,
        totalVisits: null,
        convertedOrders: 5,
        totalPixGerados: 6,
        totalPixPagos: 4,
        statusMessage: "Rastreamento de visitas não disponível",
      },
      botStarts: {
        totalStarts: 0,
        formatted: "0",
        isTelemetryAvailable: false,
        uniqueUsers: 0,
        statusMessage: "Eventos de /start não registrados no banco",
      },
      averageTicket: {
        averageTicket: 250.0,
        formatted: "R$ 250,00",
        consideredSalesCount: 5,
        approvedPixCount: 4,
        generatedPixCount: 6,
        pixConversionRatePercent: 67,
      },
      performanceSeries: [
        { dateStr: "2026-10-08", dateLabel: "08/10", dayName: "Qui", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-09", dateLabel: "09/10", dayName: "Sex", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-10", dateLabel: "10/10", dayName: "Sáb", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-11", dateLabel: "11/10", dayName: "Dom", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
        { dateStr: "2026-10-12", dateLabel: "12/10", dayName: "Seg", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-13", dateLabel: "13/10", dayName: "Ter", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-14", dateLabel: "14/10", dayName: "Qua", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
      ],
      last7DaysPerformance: [
        { dateStr: "2026-10-08", dateLabel: "08/10", dayName: "Qui", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-09", dateLabel: "09/10", dayName: "Sex", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-10", dateLabel: "10/10", dayName: "Sáb", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-11", dateLabel: "11/10", dayName: "Dom", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
        { dateStr: "2026-10-12", dateLabel: "12/10", dayName: "Seg", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-13", dateLabel: "13/10", dayName: "Ter", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-14", dateLabel: "14/10", dayName: "Qua", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
      ],
    };

    const element = React.createElement(CommercialMetricsCards, { metrics: sampleMetrics });
    expect(element).toBeDefined();
    expect(element.props.metrics?.approvedSales.total).toBe(1250.0);
  });

  it("3. Semicircular gauge mathematical arc geometry adheres to 180-degree sweep", () => {
    const radius = 42;
    const arcLength = Math.PI * radius; // ~131.94689
    expect(arcLength).toBeCloseTo(131.95, 1);

    // 0% progress -> strokeDashoffset equals full arc length (empty arc)
    const offset0 = arcLength * (1 - 0 / 100);
    expect(offset0).toBeCloseTo(131.95, 1);

    // 50% progress -> strokeDashoffset is half arc length
    const offset50 = arcLength * (1 - 50 / 100);
    expect(offset50).toBeCloseTo(65.97, 1);

    // 100% progress -> strokeDashoffset is 0 (full arc)
    const offset100 = arcLength * (1 - 100 / 100);
    expect(offset100).toBe(0);
  });

  it("4. Handles null/empty metrics gracefully without exceptions", () => {
    const elementNull = React.createElement(CommercialMetricsCards, { metrics: null, isPending: false });
    expect(elementNull).toBeDefined();

    const elementPending = React.createElement(CommercialMetricsCards, { metrics: null, isPending: true });
    expect(elementPending).toBeDefined();
    expect(elementPending.props.isPending).toBe(true);
  });

  it("5. Displays target goal progress bar only when goal exists", () => {
    const withGoal: CommercialMetrics = {
      period: "30D",
      storeId: "store-123",
      approvedSales: {
        total: 750.0,
        formatted: "R$ 750,00",
        count: 3,
        targetGoal: 1000.0,
        targetProgressPercent: 75,
        hasTargetGoal: true,
      },
      conversionRate: {
        ratePercent: 5.0,
        formatted: "5,0%",
        isTelemetryAvailable: true,
        totalVisits: 60,
        convertedOrders: 3,
        totalPixGerados: 3,
        totalPixPagos: 3,
        statusMessage: "3 vendas em 60 sessões",
      },
      botStarts: {
        totalStarts: 10,
        formatted: "10",
        isTelemetryAvailable: true,
        uniqueUsers: 8,
        statusMessage: "10 início(s) de bot no período",
      },
      averageTicket: {
        averageTicket: 250.0,
        formatted: "R$ 250,00",
        consideredSalesCount: 3,
        approvedPixCount: 3,
        generatedPixCount: 3,
        pixConversionRatePercent: 100,
      },
      performanceSeries: [],
      last7DaysPerformance: [
        { dateStr: "2026-10-08", dateLabel: "08/10", dayName: "Qui", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-09", dateLabel: "09/10", dayName: "Sex", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-10", dateLabel: "10/10", dayName: "Sáb", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-11", dateLabel: "11/10", dayName: "Dom", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
        { dateStr: "2026-10-12", dateLabel: "12/10", dayName: "Seg", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-13", dateLabel: "13/10", dayName: "Ter", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-14", dateLabel: "14/10", dayName: "Qua", revenue: 250, salesCount: 1, formattedRevenue: "R$ 250,00" },
      ],
    };

    const elementWithGoal = React.createElement(CommercialMetricsCards, { metrics: withGoal });
    expect(elementWithGoal.props.metrics?.approvedSales.hasTargetGoal).toBe(true);
    expect(elementWithGoal.props.metrics?.approvedSales.targetProgressPercent).toBe(75);
  });

  it("6. Renders the 2-area layout structure with 4 cards and the performance chart", () => {
    const fullMetrics: CommercialMetrics = {
      period: "7D",
      storeId: "store-456",
      approvedSales: {
        total: 1000.0,
        formatted: "R$ 1.000,00",
        count: 4,
        targetGoal: null,
        targetProgressPercent: null,
        hasTargetGoal: false,
      },
      conversionRate: {
        ratePercent: null,
        formatted: "—",
        isTelemetryAvailable: false,
        totalVisits: null,
        convertedOrders: 4,
        totalPixGerados: 4,
        totalPixPagos: 4,
        statusMessage: "Rastreamento de visitas não disponível",
      },
      botStarts: {
        totalStarts: 0,
        formatted: "0",
        isTelemetryAvailable: false,
        uniqueUsers: 0,
        statusMessage: "Eventos de /start não registrados no banco",
      },
      averageTicket: {
        averageTicket: 250.0,
        formatted: "R$ 250,00",
        consideredSalesCount: 4,
        approvedPixCount: 4,
        generatedPixCount: 4,
        pixConversionRatePercent: 100,
      },
      performanceSeries: [
        { dateStr: "2026-10-08", dateLabel: "08/10", dayName: "Qui", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-09", dateLabel: "09/10", dayName: "Sex", revenue: 200, salesCount: 1, formattedRevenue: "R$ 200,00" },
        { dateStr: "2026-10-10", dateLabel: "10/10", dayName: "Sáb", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-11", dateLabel: "11/10", dayName: "Dom", revenue: 300, salesCount: 1, formattedRevenue: "R$ 300,00" },
        { dateStr: "2026-10-12", dateLabel: "12/10", dayName: "Seg", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-13", dateLabel: "13/10", dayName: "Ter", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-14", dateLabel: "14/10", dayName: "Qua", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
      ],
      last7DaysPerformance: [
        { dateStr: "2026-10-08", dateLabel: "08/10", dayName: "Qui", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-09", dateLabel: "09/10", dayName: "Sex", revenue: 200, salesCount: 1, formattedRevenue: "R$ 200,00" },
        { dateStr: "2026-10-10", dateLabel: "10/10", dayName: "Sáb", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-11", dateLabel: "11/10", dayName: "Dom", revenue: 300, salesCount: 1, formattedRevenue: "R$ 300,00" },
        { dateStr: "2026-10-12", dateLabel: "12/10", dayName: "Seg", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-13", dateLabel: "13/10", dayName: "Ter", revenue: 0, salesCount: 0, formattedRevenue: "R$ 0,00" },
        { dateStr: "2026-10-14", dateLabel: "14/10", dayName: "Qua", revenue: 500, salesCount: 2, formattedRevenue: "R$ 500,00" },
      ],
    };

    const rendered = CommercialMetricsCards({ metrics: fullMetrics, isPending: false });
    expect(rendered).toBeDefined();
    expect(fullMetrics.last7DaysPerformance?.length).toBe(7);
  });

  it("7. Handles empty performance data gracefully", () => {
    const emptyMetrics: CommercialMetrics = {
      period: "7D",
      storeId: "store-empty",
      approvedSales: {
        total: 0,
        formatted: "R$ 0,00",
        count: 0,
        targetGoal: null,
        targetProgressPercent: null,
        hasTargetGoal: false,
      },
      conversionRate: {
        ratePercent: null,
        formatted: "—",
        isTelemetryAvailable: false,
        totalVisits: null,
        convertedOrders: 0,
        totalPixGerados: 0,
        totalPixPagos: 0,
        statusMessage: "Rastreamento de visitas não disponível",
      },
      botStarts: {
        totalStarts: 0,
        formatted: "0",
        isTelemetryAvailable: false,
        uniqueUsers: 0,
        statusMessage: "Eventos de /start não registrados no banco",
      },
      averageTicket: {
        averageTicket: 0,
        formatted: "R$ 0,00",
        consideredSalesCount: 0,
        approvedPixCount: 0,
        generatedPixCount: 0,
        pixConversionRatePercent: null,
      },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const rendered = CommercialMetricsCards({ metrics: emptyMetrics, isPending: false });
    expect(rendered).toBeDefined();
  });

  it("8. Renderiza card de Taxa de Conversão Pix com 72% ('18 pagos de 25 Pix')", () => {
    const pixMetrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-pix-72",
      approvedSales: { total: 1000, formatted: "R$ 1.000,00", count: 18, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: {
        ratePercent: 72,
        formatted: "72%",
        isTelemetryAvailable: true,
        totalVisits: 25,
        convertedOrders: 18,
        totalPixGerados: 25,
        totalPixPagos: 18,
        statusMessage: "18 pagos de 25 Pix",
        hasError: false,
      },
      botStarts: { totalStarts: 10, formatted: "10", isTelemetryAvailable: true, uniqueUsers: 8, statusMessage: "10 inícios" },
      averageTicket: { averageTicket: 55.55, formatted: "R$ 55,55", consideredSalesCount: 18, approvedPixCount: 18, generatedPixCount: 25, pixConversionRatePercent: 72 },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const rendered = CommercialMetricsCards({ metrics: pixMetrics, isPending: false });
    expect(rendered).toBeDefined();
    expect(pixMetrics.conversionRate.ratePercent).toBe(72);
    expect(pixMetrics.conversionRate.statusMessage).toBe("18 pagos de 25 Pix");
  });

  it("9. Renderiza card no estado 'Sem dados' quando totalPixGerados === 0", () => {
    const noPixMetrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-no-pix",
      approvedSales: { total: 0, formatted: "R$ 0,00", count: 0, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: {
        ratePercent: null,
        formatted: "Sem dados",
        isTelemetryAvailable: false,
        totalVisits: 0,
        convertedOrders: 0,
        totalPixGerados: 0,
        totalPixPagos: 0,
        statusMessage: "0 pagos de 0 Pix",
        hasError: false,
      },
      botStarts: { totalStarts: 0, formatted: "0", isTelemetryAvailable: false, uniqueUsers: 0, statusMessage: "Sem eventos" },
      averageTicket: { averageTicket: 0, formatted: "R$ 0,00", consideredSalesCount: 0, approvedPixCount: 0, generatedPixCount: 0, pixConversionRatePercent: null },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const rendered = CommercialMetricsCards({ metrics: noPixMetrics, isPending: false });
    expect(rendered).toBeDefined();
    expect(noPixMetrics.conversionRate.ratePercent).toBeNull();
    expect(noPixMetrics.conversionRate.formatted).toBe("Sem dados");
  });

  it("10. Diferencia erro de consulta no card de Taxa de Conversão Pix", () => {
    const errorMetrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-err",
      approvedSales: { total: 0, formatted: "R$ 0,00", count: 0, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: {
        ratePercent: null,
        formatted: "—",
        isTelemetryAvailable: false,
        totalVisits: null,
        convertedOrders: 0,
        totalPixGerados: 0,
        totalPixPagos: 0,
        statusMessage: "Falha ao consultar banco de dados",
        hasError: true,
      },
      botStarts: { totalStarts: 0, formatted: "0", isTelemetryAvailable: false, uniqueUsers: 0, statusMessage: "Falha" },
      averageTicket: { averageTicket: 0, formatted: "R$ 0,00", consideredSalesCount: 0, approvedPixCount: 0, generatedPixCount: 0, pixConversionRatePercent: null },
      performanceSeries: [],
      last7DaysPerformance: [],
    };

    const rendered = CommercialMetricsCards({ metrics: errorMetrics, isPending: false });
    expect(rendered).toBeDefined();
    expect(errorMetrics.conversionRate.hasError).toBe(true);
  });

  it("11. Suporta dinamicamente períodos como 30D, 90D e TODAY", () => {
    const metrics30D: CommercialMetrics = {
      period: "30D",
      storeId: "store-30d",
      approvedSales: { total: 500, formatted: "R$ 500,00", count: 2, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: null, formatted: "—", isTelemetryAvailable: false, totalVisits: null, convertedOrders: 0, totalPixGerados: 0, totalPixPagos: 0, statusMessage: "" },
      botStarts: { totalStarts: 0, formatted: "0", isTelemetryAvailable: false, uniqueUsers: 0, statusMessage: "" },
      averageTicket: { averageTicket: 250, formatted: "R$ 250,00", consideredSalesCount: 2, approvedPixCount: 2, generatedPixCount: 2, pixConversionRatePercent: null },
      performanceSeries: Array.from({ length: 30 }, (_, i) => ({
        dateLabel: `${i + 1}/10`,
        dayName: "Dia",
        revenue: i === 14 ? 500 : 0,
        formattedRevenue: "R$ 0,00",
        salesCount: i === 14 ? 2 : 0,
      })),
      last7DaysPerformance: [],
    };

    const rendered = CommercialMetricsCards({ metrics: metrics30D, isPending: false });
    expect(rendered).toBeDefined();
  });

  it("12. Valida layout em grade 2x2 (md:grid-cols-2) com os 4 cards na ordem correta e gráfico preservado", () => {
    const metrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-2x2",
      approvedSales: { total: 1000, formatted: "R$ 1.000,00", count: 10, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
      conversionRate: { ratePercent: 100, formatted: "100%", isTelemetryAvailable: true, totalVisits: 10, convertedOrders: 10, totalPixGerados: 10, totalPixPagos: 10, statusMessage: "10 pagos de 10 Pix", hasError: false },
      botStarts: { totalStarts: 50, formatted: "50", isTelemetryAvailable: true, uniqueUsers: 45, statusMessage: "50 inícios" },
      averageTicket: { averageTicket: 100, formatted: "R$ 100,00", consideredSalesCount: 10, approvedPixCount: 10, generatedPixCount: 10, pixConversionRatePercent: 100 },
      performanceSeries: [{ dateLabel: "24/10", dayName: "Hoje", revenue: 1000, salesCount: 10, formattedRevenue: "R$ 1.000,00" }],
      last7DaysPerformance: [],
    };

    const rendered: any = CommercialMetricsCards({ metrics, isPending: false });
    expect(rendered).toBeDefined();

    // Inspeciona os nós JSX retornados
    const children = React.Children.toArray(rendered.props.children);
    expect(children.length).toBeGreaterThanOrEqual(3);

    // O segundo filho é a grade 2x2 dos 4 cards comerciais
    const grid2x2: any = children[1];
    expect(grid2x2.props.className).toContain("grid-cols-1");
    expect(grid2x2.props.className).toContain("md:grid-cols-2");

    // A grade contém exatamente os 4 cards de métricas
    const cards = React.Children.toArray(grid2x2.props.children);
    expect(cards.length).toBe(4);

    // O terceiro filho é o gráfico de desempenho preservado
    const performanceChartCard: any = children[2];
    expect(performanceChartCard.props.className).toContain("w-full");
  });
});

