"use client";

import React, { useMemo } from "react";
import { CheckCircle2, TrendingUp, CreditCard, Bot, ArrowUpRight } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { CommercialMetrics, PerformancePoint } from "@/lib/analytics/commercial-metrics-service";
import { getBusinessDateKey } from "@/lib/analytics/timezone-utils";

interface SellerMetricsOverviewProps {
  metrics?: CommercialMetrics | null;
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
      <div className="bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.08))] text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px] pointer-events-none select-none">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1.5 mb-1">
          <span className="font-medium text-zinc-300 text-[11px]">{item.fullDate || item.dateLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
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

export function SellerMetricsOverview({
  metrics,
  isPending = false,
  periodLabel = "Últimos 30 dias",
}: SellerMetricsOverviewProps) {
  const approvedSales = metrics?.approvedSales;
  const conversionRate = metrics?.conversionRate;
  const botStarts = metrics?.botStarts;
  const averageTicket = metrics?.averageTicket;

  const performanceSeries = metrics?.performanceSeries || metrics?.last7DaysPerformance || [];
  const last7DaysPerformance = metrics?.last7DaysPerformance || [];

  // 1. Cálculo dinâmico de "Hoje" e "Ontem" pelo fuso America/Recife (sem índices fixos)
  const { todayRevenue, yesterdayRevenue, growthPercent } = useMemo(() => {
    const now = new Date();
    const todayKey = getBusinessDateKey(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = getBusinessDateKey(yesterdayDate);

    // Busca primeiro em last7DaysPerformance (que sempre contém os últimos 7 dias até hoje), com fallback em performanceSeries
    const todayPoint =
      last7DaysPerformance.find((p: any) => p.dateKey === todayKey || p.dateStr === todayKey) ||
      performanceSeries.find((p: any) => p.dateKey === todayKey || p.dateStr === todayKey);

    const yesterdayPoint =
      last7DaysPerformance.find((p: any) => p.dateKey === yesterdayKey || p.dateStr === yesterdayKey) ||
      performanceSeries.find((p: any) => p.dateKey === yesterdayKey || p.dateStr === yesterdayKey);

    const todayRev = todayPoint ? Number(todayPoint.revenue || 0) : 0;
    const yesterdayRev = yesterdayPoint ? Number(yesterdayPoint.revenue || 0) : 0;

    let pctLabel: string | null = null;
    // Pílula verde só quando hoje já superou o total de ontem. NUNCA pílula vermelha.
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

  // Total de receita da série do gráfico
  const totalPeriodRevenue = useMemo(() => {
    return performanceSeries.reduce((sum, p) => sum + (p.revenue || 0), 0);
  }, [performanceSeries]);

  const hasSeriesSales = totalPeriodRevenue > 0 || performanceSeries.some((p) => (p.salesCount || 0) > 0);

  // Pagamentos concluídos (Pix)
  const totalPixGenerated = conversionRate?.totalPixGerados ?? 0;
  const totalPixPaid = conversionRate?.totalPixPagos ?? approvedSales?.count ?? 0;
  const conversionRatePercent = conversionRate?.ratePercent ?? (totalPixGenerated > 0 ? Math.round((totalPixPaid / totalPixGenerated) * 100) : null);

  // Starts
  const totalStartsCount = botStarts?.uniqueUsers || botStarts?.totalStarts || 0;

  // SKELETON LOADING STATE (mesmo formato e proporções, sem salto de layout)
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

        {/* 3 Indicadores Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 space-y-2">
            <div className="h-4 bg-white/[0.04] rounded w-32" />
            <div className="h-8 bg-white/[0.06] rounded w-40" />
            <div className="h-3.5 bg-white/[0.04] rounded w-28" />
          </div>
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 space-y-2">
            <div className="h-4 bg-white/[0.04] rounded w-36" />
            <div className="h-8 bg-white/[0.06] rounded w-24" />
            <div className="h-3.5 bg-white/[0.04] rounded w-44" />
          </div>
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 space-y-2">
            <div className="h-4 bg-white/[0.04] rounded w-36" />
            <div className="h-8 bg-white/[0.06] rounded w-32" />
            <div className="h-3.5 bg-white/[0.04] rounded w-36" />
          </div>
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tabular-nums">
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
              {approvedSales?.formatted || formatBRL(totalPeriodRevenue)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. TRÊS INDICADORES COM LINGUAGEM SIMPLES
         ========================================================================= */}
      <section aria-label="Indicadores principais" className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Indicador 1: Receita aprovada */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[13px] text-zinc-400 font-normal block leading-tight">
                Receita aprovada
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white pt-1">
                {approvedSales?.formatted || "R$ 0,00"}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-400">
                {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
              </p>
            </div>
          </div>

          {/* Indicador 2: Pagamentos concluídos */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[13px] text-zinc-400 font-normal block leading-tight">
                Pagamentos concluídos
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white pt-1">
                {conversionRatePercent !== null ? `${conversionRatePercent}%` : "—"}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.04] space-y-1.5">
              <p className="text-xs text-zinc-400">
                {totalPixGenerated > 0
                  ? `De ${totalPixGenerated} Pix gerados, ${totalPixPaid} foram pagos`
                  : "Nenhuma cobrança Pix gerada"}
              </p>
              {conversionRatePercent !== null && (
                <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden pt-0.5">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(conversionRatePercent, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Indicador 3: Valor médio por venda */}
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[13px] text-zinc-400 font-normal block leading-tight">
                Valor médio por venda
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white pt-1">
                {averageTicket?.formatted || "R$ 0,00"}
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
          3. GRÁFICO: RECEITA (Recharts Monotone com Preenchimento Esmeralda)
         ========================================================================= */}
      <section
        aria-label="Evolução da receita"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 shadow-none"
      >
        {/* Topo do Card de Gráfico */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Receita</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>
          </div>

          <div className="text-right">
            <span className="text-xs text-zinc-400">Total: </span>
            <span className="text-sm font-bold font-sans tabular-nums text-white">
              {formatBRL(totalPeriodRevenue)}
            </span>
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
                <AreaChart
                  data={performanceSeries}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="emeraldRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
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
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#emeraldRevenueGrad)"
                    dot={{ r: 2.5, fill: "#10B981", stroke: "#12141A", strokeWidth: 1.5 }}
                    activeDot={{
                      r: 4.5,
                      stroke: "#FFFFFF",
                      strokeWidth: 2,
                      fill: "#10B981",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

