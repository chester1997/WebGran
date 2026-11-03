"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { getBusinessDateKey } from "@/lib/analytics/timezone-utils";
import { SellerConversionFunnel } from "./SellerConversionFunnel";
import { LineChart as LineIcon, BarChart2 as BarIcon } from "lucide-react";

interface KpiDataPoint {
  value: number;
  formatted: string;
  changePercent?: number | null;
  trend?: "up" | "down" | "neutral" | "none";
  subtitle?: string;
}

interface SellerMetricsOverviewProps {
  metrics?: CommercialMetrics | null;
  kpis?: {
    revenue?: KpiDataPoint;
    salesCount?: KpiDataPoint;
    averageTicket?: KpiDataPoint;
    conversionRate?: KpiDataPoint;
  } | null;
  chartSeries?: {
    dateStr?: string;
    dateLabel: string;
    fullDate?: string;
    fullDateLabel?: string;
    dayName?: string;
    revenue: number;
    salesCount?: number;
    ticket?: number;
    formattedRevenue?: string;
  }[];
  isPending?: boolean;
  periodLabel?: string;
  funnelSlot?: React.ReactNode;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function SellerMetricsOverview({
  metrics,
  kpis,
  chartSeries = [],
  isPending = false,
  periodLabel = "Últimos 30 dias",
  funnelSlot,
}: SellerMetricsOverviewProps) {
  const [chartMode, setChartMode] = useState<"area" | "bar">("area");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const approvedSales = metrics?.approvedSales;
  const conversionRate = metrics?.conversionRate;
  const averageTicket = metrics?.averageTicket;
  const botStarts = metrics?.botStarts;
  const performanceSeries = metrics?.performanceSeries || [];
  const last7Days = metrics?.last7DaysPerformance || [];

  // Vendas de hoje e ontem (extraídas de last7DaysPerformance)
  const todayKey = getBusinessDateKey(new Date());
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getBusinessDateKey(yesterdayDate);

  const todayPerformance = last7Days.find(
    (p) => p.dateKey === todayKey || p.dateStr === todayKey || p.dayName === "Hoje"
  );
  const yesterdayPerformance = last7Days.find(
    (p) => p.dateKey === yesterdayKey || p.dateStr === yesterdayKey || p.dayName === "Ontem"
  );

  const todayRevenue = todayPerformance?.revenue ?? 0;
  const yesterdayRevenue = yesterdayPerformance?.revenue ?? 0;
  const todayFormatted = todayPerformance?.formattedRevenue ?? formatBRL(todayRevenue);
  const yesterdayFormatted = yesterdayPerformance?.formattedRevenue ?? formatBRL(yesterdayRevenue);

  // Pílula acessível de crescimento Hoje vs Ontem
  let growthPill: string | null = null;
  if (todayRevenue > yesterdayRevenue && yesterdayRevenue > 0) {
    const diff = todayRevenue - yesterdayRevenue;
    const pct = Math.round((diff / yesterdayRevenue) * 100);
    growthPill = pct > 999 ? "+999%+ vs ontem" : `+${pct}% vs ontem`;
  }

  // Normalização da série de dados para o gráfico
  const normalizedSeries = useMemo(() => {
    if (chartSeries && chartSeries.length > 0) {
      return chartSeries.map((item) => ({
        dateLabel: item.dateLabel || item.dateStr || "",
        fullDateLabel: item.fullDate || item.fullDateLabel || item.dateStr || item.dateLabel,
        dayName: item.dayName || "",
        revenue: Number(item.revenue || 0),
        salesCount: Number(item.salesCount || 0),
      }));
    }
    if (performanceSeries && performanceSeries.length > 0) {
      return performanceSeries.map((item: any) => ({
        dateLabel: item.dateLabel || item.dateStr || "—",
        fullDateLabel: item.fullDateLabel || item.dateStr || "",
        dayName: item.dayName || "",
        revenue: Number(item.revenue || 0),
        salesCount: Number(item.salesCount || 0),
      }));
    }
    return [];
  }, [chartSeries, performanceSeries]);

  const totalPeriodRevenue = useMemo(() => {
    if (approvedSales?.total !== undefined && approvedSales.total !== null) {
      return approvedSales.total;
    }
    return normalizedSeries.reduce((acc, curr) => acc + curr.revenue, 0);
  }, [approvedSales, normalizedSeries]);

  const totalConfirmedSales = approvedSales?.count ?? normalizedSeries.reduce((acc, curr) => acc + curr.salesCount, 0);
  const totalStartsCount = botStarts?.uniqueUsers || botStarts?.totalStarts || 0;

  // Valores dos 4 indicadores
  const receitaValue = kpis?.revenue?.formatted || approvedSales?.formatted || formatBRL(totalPeriodRevenue);
  const vendasValue = kpis?.salesCount?.value ?? approvedSales?.count ?? 0;
  const ticketValue = kpis?.averageTicket?.formatted || averageTicket?.formatted || "R$ 0,00";

  const totalPixGenerated = conversionRate?.totalPixGerados ?? 0;
  const totalPixPaid = conversionRate?.totalPixPagos ?? approvedSales?.count ?? 0;
  const conversionRatePercent = conversionRate?.ratePercent ?? (totalPixGenerated > 0 ? Math.round((totalPixPaid / totalPixGenerated) * 100) : null);
  const pixValue = conversionRatePercent !== null ? `${conversionRatePercent}%` : `${totalPixPaid}/${totalPixGenerated || 0}`;

  // Dimensões SVG e coordenadas do gráfico
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 280;
  const PAD_LEFT = 75;
  const PAD_RIGHT = 25;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 40;
  const PLOT_W = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
  const PLOT_H = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxRevenue = useMemo(() => {
    const max = Math.max(...normalizedSeries.map((p) => p.revenue), 0);
    if (max <= 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [normalizedSeries]);

  const chartPoints = useMemo(() => {
    if (normalizedSeries.length === 0) return [];
    const count = normalizedSeries.length;
    const stepX = count > 1 ? PLOT_W / (count - 1) : PLOT_W;

    return normalizedSeries.map((item, idx) => {
      const x = PAD_LEFT + (count > 1 ? idx * stepX : PLOT_W / 2);
      const ratio = Math.min(Math.max(item.revenue / maxRevenue, 0), 1);
      const y = PAD_TOP + PLOT_H - ratio * PLOT_H;
      return { x, y, data: item };
    });
  }, [normalizedSeries, maxRevenue, PLOT_W, PLOT_H, PAD_LEFT, PAD_TOP]);

  const smoothCurvePath = useMemo(() => {
    return generateSmoothPath(chartPoints);
  }, [chartPoints]);

  const smoothAreaPath = useMemo(() => {
    if (chartPoints.length === 0) return "";
    const baseY = PAD_TOP + PLOT_H;
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    return `${smoothCurvePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
  }, [chartPoints, smoothCurvePath, PAD_TOP, PLOT_H]);

  // Scrubber Interativo (Apple Stocks / Bolsa)
  const handleScrubberMove = useCallback(
    (clientX: number) => {
      if (!svgRef.current || chartPoints.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const scaleX = SVG_WIDTH / rect.width;
      const svgX = relativeX * scaleX;

      let closestIdx = 0;
      let minDistance = Infinity;

      chartPoints.forEach((pt, idx) => {
        const dist = Math.abs(pt.x - svgX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      setHoveredIndex(closestIdx);
    },
    [chartPoints, SVG_WIDTH]
  );

  const activePoint = hoveredIndex !== null && chartPoints[hoveredIndex] ? chartPoints[hoveredIndex] : null;

  // Total e legenda dinâmicos sob interação
  const displayRevenue = activePoint ? formatBRL(activePoint.data.revenue) : formatBRL(totalPeriodRevenue);
  const displaySubtitle = activePoint
    ? `${activePoint.data.dayName ? `${activePoint.data.dayName}, ` : ""}${activePoint.data.fullDateLabel || activePoint.data.dateLabel} · ${activePoint.data.salesCount} ${
        activePoint.data.salesCount === 1 ? "venda confirmada" : "vendas confirmadas"
      }`
    : `${periodLabel} · ${totalConfirmedSales} ${totalConfirmedSales === 1 ? "venda confirmada" : "vendas confirmadas"}`;

  // Skeleton Loading elegante
  if (isPending) {
    return (
      <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-[20px] animate-pulse">
        <div className="h-10 bg-white/[0.04] rounded-[14px] w-64" />
        <div className="h-32 bg-[#1C1C1E] rounded-[22px]" />
        <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-[20px] items-stretch">
          <div className="h-96 bg-[#1C1C1E] rounded-[22px]" />
          <div className="h-96 bg-[#1C1C1E] rounded-[22px]" />
        </div>
      </div>
    );
  }

  // Ticks do eixo Y
  const yTicks = [
    { value: maxRevenue, y: PAD_TOP, label: formatBRL(maxRevenue) },
    { value: maxRevenue / 2, y: PAD_TOP + PLOT_H / 2, label: formatBRL(maxRevenue / 2) },
    { value: 0, y: PAD_TOP + PLOT_H, label: "R$ 0" },
  ];

  // Ticks do eixo X (amostra de 5 a 6 pontos espaçados)
  const xTicks = chartPoints.filter((_, idx) => {
    if (chartPoints.length <= 6) return true;
    const step = Math.ceil(chartPoints.length / 5);
    return idx % step === 0 || idx === chartPoints.length - 1;
  });

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-[20px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Inter',system-ui,sans-serif] [font-feature-settings:'tnum'] text-[var(--apple-text,#fff)]">
      {/* =========================================================================
          1. CABEÇALHO (Título Vendas + Resumo Hoje/Ontem)
         ========================================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-1 px-1">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.022em] text-[var(--apple-text,#fff)]">
          Vendas
        </h1>
        <div className="text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal flex items-center gap-1.5 flex-wrap">
          <span className="sr-only">Vendas de hoje</span>
          <span>Hoje </span>
          <strong className="font-bold text-[var(--apple-text,#fff)] tabular-nums">{todayFormatted}</strong>
          <span> · </span>
          <span className="sr-only">Ontem: </span>
          <span>ontem </span>
          <strong className="font-bold text-[var(--apple-text,#fff)] tabular-nums">{yesterdayFormatted}</strong>
          {growthPill && <span className="sr-only">{growthPill}</span>}
        </div>
      </header>

      {/* =========================================================================
          2. UMA ÚNICA SUPERFÍCIE: OS 4 INDICADORES EM GRID DE 4 COLUNAS
         ========================================================================= */}
      <section
        aria-label="Indicadores de desempenho"
        className="bg-[#1C1C1E] rounded-[22px] p-6 lg:p-7"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-white/[0.08]">
          {/* Indicador 1: Receita aprovada */}
          <div className="lg:px-6 first:pl-0 flex flex-col justify-between">
            <span className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal flex items-center gap-1">
              <span>Receita aprovada</span>
              <span className="text-[11px] text-zinc-500 cursor-help" title="Faturamento total bruto obtido no período">?</span>
            </span>
            <div className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[var(--apple-text,#fff)] tabular-nums my-1.5">
              {receitaValue}
            </div>
            <p className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
              {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
            </p>
          </div>

          {/* Indicador 2: Vendas aprovadas */}
          <div className="lg:px-6 flex flex-col justify-between">
            <span className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal flex items-center gap-1">
              <span>Vendas aprovadas</span>
              <span className="text-[11px] text-zinc-500 cursor-help" title="Quantidade de pedidos com pagamento confirmado">?</span>
            </span>
            <div className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[var(--apple-text,#fff)] tabular-nums my-1.5">
              {vendasValue}
            </div>
            <p className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
              Volume de pedidos concluídos
            </p>
          </div>

          {/* Indicador 3: Valor médio */}
          <div className="lg:px-6 flex flex-col justify-between">
            <span className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal flex items-center gap-1">
              <span>Valor médio por venda</span>
              <span className="text-[11px] text-zinc-500 cursor-help" title="Ticket médio por venda aprovada">?</span>
            </span>
            <div className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[var(--apple-text,#fff)] tabular-nums my-1.5">
              {ticketValue}
            </div>
            <p className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
              {averageTicket?.consideredSalesCount
                ? `Média de ${averageTicket.consideredSalesCount} ${averageTicket.consideredSalesCount === 1 ? "venda aprovada" : "vendas aprovadas"}`
                : "Média por pedido aprovado"}
            </p>
          </div>

          {/* Indicador 4: Pix pagos */}
          <div className="lg:px-6 last:pr-0 flex flex-col justify-between">
            <span className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal flex items-center gap-1">
              <span>Pix pagos</span>
              <span className="sr-only">Pagamentos concluídos</span>
              <span className="text-[11px] text-zinc-500 cursor-help" title="Taxa de conversão de Pix">?</span>
            </span>
            <div className="flex items-baseline justify-between gap-2 my-1.5">
              <span className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[var(--apple-text,#fff)] tabular-nums">
                {pixValue}
              </span>
              <span className="text-[11px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] tabular-nums">
                {totalPixPaid}/{totalPixGenerated || 0}
              </span>
            </div>
            <p className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
              De {totalPixGenerated} Pix gerados, {totalPixPaid} foram pagos
            </p>
          </div>
        </div>

        {/* Linha de starts */}
        <div className="px-1 pt-4 mt-4 border-t border-[var(--apple-separator,rgba(84,84,88,0.25))] flex items-center justify-between text-[12px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
          <span>
            <strong className="text-[var(--apple-text,#fff)] font-medium tabular-nums">{totalStartsCount}</strong>{" "}
            pessoas iniciaram conversa no período
          </span>
          <span className="sr-only">Total do período ({periodLabel})</span>
        </div>
      </section>

      {/* =========================================================================
          3. DISPOSIÇÃO HORIZONTAL: GRÁFICO DE VENDAS (65%) + CONVERSÃO (35%)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-[20px] items-stretch w-full">
        {/* Gráfico de vendas: 65% da largura disponível */}
        <section
          aria-label="Evolução da receita"
          className="w-full bg-[#1C1C1E] rounded-[22px] p-6 lg:p-7 flex flex-col justify-between select-none min-w-0"
        >
          {/* Topo: Legenda, Total grande (56px) e Controle Segmentado Curva/Barras */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
            <div>
              <span className="sr-only">Receita</span>
              <p className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal transition-colors">
                {displaySubtitle}
              </p>
              <div className="text-[40px] sm:text-[52px] lg:text-[56px] font-bold tracking-[-0.035em] text-[var(--apple-text,#fff)] tabular-nums leading-none mt-1">
                {displayRevenue}
              </div>
            </div>

            {/* Controle Segmentado iOS (Curva / Barras) */}
            <div className="inline-flex items-center self-start sm:self-auto bg-[var(--apple-surface-2,#2c2c2e)] p-1 rounded-[12px]">
              <button
                type="button"
                onClick={() => setChartMode("area")}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[8px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  chartMode === "area"
                    ? "bg-[#1C1C1E] text-[var(--apple-text,#fff)] shadow-xs"
                    : "text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] hover:text-[var(--apple-text,#fff)]"
                }`}
                title="Curva suave"
              >
                <LineIcon className="w-3.5 h-3.5" />
                <span>Curva</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("bar")}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[8px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  chartMode === "bar"
                    ? "bg-[#1C1C1E] text-[var(--apple-text,#fff)] shadow-xs"
                    : "text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] hover:text-[var(--apple-text,#fff)]"
                }`}
                title="Barras"
              >
                <BarIcon className="w-3.5 h-3.5" />
                <span>Barras</span>
              </button>
            </div>
          </div>

        {/* Gráfico SVG com Scrubber e Suporte a Touch e Teclado */}
        <div
          role="img"
          aria-label={`Gráfico de evolução da receita: total de ${formatBRL(totalPeriodRevenue)} em ${periodLabel}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (chartPoints.length === 0) return;
            if (e.key === "ArrowRight") {
              setHoveredIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, chartPoints.length - 1)));
            } else if (e.key === "ArrowLeft") {
              setHoveredIndex((prev) => (prev === null ? chartPoints.length - 1 : Math.max(prev - 1, 0)));
            } else if (e.key === "Escape") {
              setHoveredIndex(null);
            }
          }}
          className="w-full relative touch-none focus:outline-none focus:ring-1 focus:ring-[var(--apple-blue,#0a84ff)] rounded-[12px]"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-[220px] sm:h-[280px] overflow-visible"
            onMouseMove={(e) => handleScrubberMove(e.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchMove={(e) => {
              if (e.touches && e.touches[0]) {
                handleScrubberMove(e.touches[0].clientX);
              }
            }}
            onTouchEnd={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="appleAzureRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--apple-blue, #0a84ff)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--apple-blue, #0a84ff)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas de Grade Horizontais e Eixo Y em R$ */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  y1={tick.y}
                  x2={SVG_WIDTH - PAD_RIGHT}
                  y2={tick.y}
                  stroke="var(--apple-separator, rgba(84, 84, 88, 0.25))"
                  strokeWidth="1"
                />
                <text
                  x={PAD_LEFT - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fill="var(--apple-text-secondary, rgba(235, 235, 245, 0.6))"
                  fontSize="11"
                  className="tabular-nums"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Modo Curva Suave */}
            {chartMode === "area" && chartPoints.length > 0 && (
              <>
                <path d={smoothAreaPath} fill="url(#appleAzureRevenueGrad)" />
                <path
                  d={smoothCurvePath}
                  fill="none"
                  stroke="var(--apple-blue, #0a84ff)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Modo Barras */}
            {chartMode === "bar" &&
              chartPoints.map((pt, i) => {
                const barWidth = Math.max(Math.min(PLOT_W / chartPoints.length - 4, 28), 4);
                const barHeight = Math.max(PAD_TOP + PLOT_H - pt.y, 2);
                return (
                  <rect
                    key={i}
                    x={pt.x - barWidth / 2}
                    y={pt.y}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill={hoveredIndex === i ? "#ffffff" : "var(--apple-blue, #0a84ff)"}
                    opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.45}
                    className="transition-opacity duration-150"
                  />
                );
              })}

            {/* Eixo X com Rótulos de Data */}
            {xTicks.map((pt, i) => (
              <text
                key={i}
                x={pt.x}
                y={SVG_HEIGHT - 12}
                textAnchor="middle"
                fill="var(--apple-text-secondary, rgba(235, 235, 245, 0.6))"
                fontSize="11"
              >
                {pt.data.dateLabel}
              </text>
            ))}

            {/* Linha Vertical do Scrubber e Ponto Circular (Bolsa / Stocks) */}
            {activePoint && (
              <g pointerEvents="none">
                <line
                  x1={activePoint.x}
                  y1={PAD_TOP}
                  x2={activePoint.x}
                  y2={PAD_TOP + PLOT_H}
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle cx={activePoint.x} cy={activePoint.y} r="8" fill="var(--apple-blue, #0a84ff)" opacity="0.3" />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4.5"
                  fill="var(--apple-blue, #0a84ff)"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Overlay transparente para captura de ponteiro */}
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={PLOT_W}
              height={PLOT_H}
              fill="transparent"
              className="cursor-crosshair"
            />
          </svg>
        </div>
      </section>

      {/* Conversões: 35% da largura disponível */}
      <div className="w-full h-full min-w-0 flex flex-col">
        {funnelSlot ?? <SellerConversionFunnel metrics={metrics} isPending={isPending} className="h-full" />}
      </div>
    </div>
  </div>
  );
}
