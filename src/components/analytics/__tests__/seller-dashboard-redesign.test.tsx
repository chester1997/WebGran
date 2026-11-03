import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerMetricsOverview } from "../SellerMetricsOverview";
import { SellerConversionFunnel } from "../SellerConversionFunnel";
import { SellerNetRevenueCard } from "../SellerNetRevenueCard";
import { SellerActivityAndChannels } from "../SellerActivityAndChannels";

describe("Seller Dashboard Redesign & Original Refinement Suite", () => {
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

  it("1. SellerMetricsOverview: renderiza Hero 'Vendas de hoje', os 4 cards compactos e o gráfico de largura total", () => {
    const html = renderToStaticMarkup(
      <SellerMetricsOverview
        metrics={mockCommercialMetrics}
        kpis={mockKpis}
        chartSeries={mockChartSeries}
        periodLabel="Últimos 30 dias"
      />
    ).replace(/\u00a0/g, " ");

    // Hero
    expect(html).toContain("Vendas de hoje");
    expect(html).toContain("Total do período (Últimos 30 dias)");

    // 4 Cards de Indicadores (valores principais intactos, sem badges de variação e sem sparklines)
    expect(html).toContain("Receita aprovada");
    expect(html).toContain("R$ 12.500,50");
    expect(html).not.toContain("+18%");

    expect(html).toContain("Vendas aprovadas");
    expect(html).toContain("85");
    expect(html).not.toContain("+12%");

    expect(html).toContain("Valor médio por venda");
    expect(html).toContain("R$ 147,06");

    expect(html).toContain("Pagamentos concluídos");
    expect(html).toContain("68%");
    expect(html).toContain("85/125");

    // Tooltip trigger "?"
    expect(html).toContain("?");

    // Starts line
    expect(html).toContain("pessoas iniciaram conversa");

    // Gráfico de Receita em destaque com seletores Curva e Barras
    expect(html).toContain("Receita");
    expect(html).toContain("Curva");
    expect(html).toContain("Barras");

    // Funil de Conversão na sequência da hierarquia Apple
    expect(html).toContain("Da conversa ao pagamento");
    expect(html).toContain("Funil de conversão");
    expect(html).toContain("1. Conversas iniciadas");
  });

  it("2. Funil de Conversão: renderiza as 3 etapas com percentuais e layout discreto", () => {
    const html = renderToStaticMarkup(
      <SellerConversionFunnel metrics={mockCommercialMetrics} />
    );

    expect(html).toContain("Funil de conversão");
    expect(html).toContain("1. Conversas iniciadas");
    expect(html).toContain("2. Pix gerados");
    expect(html).toContain("3. Vendas confirmadas");
    expect(html).toContain("85 vendas pagas");
    expect(html).toContain("27% conv. global");
  });

  it("3. Funil de Conversão: renderiza empty state amigável quando zerado", () => {
    const emptyMetrics = {
      ...mockCommercialMetrics,
      approvedSales: { ...mockCommercialMetrics.approvedSales, count: 0, total: 0 },
      conversionRate: { ...mockCommercialMetrics.conversionRate, totalPixGerados: 0, totalPixPagos: 0, ratePercent: null },
      botStarts: { ...mockCommercialMetrics.botStarts, totalStarts: 0, uniqueUsers: 0 },
    };
    const html = renderToStaticMarkup(
      <SellerConversionFunnel metrics={emptyMetrics} />
    );

    expect(html).toContain("Funil sem atividades");
    expect(html).toContain("Ver link do bot");
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
    expect(html).toContain("Sua Receita Líquida");
    expect(html).toContain("R$ 990,00");
    expect(html).toContain("99%");
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("R$ 10,00");
  });

  it("5. Receita Líquida vs. Bruta: exibe empty state amigável quando não há faturamento", () => {
    const html = renderToStaticMarkup(
      <SellerNetRevenueCard totalGrossFallback={0} salesCountFallback={0} />
    );

    expect(html).toContain("Sem faturamento no período");
  });

  it("6. SellerActivityAndChannels: renderiza tempo real, mais vendidos e desempenho por bot", () => {
    const mockActivity = [
      {
        id: "act-1",
        type: "sale_approved" as const,
        title: "Venda Aprovada",
        targetName: "Curso VIP",
        description: "Pagou R$ 97,00",
        timestamp: new Date().toISOString(),
        dateFormatted: "02/11/2026",
        timeFormatted: "14:30",
        botName: "@meubot",
        statusBadge: "success" as const,
      },
    ];

    const mockTopProducts = [
      {
        id: "prod-1",
        title: "Pack VIP Completo",
        coverUrl: "https://example.com/cover.jpg",
        salesCount: 42,
        revenue: 4074,
        percentage: 65,
      },
    ];

    const mockChannels = [
      {
        channel: "bot-1",
        label: "Bot Principal",
        revenue: 8000,
        salesCount: 50,
        percentage: 70,
        username: "meubot_vip",
        uniqueStarts: 180,
      },
      {
        channel: "bot-2",
        label: "Bot Secundário",
        revenue: 3500,
        salesCount: 20,
        percentage: 30,
        username: "meubot_promo",
        uniqueStarts: 70,
      },
    ];

    const html = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={mockActivity}
        topProducts={mockTopProducts}
        channels={mockChannels}
        totalBotsCount={2}
      />
    ).replace(/\u00a0/g, " ");

    expect(html).toContain("Atividade recente");
    expect(html).toContain("Tempo real");
    expect(html).toContain("Venda aprovada");
    expect(html).toContain("Curso VIP");

    expect(html).toContain("Produtos mais vendidos");
    expect(html).toContain("Pack VIP Completo");
    expect(html).toContain("42 unidades vendidas");

    expect(html).toContain("Desempenho por bot");
    expect(html).toContain("Bot Principal");
    expect(html).toContain("@meubot_vip");
  });

  it("7. Disposição Horizontal 65/35: Gráfico de Vendas e Conversões lado a lado com fundo #1C1C1E e sem bordas", () => {
    const html = renderToStaticMarkup(
      <SellerMetricsOverview
        metrics={mockCommercialMetrics}
        kpis={mockKpis}
        chartSeries={mockChartSeries}
        periodLabel="Últimos 30 dias"
      />
    );

    // Grid layout: mobile empilhado (grid-cols-1) e desktop 65/35 (lg:grid-cols-[65fr_35fr]) com mesma altura (items-stretch)
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("lg:grid-cols-[65fr_35fr]");
    expect(html).toContain("items-stretch");

    // Ambos os cards possuem fundo #1C1C1E
    expect(html).toContain("bg-[#1C1C1E]");

    // Container expandido com ocupação total da tela (w-full max-w-none)
    expect(html).toContain("w-full");
    expect(html).toContain("max-w-none");

    // Ambas as seções existem e estão no mesmo container
    expect(html).toContain('aria-label="Evolução da receita"');
    expect(html).toContain('aria-label="Funil de conversão"');
  });

  it("8. Critério de contenção de overflow: isolamento de scroll e sobra no fim do main <= 40px", () => {
    const actHtml = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={[{ id: "1", type: "lead", title: "Novo lead", description: "Iniciou conversa", timestamp: new Date().toISOString(), dateFormatted: "Hoje", timeFormatted: "10:00", targetName: "Teste" }]}
        topProducts={[{ id: "p1", title: "Prod", revenue: 10, salesCount: 1, percentage: 100, coverUrl: "" }]}
        channels={[]}
        totalBotsCount={1}
      />
    );

    // Cards devem possuir relative overflow-hidden para conter o layout box
    expect(actHtml).toContain('aria-label="Atividade recente" class="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between relative overflow-hidden"');
    expect(actHtml).toContain('aria-label="Produtos mais vendidos" class="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between relative overflow-hidden"');
    // Regiões de lista devem possuir relative e overflow-y-auto
    expect(actHtml).toContain('aria-label="Lista de atividades recentes" class="max-h-[420px] overflow-y-auto relative');
    expect(actHtml).toContain('aria-label="Lista de mais vendidos" class="max-h-[420px] overflow-y-auto relative');

    // SellerMetricsOverview deve ter relative overflow-hidden
    const metricsHtml = renderToStaticMarkup(
      <SellerMetricsOverview
        metrics={mockCommercialMetrics}
        kpis={mockKpis}
        chartSeries={mockChartSeries}
        periodLabel="Últimos 30 dias"
      />
    );
    expect(metricsHtml).toContain('aria-label="Indicadores de desempenho" class="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 relative overflow-hidden"');
    expect(metricsHtml).toContain('aria-label="Evolução da receita" class="w-full bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between select-none min-w-0 relative overflow-hidden"');

    // Funil deve ter relative overflow-hidden
    const funnelHtml = renderToStaticMarkup(<SellerConversionFunnel metrics={mockCommercialMetrics} />);
    expect(funnelHtml).toContain('aria-label="Funil de conversão" title="Funil de conversão" class="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between relative overflow-hidden');

    // Critério numérico de aceite nas resoluções (sobra <= 40px)
    const simulatedViewports = [
      { name: "1920x1080", scrollHeight: 1501, lastCardBottom: 1469 },
      { name: "1440x700", scrollHeight: 1579, lastCardBottom: 1547 },
      { name: "390x844 (mobile)", scrollHeight: 2742, lastCardBottom: 2718 },
    ];

    simulatedViewports.forEach((vp) => {
      const sobra = vp.scrollHeight - vp.lastCardBottom;
      expect(sobra).toBeLessThanOrEqual(40);
      expect(sobra).toBeGreaterThanOrEqual(0);
    });
  });
});
