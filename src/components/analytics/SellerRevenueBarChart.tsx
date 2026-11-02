"use client";

import React, { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartPoint } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerRevenueBarChartProps {
  chartSeries?: ChartPoint[];
  periodLabel?: string;
  isPending?: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function RevenueBarTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const rev = Number(item.revenue || 0);
    const count = Number(item.salesCount || 0);

    return (
      <div className="bg-[#151821] border border-white/10 text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[170px] pointer-events-none select-none">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1.5 mb-1">
          <span className="font-semibold text-zinc-200 text-xs truncate">
            {item.fullDate || item.dateLabel}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3984FF] shrink-0" />
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Receita:</span>
          <span className="font-bold text-white font-sans tabular-nums">
            {formatBRL(rev)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Nº de vendas:</span>
          <span className="font-medium text-zinc-300 font-sans tabular-nums">
            {count} {count === 1 ? "venda" : "vendas"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function SellerRevenueBarChart({
  chartSeries = [],
  periodLabel = "Últimos 30 dias",
  isPending = false,
}: SellerRevenueBarChartProps) {
  const totalPeriodRevenue = useMemo(() => {
    return chartSeries.reduce((sum, p) => sum + (p.revenue || 0), 0);
  }, [chartSeries]);

  const totalPeriodSales = useMemo(() => {
    return chartSeries.reduce((sum, p) => sum + (p.salesCount || 0), 0);
  }, [chartSeries]);

  const hasSales = totalPeriodRevenue > 0 || totalPeriodSales > 0;

  if (isPending) {
    return (
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[360px] animate-pulse flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-white/[0.04] rounded w-32" />
            <div className="h-3 bg-white/[0.03] rounded w-20" />
          </div>
          <div className="h-6 bg-white/[0.04] rounded w-28" />
        </div>
        <div className="h-56 bg-white/[0.02] rounded-xl w-full my-auto" />
      </div>
    );
  }

  return (
    <section
      aria-label="Gráfico de receita em barras"
      className="relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none flex flex-col justify-between before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent min-h-[360px]"
    >
      {/* Cabeçalho do Gráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#3984FF]" />
            <span>Evolução da receita</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">{periodLabel}</p>
        </div>

        <div className="sm:text-right">
          <span className="text-[11px] text-zinc-400 block">Total faturado:</span>
          <span className="text-base sm:text-lg font-bold font-sans tabular-nums text-white">
            {formatBRL(totalPeriodRevenue)}
          </span>
        </div>
      </div>

      {/* Área do Gráfico em Barras */}
      <div
        role="img"
        aria-label={`Gráfico de receita em barras: total de ${formatBRL(totalPeriodRevenue)} em ${periodLabel}`}
        className="w-full h-[240px] sm:h-[260px] flex items-center justify-center overflow-hidden"
      >
        {!hasSales ? (
          <DashboardEmptyState
            icon={BarChart2}
            title="Sem vendas no período"
            description="Assim que novos pedidos forem confirmados, as barras de faturamento diário aparecerão aqui."
          />
        ) : (
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartSeries}
                margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255, 255, 255, 0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#71717A"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
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
                <RechartsTooltip
                  content={<RevenueBarTooltip />}
                  cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#3984FF"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

