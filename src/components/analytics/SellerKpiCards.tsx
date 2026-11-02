"use client";

import React, { useState } from "react";
import { 
  DollarSign, 
  ShoppingBag, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap 
} from "lucide-react";
import { KpiMetric, ChartPoint } from "@/lib/analytics/analytics-service";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { MiniSparkline } from "./MiniSparkline";

interface SellerKpiCardsProps {
  kpis?: {
    revenue: KpiMetric;
    salesCount: KpiMetric;
    customersCount: KpiMetric;
    averageTicket: KpiMetric;
  };
  commercialMetrics?: CommercialMetrics | null;
  chartSeries?: ChartPoint[];
  periodLabel?: string;
  isPending?: boolean;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface KpiCardItemProps {
  title: string;
  tooltipText: string;
  value: string;
  icon: React.ElementType;
  iconColorClass?: string;
  changePercent?: number | null;
  trend?: "up" | "down" | "neutral" | "none";
  periodLabel: string;
  sparklineData: number[];
  sparklineColor?: string;
}

function KpiCardItem({
  title,
  tooltipText,
  value,
  icon: Icon,
  iconColorClass = "text-[#3984FF] bg-blue-500/10 border-blue-500/20",
  changePercent,
  trend = "neutral",
  periodLabel,
  sparklineData,
  sparklineColor = "#3984FF",
}: KpiCardItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const hasTrend = changePercent !== null && changePercent !== undefined && trend !== "none";
  const isPositive = hasTrend && changePercent > 0;
  const isNegative = hasTrend && changePercent < 0;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-xl flex flex-col justify-between min-h-[170px] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent"
    >
      {/* Topo do Card: Chip Circular do Ícone + Título com Tooltip "?" */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Chip Circular */}
          <div
            className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 shadow-xs ${iconColorClass}`}
          >
            <Icon className="w-4 h-4 stroke-[2]" />
          </div>

          {/* Título com Tooltip "?" */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-zinc-300 truncate">
              {title}
            </span>

            <div className="relative inline-flex items-center">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                className="w-4 h-4 rounded-full text-zinc-500 hover:text-zinc-200 focus:text-white bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[10px] font-bold transition-colors cursor-help focus:outline-none focus:ring-1 focus:ring-[#3984FF]"
                aria-label={tooltipText}
              >
                ?
              </button>

              {showTooltip && (
                <div
                  role="tooltip"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 p-2.5 bg-[#151821] border border-white/10 text-zinc-200 text-[11px] rounded-xl shadow-2xl leading-snug text-center animate-in fade-in-0 zoom-in-95 pointer-events-none"
                >
                  {tooltipText}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#151821]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Número Grande com Tabular-Nums */}
      <div className="my-1">
        <span className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white block truncate leading-none">
          {value}
        </span>
      </div>

      {/* Rodapé: Badge de Variação vs. Período Anterior + Mini Sparkline */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-white/[0.04]">
        {/* Badge de Variação */}
        <div className="flex items-center gap-1 text-[11px] font-semibold tabular-nums shrink-0">
          {isPositive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 stroke-[2.5]" />
              <span>+{changePercent}%</span>
            </span>
          ) : isNegative ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-3 h-3 stroke-[2.5]" />
              <span>{changePercent}%</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
              <Minus className="w-3 h-3" />
              <span>0%</span>
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-normal hidden xl:inline ml-0.5">
            {periodLabel}
          </span>
        </div>

        {/* Mini Sparkline SVG */}
        <MiniSparkline
          data={sparklineData}
          color={isPositive ? "#10B981" : isNegative ? "#F43F5E" : sparklineColor}
          width={80}
          height={28}
        />
      </div>
    </div>
  );
}

export function SellerKpiCards({
  kpis,
  commercialMetrics,
  chartSeries = [],
  periodLabel = "vs período anterior",
  isPending = false,
}: SellerKpiCardsProps) {
  // Sparklines extraídas dos pontos do gráfico
  const revenuePoints = chartSeries.map((p) => p.revenue || 0);
  const salesCountPoints = chartSeries.map((p) => p.salesCount || 0);

  // Sparkline de ticket médio
  const ticketPoints = chartSeries.map((p) =>
    (p.salesCount || 0) > 0 ? (p.revenue || 0) / p.salesCount : 0
  );

  // Sparkline de conversão ou atividade
  const conversionRate = commercialMetrics?.conversionRate;
  const approvedSales = commercialMetrics?.approvedSales;
  const totalPixGenerated = conversionRate?.totalPixGerados ?? 0;
  const totalPixPaid = conversionRate?.totalPixPagos ?? approvedSales?.count ?? 0;
  const conversionRatePercent =
    conversionRate?.ratePercent ??
    (totalPixGenerated > 0 ? Math.round((totalPixPaid / totalPixGenerated) * 100) : null);

  const conversionPoints = chartSeries.map((p) =>
    (p.salesCount || 0) > 0 ? Math.min(100, (p.salesCount || 0) * 10) : 0
  );

  if (isPending) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 space-y-4 min-h-[170px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/[0.04]" />
              <div className="h-4 bg-white/[0.04] rounded w-24" />
            </div>
            <div className="h-8 bg-white/[0.06] rounded w-36" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 bg-white/[0.04] rounded-full w-16" />
              <div className="h-6 bg-white/[0.03] rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const revenueVal = kpis?.revenue?.formatted || formatBRL(kpis?.revenue?.value || 0);
  const salesVal = kpis?.salesCount?.formatted || String(kpis?.salesCount?.value || 0);
  const ticketVal = kpis?.averageTicket?.formatted || formatBRL(kpis?.averageTicket?.value || 0);
  const convVal = conversionRatePercent !== null ? `${conversionRatePercent}%` : "—";

  return (
    <section aria-label="Indicadores chave de desempenho (KPIs)" className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Receita Bruta */}
        <KpiCardItem
          title="Receita bruta"
          tooltipText="Soma total de todos os pagamentos aprovados no período selecionado."
          value={revenueVal}
          icon={DollarSign}
          iconColorClass="text-[#3984FF] bg-blue-500/10 border-blue-500/20"
          changePercent={kpis?.revenue?.changePercent}
          trend={kpis?.revenue?.trend}
          periodLabel={periodLabel}
          sparklineData={revenuePoints}
          sparklineColor="#3984FF"
        />

        {/* KPI 2: Vendas Aprovadas */}
        <KpiCardItem
          title="Vendas aprovadas"
          tooltipText="Quantidade total de pedidos pagos e confirmados na loja."
          value={salesVal}
          icon={ShoppingBag}
          iconColorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          changePercent={kpis?.salesCount?.changePercent}
          trend={kpis?.salesCount?.trend}
          periodLabel={periodLabel}
          sparklineData={salesCountPoints}
          sparklineColor="#10B981"
        />

        {/* KPI 3: Ticket Médio */}
        <KpiCardItem
          title="Ticket médio"
          tooltipText="Média faturada por cada venda aprovada (Receita bruta ÷ Pedidos pagos)."
          value={ticketVal}
          icon={CreditCard}
          iconColorClass="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
          changePercent={kpis?.averageTicket?.changePercent}
          trend={kpis?.averageTicket?.trend}
          periodLabel={periodLabel}
          sparklineData={ticketPoints}
          sparklineColor="#818CF8"
        />

        {/* KPI 4: Conversão Pix */}
        <KpiCardItem
          title="Conversão Pix"
          tooltipText="Percentual de cobranças Pix geradas que foram efetivamente pagas."
          value={convVal}
          icon={Zap}
          iconColorClass="text-amber-400 bg-amber-500/10 border-amber-500/20"
          changePercent={totalPixGenerated > 0 ? conversionRatePercent : null}
          trend={conversionRatePercent && conversionRatePercent >= 50 ? "up" : "neutral"}
          periodLabel={periodLabel}
          sparklineData={conversionPoints}
          sparklineColor="#F59E0B"
        />
      </div>
    </section>
  );
}

