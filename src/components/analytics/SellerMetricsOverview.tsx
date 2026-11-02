"use client";

import React, { useMemo, useState } from "react";
import { 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CreditCard, 
  Bot, 
  ArrowUpRight, 
  DollarSign, 
  QrCode,
  HelpCircle,
  BarChart2,
  LineChart
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { getBusinessDateKey } from "@/lib/analytics/timezone-utils";
import { MiniSparkline } from "./MiniSparkline";

interface KpiDataPoint {
  value: number;
  formatted: string;
  changePercent: number | null;
  trend: 'up' | 'down' | 'neutral' | 'none';
  subtitle: string;
}

interface SellerMetricsOverviewProps {
  metrics?: CommercialMetrics | null;
  kpis?: {
    revenue?: KpiDataPoint;
    salesCount?: KpiDataPoint;
    customersCount?: KpiDataPoint;
    averageTicket?: KpiDataPoint;
  };
  chartSeries?: Array<{
    dateLabel: string;
    fullDate: string;
    revenue: number;
    salesCount: number;
  }>;
  isPending?: boolean;
  periodLabel?: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function RevenueTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const rev = Number(item.revenue || 0);
    const count = Number(item.salesCount || 0);

    return (
      <div className="bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.08))] text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px] pointer-events-none select-none z-50">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1.5 mb-1">
          <span className="font-medium text-zinc-300 text-[11px]">{item.fullDate || item.dateLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3984FF]" />
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Receita:</span>
          <span className="font-bold text-white font-sans tabular-nums">
            {formatBRL(rev)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Pedidos:</span>
          <span className="font-medium text-zinc-300 font-sans tabular-nums">
            {count} {count === 1 ? "pedido" : "pedidos"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

function IndicatorTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-[10px] font-bold cursor-help transition-colors"
        aria-label="Mais informações"
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[var(--seller-surface-raised,#181A20)] border border-white/10 text-zinc-200 text-[11px] shadow-2xl whitespace-nowrap z-40 pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ changePercent, trend }: { changePercent: number | null; trend?: 'up' | 'down' | 'neutral' | 'none' }) {
  if (changePercent === null) return null;

  const isUp = trend === 'up' || changePercent > 0;
  const isDown = trend === 'down' || changePercent < 0;

  if (isUp) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tabular-nums">
        <TrendingUp className="w-2.5 h-2.5 stroke-[2.5]" />
        <span>+{Math.abs(changePercent)}%</span>
      </span>
    );
  }

  if (isDown) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 tabular-nums">
        <TrendingDown className="w-2.5 h-2.5 stroke-[2.5]" />
        <span>-{Math.abs(changePercent)}%</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-zinc-400 border border-white/[0.06] tabular-nums">
      <Minus className="w-2.5 h-2.5" />
      <span>0%</span>
    </span>
  );
}

export function SellerMetricsOverview({
  metrics,
  kpis,
  chartSeries = [],
  isPending = false,
  periodLabel = "Últimos 30 dias",
}: SellerMetricsOverviewProps) {
  const [chartMode, setChartMode] = useState<"area" | "bar">("area");

  const approvedSales = metrics?.approvedSales;
  const conversionRate = metrics?.conversionRate;
  const botStarts = metrics?.botStarts;
  const averageTicket = metrics?.averageTicket;

  const performanceSeries = metrics?.performanceSeries || metrics?.last7DaysPerformance || chartSeries || [];
  const last7DaysPerformance = metrics?.last7DaysPerformance || [];

  const normalizedSeries = useMemo(() => {
    const series = performanceSeries || [];
    return series.map((p: any) => ({
      dateLabel: String(p.dateLabel || ""),
      fullDate: String(p.fullDate || p.dateLabel || ""),
      revenue: Number(p.revenue || 0),
      salesCount: Number(p.salesCount || 0),
    }));
  }, [performanceSeries]);

  // 1. Cálculo de "Hoje" e "Ontem" pelo fuso America/Recife
  const { todayRevenue, yesterdayRevenue, growthPercent } = useMemo(() => {
    const now = new Date();
    const todayKey = getBusinessDateKey(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = getBusinessDateKey(yesterdayDate);

    const todayPoint =
      last7DaysPerformance.find((p: any) => p.dateKey === todayKey || p.dateStr === todayKey) ||
      performanceSeries.find((p: any) => p.dateKey === todayKey || p.dateStr === todayKey);

    const yesterdayPoint =
      last7DaysPerformance.find((p: any) => p.dateKey === yesterdayKey || p.dateStr === yesterdayKey) ||
      performanceSeries.find((p: any) => p.dateKey === yesterdayKey || p.dateStr === yesterdayKey);

    const todayRev = todayPoint ? Number(todayPoint.revenue || 0) : 0;
    const yesterdayRev = yesterdayPoint ? Number(yesterdayPoint.revenue || 0) : 0;

    let pctLabel: string | null = null;
    if (yesterdayRev > 0 && todayRev > yesterdayRev) {
      const diff = todayRev - yesterdayRev;
      const pct = Math.round((diff / yesterdayRev) * 100);
      pctLabel = pct > 999 ? "+999%+" : `+${pct}%`;
    }

    return {
      todayRevenue: todayRev,
      yesterdayRevenue: yesterdayRev,
      growthPercent: pctLabel,
    };
  }, [last7DaysPerformance, performanceSeries]);

  // Total de receita do período
  const totalPeriodRevenue = useMemo(() => {
    return performanceSeries.reduce((sum, p) => sum + (p.revenue || 0), 0);
  }, [performanceSeries]);

  const hasSeriesSales = totalPeriodRevenue > 0 || performanceSeries.some((p) => (p.salesCount || 0) > 0);

  // Pagamentos Pix
  const totalPixGenerated = conversionRate?.totalPixGerados ?? 0;
  const totalPixPaid = conversionRate?.totalPixPagos ?? approvedSales?.count ?? 0;
  const conversionRatePercent = conversionRate?.ratePercent ?? (totalPixGenerated > 0 ? Math.round((totalPixPaid / totalPixGenerated) * 100) : null);

  // Starts
  const totalStartsCount = botStarts?.uniqueUsers || botStarts?.totalStarts || 0;

  // Séries para MiniSparklines
  const revenueSparklineData = useMemo(() => {
    if (chartSeries.length > 0) return chartSeries.map((p) => p.revenue);
    if (performanceSeries.length > 0) return performanceSeries.map((p: any) => Number(p.revenue || 0));
    return [0, 0];
  }, [chartSeries, performanceSeries]);

  const salesSparklineData = useMemo(() => {
    if (chartSeries.length > 0) return chartSeries.map((p) => p.salesCount);
    if (performanceSeries.length > 0) return performanceSeries.map((p: any) => Number(p.salesCount || 0));
    return [0, 0];
  }, [chartSeries, performanceSeries]);

  const ticketSparklineData = useMemo(() => {
    const series = chartSeries.length > 0 ? chartSeries : performanceSeries;
    if (series.length > 0) {
      return series.map((p: any) => (p.salesCount > 0 ? Number(p.revenue || 0) / Number(p.salesCount) : 0));
    }
    return [0, 0];
  }, [chartSeries, performanceSeries]);

  // SKELETON LOADING
  if (isPending) {
    return (
      <div className="w-full space-y-5 animate-pulse">
        {/* Hero Skeleton */}
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="h-4 bg-white/[0.04] rounded w-28" />
            <div className="h-10 bg-white/[0.06] rounded w-56" />
            <div className="h-4 bg-white/[0.04] rounded w-36" />
          </div>
          <div className="space-y-2 sm:text-right">
            <div className="h-4 bg-white/[0.04] rounded w-32" />
            <div className="h-8 bg-white/[0.06] rounded w-44" />
          </div>
        </div>

        {/* 4 Indicadores Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 space-y-3">
              <div className="h-4 bg-white/[0.04] rounded w-28" />
              <div className="h-8 bg-white/[0.06] rounded w-36" />
              <div className="h-3.5 bg-white/[0.04] rounded w-24" />
            </div>
          ))}
        </div>

        {/* Gráfico Skeleton */}
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 min-h-[280px] flex items-center justify-center">
          <div className="h-48 w-full bg-white/[0.02] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* =========================================================================
          1. DESTAQUE PRINCIPAL (HERO): VENDAS DE HOJE
         ========================================================================= */}
      <section
        aria-label="Destaque de vendas"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 shadow-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
          {/* Lado Esquerdo: Vendas de hoje */}
          <div className="space-y-1.5 min-w-0">
            <span className="text-[13px] text-zinc-400 font-normal block leading-tight">
              Vendas de hoje
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold font-sans tracking-tight tabular-nums text-white leading-none">
                {formatBRL(todayRevenue)}
              </span>
              {growthPercent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 tabular-nums">
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{growthPercent} vs ontem</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 pt-0.5">
              Ontem: <span className="text-zinc-300 font-medium font-sans tabular-nums">{formatBRL(yesterdayRevenue)}</span>
            </p>
          </div>

          {/* Lado Direito: Total do período selecionado */}
          <div className="pt-3 sm:pt-0 sm:border-l sm:border-white/[0.06] sm:pl-6 sm:text-right shrink-0">
            <span className="text-[13px] text-zinc-400 font-normal block leading-tight">
              Total do período ({periodLabel})
            </span>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-sans tracking-tight tabular-nums text-white mt-1">
              {kpis?.revenue?.formatted || approvedSales?.formatted || formatBRL(totalPeriodRevenue)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. QUATRO INDICADORES DE DESEMPENHO (Compactos, no estilo original)
         ========================================================================= */}
      <section aria-label="Indicadores de desempenho" className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Indicador 1: Receita aprovada / Receita bruta */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[13px] text-zinc-400 font-normal flex items-center gap-1.5 leading-tight">
                  <span>Receita aprovada</span>
                  <IndicatorTooltip text="Receita bruta: Faturamento total bruto obtido no período selecionado." />
                </span>
                <div className="w-6 h-6 rounded-md bg-white/[0.03] text-zinc-400 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-[#3984FF]" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
                  {kpis?.revenue?.formatted || approvedSales?.formatted || formatBRL(totalPeriodRevenue)}
                </div>
                <DeltaBadge changePercent={kpis?.revenue?.changePercent ?? null} trend={kpis?.revenue?.trend} />
              </div>

              <div className="pt-2">
                <MiniSparkline data={revenueSparklineData} color="#3984FF" height={24} width={76} />
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-400">
                {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
              </p>
            </div>
          </div>

          {/* Indicador 2: Vendas aprovadas */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[13px] text-zinc-400 font-normal flex items-center gap-1.5 leading-tight">
                  <span>Vendas aprovadas</span>
                  <IndicatorTooltip text="Quantidade de pedidos com pagamento confirmado via Pix no período." />
                </span>
                <div className="w-6 h-6 rounded-md bg-white/[0.03] text-zinc-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
                  {kpis?.salesCount?.value ?? approvedSales?.count ?? 0}
                </div>
                <DeltaBadge changePercent={kpis?.salesCount?.changePercent ?? null} trend={kpis?.salesCount?.trend} />
              </div>

              <div className="pt-2">
                <MiniSparkline data={salesSparklineData} color="#10B981" height={24} width={76} />
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-400">
                Volume de pedidos concluídos
              </p>
            </div>
          </div>

          {/* Indicador 3: Valor médio por venda / Ticket médio */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[13px] text-zinc-400 font-normal flex items-center gap-1.5 leading-tight">
                  <span>Valor médio por venda</span>
                  <IndicatorTooltip text="Ticket médio: Valor médio recebido por cada venda aprovada." />
                </span>
                <div className="w-6 h-6 rounded-md bg-white/[0.03] text-zinc-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
                  {kpis?.averageTicket?.formatted || averageTicket?.formatted || "R$ 0,00"}
                </div>
                <DeltaBadge changePercent={kpis?.averageTicket?.changePercent ?? null} trend={kpis?.averageTicket?.trend} />
              </div>

              <div className="pt-2">
                <MiniSparkline data={ticketSparklineData} color="#F59E0B" height={24} width={76} />
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-400">
                {averageTicket?.consideredSalesCount
                  ? `Média de ${averageTicket.consideredSalesCount} ${averageTicket.consideredSalesCount === 1 ? 'venda aprovada' : 'vendas aprovadas'}`
                  : "Média por pedido aprovado"}
              </p>
            </div>
          </div>

          {/* Indicador 4: Pagamentos concluídos / Conversão Pix */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[13px] text-zinc-400 font-normal flex items-center gap-1.5 leading-tight">
                  <span>Pagamentos concluídos</span>
                  <IndicatorTooltip text="Conversão Pix: Percentual de cobranças Pix geradas que foram efetivamente pagas." />
                </span>
                <div className="w-6 h-6 rounded-md bg-white/[0.03] text-zinc-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
                  {conversionRatePercent !== null ? `${conversionRatePercent}%` : "—"}
                </div>
                <span className="text-[10px] text-zinc-400 font-sans tabular-nums">
                  {totalPixPaid}/{totalPixGenerated || 0}
                </span>
              </div>

              <div className="pt-2">
                <MiniSparkline data={salesSparklineData} color="#A855F7" height={24} width={76} />
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04] space-y-1.5">
              <p className="text-xs text-zinc-400">
                {totalPixGenerated > 0
                  ? `De ${totalPixGenerated} Pix gerados, ${totalPixPaid} foram pagos`
                  : "Nenhuma cobrança Pix gerada"}
              </p>
              {conversionRatePercent !== null && (
                <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3984FF] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(conversionRatePercent, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linha menor de starts */}
        <div className="px-1 flex items-center gap-2 text-xs text-zinc-400">
          <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>
            <strong className="text-zinc-200 font-medium font-sans tabular-nums">{totalStartsCount}</strong>{" "}
            {totalStartsCount === 1 ? "pessoa iniciou conversa" : "pessoas iniciaram conversa"} no período
          </span>
        </div>
      </section>

      {/* =========================================================================
          3. GRÁFICO: RECEITA EM DESTAQUE (Largura Total com Seletor Curva / Barras)
         ========================================================================= */}
      <section
        aria-label="Evolução da receita"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 shadow-none"
      >
        {/* Topo do Card de Gráfico */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Receita</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-zinc-400">Total: </span>
              <span className="text-sm font-bold font-sans tabular-nums text-white">
                {formatBRL(totalPeriodRevenue)}
              </span>
            </div>

            {/* Alternador discreto de visualização */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setChartMode("area")}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
                  chartMode === "area"
                    ? "bg-[#3984FF] text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Ver como curva contínua"
              >
                <LineChart className="w-3 h-3" />
                <span>Curva</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("bar")}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
                  chartMode === "bar"
                    ? "bg-[#3984FF] text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Ver como barras diárias"
              >
                <BarChart2 className="w-3 h-3" />
                <span>Barras</span>
              </button>
            </div>
          </div>
        </div>

        {/* Área do Gráfico */}
        <div
          role="img"
          aria-label={`Gráfico de evolução da receita: total de ${formatBRL(totalPeriodRevenue)} em ${periodLabel}`}
          className="w-full h-[220px] sm:min-h-[240px] sm:h-64 flex items-center justify-center overflow-hidden"
        >
          {!hasSeriesSales ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5 my-auto">
              <p className="text-zinc-300 text-xs font-semibold">Sem vendas neste período</p>
              <p className="text-zinc-400 text-[11px] max-w-xs leading-relaxed">
                Quando novos pedidos forem confirmados, a curva de receita aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "area" ? (
                  <AreaChart
                    data={normalizedSeries}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="azureRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3984FF" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#3984FF" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      stroke="#71717A"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={5}
                    />
                    <YAxis
                      stroke="#71717A"
                      fontSize={10}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val}`
                      }
                    />
                    <RechartsTooltip content={<RevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3984FF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#azureRevenueGrad)"
                      dot={{ r: 2.5, fill: "#3984FF", stroke: "#12141A", strokeWidth: 1.5 }}
                      activeDot={{
                        r: 4.5,
                        stroke: "#FFFFFF",
                        strokeWidth: 2,
                        fill: "#3984FF",
                      }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={normalizedSeries}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="azureBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3984FF" stopOpacity={1} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      stroke="#71717A"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={5}
                    />
                    <YAxis
                      stroke="#71717A"
                      fontSize={10}
                      domain={[0, "auto"]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val}`
                      }
                    />
                    <RechartsTooltip content={<RevenueTooltip />} />
                    <Bar
                      dataKey="revenue"
                      fill="url(#azureBarGrad)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
