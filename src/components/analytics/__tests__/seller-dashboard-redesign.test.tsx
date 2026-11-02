import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerKpiCards } from "../SellerKpiCards";
import { SellerRevenueBarChart } from "../SellerRevenueBarChart";
import { SellerConversionFunnel } from "../SellerConversionFunnel";
import { SellerNetRevenueCard } from "../SellerNetRevenueCard";
import { SellerTopProductsCard } from "../SellerTopProductsCard";
import { SellerTopBotsCard } from "../SellerTopBotsCard";
import { SellerRealtimeActivity } from "../SellerRealtimeActivity";

describe("Seller Dashboard Redesign Suite (Frontend Design & Apple HIG)", () => {
  const mockKpis = {
    revenue: {
      value: 12500.5,
      formatted: "R$ 12.500,50",
      changePercent: 18,
      trend: "up" as const,
      subtitle: "vs período anterior",
    },
    salesCount: {
      value: 85,
      formatted: "85",
      changePercent: 12,
      trend: "up" as const,
      subtitle: "vs período anterior",
    },
    customersCount: {
      value: 74,
      formatted: "74",
      changePercent: -5,
      trend: "down" as const,
      subtitle: "vs período anterior",
    },
    averageTicket: {
      value: 147.06,
      formatted: "R$ 147,06",
      changePercent: 5,
      trend: "up" as const,
      subtitle: "vs período anterior",
    },
  };

  const mockChartSeries = [
    { dateLabel: "01/11", fullDate: "01 de novembro", dayName: "Sexta", formattedRevenue: "R$ 1.500,00", revenue: 1500, salesCount: 10 },
    { dateLabel: "02/11", fullDate: "02 de novembro", dayName: "Sábado", formattedRevenue: "R$ 2.500,00", revenue: 2500, salesCount: 15 },
    { dateLabel: "03/11", fullDate: "03 de novembro", dayName: "Domingo", formattedRevenue: "R$ 4.000,00", revenue: 4000, salesCount: 25 },
  ];

  const mockCommercialMetrics = {
    period: "30D",
    storeId: "store-123",
    approvedSales: {
      total: 12500.5,
      formatted: "R$ 12.500,50",
      count: 85,
      targetGoal: null,
      targetProgressPercent: null,
      hasTargetGoal: false,
    },
    conversionRate: {
      ratePercent: 68,
      formatted: "68%",
      isTelemetryAvailable: true,
      totalVisits: 250,
      convertedOrders: 85,
      totalPixGerados: 125,
      totalPixPagos: 85,
      statusMessage: "Excelente conversão",
    },
    botStarts: {
      totalStarts: 350,
      formatted: "350",
      isTelemetryAvailable: true,
      uniqueUsers: 310,
      statusMessage: "Ativo",
    },
    averageTicket: {
      averageTicket: 147.06,
      formatted: "R$ 147,06",
      consideredSalesCount: 85,
      approvedPixCount: 85,
      generatedPixCount: 125,
      pixConversionRatePercent: 68,
    },
    performanceSeries: mockChartSeries,
    last7DaysPerformance: mockChartSeries,
  };

  it("1. KPI Cards: renderiza os 4 cards com tabular-nums, tooltips '?' e badges de variação", () => {
    const html = renderToStaticMarkup(
      <SellerKpiCards
        kpis={mockKpis}
        commercialMetrics={mockCommercialMetrics}
        chartSeries={mockChartSeries}
      />
    ).replace(/\u00a0/g, " ");

    expect(html).toContain("Receita bruta");
    expect(html).toContain("R$ 12.500,50");
    expect(html).toContain("+18%");

    expect(html).toContain("Vendas aprovadas");
    expect(html).toContain("85");
    expect(html).toContain("+12%");

    expect(html).toContain("Ticket médio");
    expect(html).toContain("R$ 147,06");

    expect(html).toContain("Conversão Pix");
    expect(html).toContain("68%");
    // Tooltip trigger
    expect(html).toContain("?");
  });

  it("2. Gráfico de Barras: renderiza cabeçalho, total e empty state quando zerado", () => {
    // Com vendas
    const htmlComVendas = renderToStaticMarkup(
      <SellerRevenueBarChart chartSeries={mockChartSeries} periodLabel="Últimos 30 dias" />
    ).replace(/\u00a0/g, " ");
    expect(htmlComVendas).toContain("Evolução da receita");
    expect(htmlComVendas).toContain("R$ 8.000,00");

    // Sem vendas: exibe empty state amigável
    const htmlSemVendas = renderToStaticMarkup(
      <SellerRevenueBarChart chartSeries={[]} periodLabel="Últimos 30 dias" />
    );
    expect(htmlSemVendas).toContain("Sem vendas no período");
  });

  it("3. Funil de Conversão: renderiza as 3 etapas (Conversas, Pix gerados, Pagos) com percentuais", () => {
    const html = renderToStaticMarkup(
      <SellerConversionFunnel metrics={mockCommercialMetrics} />
    );

    expect(html).toContain("Funil de conversão");
    expect(html).toContain("1. Conversas iniciadas");
    expect(html).toContain("2. Pix gerados no checkout");
    expect(html).toContain("3. Pagamentos confirmados");
    expect(html).toContain("85 vendas pagas");
    expect(html).toContain("27% conv. global"); // 85 / 310 * 100 = 27%
  });

  it("4. Receita Líquida vs. Bruta: calcula e exibe split de R$ 0,50 por venda aprovada", () => {
    const html = renderToStaticMarkup(
      <SellerNetRevenueCard
        financialSummary={{
          grossRevenue: 1000,
          grossFormatted: "R$ 1.000,00",
          platformFeeTotal: 10,
          platformFeeFormatted: "R$ 10,00",
          netRevenue: 990,
          netFormatted: "R$ 990,00",
          netMarginPercent: 99,
          paidOrdersCount: 20,
        }}
      />
    ).replace(/\u00a0/g, " ");

    expect(html).toContain("Receita líquida vs. bruta");
    expect(html).toContain("R$ 990,00");
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("- R$ 10,00");
    expect(html).toContain("99%");
  });

  it("5. Top Produtos: renderiza lista de ranking e empty state", () => {
    const products = [
      {
        id: "prod-1",
        title: "Pack VIP de Conteúdo",
        coverUrl: "https://images.unsplash.com/photo-1.jpg",
        salesCount: 42,
        revenue: 4200,
        percentage: 60,
      },
      {
        id: "prod-2",
        title: "Acesso Vitalício",
        coverUrl: null,
        salesCount: 18,
        revenue: 2800,
        percentage: 40,
      },
    ];

    const htmlComProdutos = renderToStaticMarkup(
      <SellerTopProductsCard topProducts={products} />
    ).replace(/\u00a0/g, " ");
    expect(htmlComProdutos).toContain("Top produtos");
    expect(htmlComProdutos).toContain("Pack VIP de Conteúdo");
    expect(htmlComProdutos).toContain("42 vendas");
    expect(htmlComProdutos).toContain("R$ 4.200,00");

    // Empty state
    const htmlSemProdutos = renderToStaticMarkup(
      <SellerTopProductsCard topProducts={[]} />
    );
    expect(htmlSemProdutos).toContain("Nenhum produto vendido");
  });

  it("6. Top Bots: renderiza ranking de canais do Telegram e empty state", () => {
    const channels = [
      {
        channel: "bot-alpha",
        label: "VIP Bot Principal",
        revenue: 7500,
        salesCount: 50,
        percentage: 75,
        photoUrl: null,
        username: "@vip_alpha_bot",
        conversionRate: 15.4,
      },
    ];

    const htmlComBots = renderToStaticMarkup(
      <SellerTopBotsCard channels={channels} />
    ).replace(/\u00a0/g, " ");
    expect(htmlComBots).toContain("Top bots");
    expect(htmlComBots).toContain("VIP Bot Principal");
    expect(htmlComBots).toContain("R$ 7.500,00");
    expect(htmlComBots).toContain("15.4% conv.");

    // Empty state
    const htmlSemBots = renderToStaticMarkup(
      <SellerTopBotsCard channels={[]} />
    );
    expect(htmlSemBots).toContain("Nenhum bot conectado");
  });

  it("7. Atividades em Tempo Real: exibe badges de eventos (Venda, Lead, Pix)", () => {
    const activityLog = [
      {
        id: "act-1",
        type: "sale_approved" as const,
        title: "Venda aprovada",
        targetName: "Pack VIP",
        description: "Pagou R$ 97,00",
        timestamp: new Date().toISOString(),
        dateFormatted: "02/11/2026",
        timeFormatted: "11:20",
        botName: "VIP Bot",
      },
      {
        id: "act-2",
        type: "lead" as const,
        title: "Novo lead",
        targetName: "Lucas S.",
        description: "Iniciou conversa",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        dateFormatted: "02/11/2026",
        timeFormatted: "11:15",
        botName: "VIP Bot",
      },
    ];

    const htmlComLog = renderToStaticMarkup(
      <SellerRealtimeActivity activityLog={activityLog} />
    );
    expect(htmlComLog).toContain("Atividades em tempo real");
    expect(htmlComLog).toContain("Pack VIP");
    expect(htmlComLog).toContain("Pagou R$ 97,00");
    expect(htmlComLog).toContain("Lucas S.");
    expect(htmlComLog).toContain("Iniciou conversa");

    // Empty state
    const htmlSemLog = renderToStaticMarkup(
      <SellerRealtimeActivity activityLog={[]} />
    );
    expect(htmlSemLog).toContain("Nenhuma atividade registrada");
  });
});
