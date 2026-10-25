"use client";

import React from "react";
import { 
  CheckCircle2, 
  TrendingUp, 
  Bot, 
  CreditCard, 
  BarChart3
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";

interface CommercialMetricsCardsProps {
  metrics?: CommercialMetrics | null;
  isPending?: boolean;
}

/**
 * Semicircular Velocímetro for Pix Conversion Rate.
 * Built with pure SVG, dark theme, gray track (#27272A), and purple gradient progress.
 */
function SemicircleGauge({ 
  percentage, 
  isAvailable = true,
  hasError = false,
  totalPaid = 0,
  totalGenerated = 0,
}: { 
  percentage: number | null; 
  isAvailable?: boolean;
  hasError?: boolean;
  totalPaid?: number;
  totalGenerated?: number;
}) {
  const radius = 42;
  const strokeWidth = 8;
  const cx = 55;
  const cy = 50;
  const arcLength = Math.PI * radius; // ~131.95px

  const hasValidData = isAvailable && !hasError && percentage !== null;
  const validPct = hasValidData ? Math.min(Math.max(percentage, 0), 100) : 0;
  const strokeDashoffset = arcLength * (1 - validPct / 100);

  const formattedPct = hasValidData 
    ? (validPct % 1 === 0 ? `${validPct}%` : `${validPct.toFixed(1).replace(".", ",")}%`)
    : (hasError ? "—" : "Sem dados");

  const subText = hasError
    ? "Falha na consulta"
    : hasValidData
    ? `${totalPaid} pagos de ${totalGenerated} Pix`
    : (totalGenerated > 0 ? `0 pagos de ${totalGenerated} Pix` : "0 pagos de 0 Pix");

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0 select-none py-1 max-w-full">
      <div className="relative flex flex-col items-center justify-center w-[115px] sm:w-[120px] h-[60px] sm:h-[65px]">
        <svg 
          viewBox="0 0 110 58" 
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Medidor de conversão: ${hasValidData ? formattedPct : (hasError ? "erro na consulta" : "sem dados")}`}
        >
          <defs>
            <linearGradient id="blueGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
            <filter id="blueGaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#38BDF8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Track (Gray) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#27272A"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Foreground Progress (Blue) */}
          {hasValidData && validPct > 0 && (
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke="url(#blueGaugeGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#blueGaugeGlow)"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Center Percentage / Status Label */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          <span className={`font-mono font-extrabold text-white tracking-tight leading-none wg-tabular ${hasValidData ? "text-lg sm:text-xl" : "text-xs text-zinc-400 font-semibold"}`}>
            {formattedPct}
          </span>
        </div>
      </div>

      {/* Subtitle below speedometer: "X pagos de Y Pix" */}
      <span className="text-[11px] sm:text-xs font-medium text-zinc-400 mt-1.5 text-center tracking-tight truncate max-w-full">
        {subText}
      </span>
    </div>
  );
}

/**
 * Custom dark tooltip for the 7-day performance chart.
 */
function PerformanceTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const rev = Number(item.revenue || 0);
    const count = Number(item.salesCount || 0);

    return (
      <div className="bg-[#141418] border border-white/10 text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[140px]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5 mb-1">
          <span className="font-semibold text-zinc-300 text-[11px]">{item.fullDate || item.dateLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Receita:</span>
          <span className="font-bold text-rose-400 font-mono wg-tabular">
            R$ {rev.toFixed(2).replace(".", ",")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Pedidos:</span>
          <span className="font-bold text-white font-mono wg-tabular">
            {count} {count === 1 ? "pedido" : "pedidos"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function CommercialMetricsCards({ metrics, isPending = false }: CommercialMetricsCardsProps) {
  const approvedSales = metrics?.approvedSales;
  const conversionRate = metrics?.conversionRate;
  const botStarts = metrics?.botStarts;
  const averageTicket = metrics?.averageTicket;

  const period = (metrics?.period || "30D").toUpperCase();
  const performanceSeries = metrics?.performanceSeries || metrics?.last7DaysPerformance || [];

  const totalPeriodRevenue = performanceSeries.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const hasSeriesSales = totalPeriodRevenue > 0 || performanceSeries.some((p) => (p.salesCount || 0) > 0);

  const periodConfigMap: Record<string, { subtitle: string; badge: string; footer: string; emptyText: string }> = {
    TODAY: {
      subtitle: "Hoje",
      badge: "Total Hoje",
      footer: "Hoje (por horário)",
      emptyText: "Sem vendas hoje",
    },
    "7D": {
      subtitle: "Últimos 7 dias",
      badge: "Total 7D",
      footer: "7 dias corridos",
      emptyText: "Sem vendas nos últimos 7 dias",
    },
    "30D": {
      subtitle: "Últimos 30 dias",
      badge: "Total 30D",
      footer: "30 dias corridos",
      emptyText: "Sem vendas nos últimos 30 dias",
    },
    "90D": {
      subtitle: "Últimos 90 dias",
      badge: "Total 90D",
      footer: "90 dias corridos",
      emptyText: "Sem vendas nos últimos 90 dias",
    },
    "12M": {
      subtitle: "Últimos 12 meses",
      badge: "Total 12M",
      footer: "12 meses",
      emptyText: "Sem vendas nos últimos 12 meses",
    },
    ALL: {
      subtitle: "Todo o histórico",
      badge: "Total Geral",
      footer: "Todo o histórico",
      emptyText: "Sem vendas registradas no histórico",
    },
  };

  const periodConfig = periodConfigMap[period] || periodConfigMap["30D"];


  return (
    <div className="w-full max-w-full space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-300">
            Métricas Comerciais
          </h2>
        </div>
        <span className="text-[11px] text-zinc-500 font-medium">
          Isolamento por loja autenticada
        </span>
      </div>

      {/* Main 2-Area Grid:
          - Left (Desktop lg:col-span-2 / 40% width): 4 Cards in 2x2 Grid (2fr)
          - Right (Desktop lg:col-span-3 / 60% width): "Seu Desempenho" Performance Chart matching full height (3fr) 
      */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 w-full max-w-full items-stretch">

        {/* =========================================================================
            COLUNA ESQUERDA: 4 CARDS (2 colunas x 2 linhas - 40% da largura)
           ========================================================================= */}
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 h-full">

            {/* CARD 1: VENDAS APROVADAS (Superior Esquerdo) */}
            <div 
              className="relative bg-[#0E0E11] border border-white/[0.06] hover:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[155px] sm:min-h-[160px] h-full"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.02) 50%, transparent 80%), #0E0E11`
              }}
            >
              {isPending ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block truncate">
                        Vendas Aprovadas
                      </span>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Exclusivamente pagamentos confirmados
                      </p>
                    </div>
                    <div className="shrink-0 text-emerald-400 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="my-auto py-1">
                    <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                      {approvedSales?.formatted || "R$ 0,00"}
                    </div>
                  </div>

                  {approvedSales?.hasTargetGoal && approvedSales.targetGoal && (
                    <div className="pt-2 mt-auto border-t border-white/[0.04] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-medium">Meta comercial</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {approvedSales.targetProgressPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${approvedSales.targetProgressPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CARD 2: TAXA DE CONVERSÃO (Superior Direito) */}
            <div 
              className="relative bg-[#0E0E11] border border-white/[0.06] hover:border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[155px] sm:min-h-[160px] h-full"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(14, 165, 233, 0.12) 0%, rgba(14, 165, 233, 0.02) 50%, transparent 80%), #0E0E11`
              }}
            >
              {isPending ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block truncate">
                        Taxa de Conversão
                      </span>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Cobranças Pix vs pagamentos aprovados
                      </p>
                    </div>
                    <div className="shrink-0 text-sky-400 mt-0.5">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="my-auto py-1 flex flex-col items-center justify-center">
                    <SemicircleGauge 
                      percentage={conversionRate?.ratePercent ?? null} 
                      isAvailable={Boolean(conversionRate?.isTelemetryAvailable && !conversionRate?.hasError)}
                      hasError={Boolean(conversionRate?.hasError)}
                      totalPaid={conversionRate?.totalPixPagos ?? conversionRate?.convertedOrders ?? 0}
                      totalGenerated={conversionRate?.totalPixGerados ?? conversionRate?.totalVisits ?? 0}
                    />
                  </div>
                </>
              )}
            </div>

            {/* CARD 3: TOTAL DE STARTS (Inferior Esquerdo) */}
            <div 
              className="relative bg-[#0E0E11] border border-white/[0.06] hover:border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[155px] sm:min-h-[160px] h-full"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.02) 50%, transparent 80%), #0E0E11`
              }}
            >
              {isPending ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block truncate">
                        Total de Starts
                      </span>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Inícios de conversa nos bots da loja
                      </p>
                    </div>
                    <div className="shrink-0 text-purple-400 mt-0.5">
                      <Bot className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="my-auto py-1">
                    <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                      {botStarts?.formatted || "0"}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {botStarts?.isTelemetryAvailable 
                        ? ((botStarts.totalStarts || 0) === 0 
                            ? "Nenhum start registrado" 
                            : `${botStarts.uniqueUsers} ${botStarts.uniqueUsers === 1 ? 'usuário único' : 'usuários únicos'}`)
                        : "Webhook sem persistência de eventos"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* CARD 4: TICKET MÉDIO (Inferior Direito) */}
            <div 
              className="relative bg-[#0E0E11] border border-white/[0.06] hover:border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[155px] sm:min-h-[160px] h-full"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.02) 50%, transparent 80%), #0E0E11`
              }}
            >
              {isPending ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block truncate">
                        Ticket Médio
                      </span>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Receita aprovada / pedidos pagos
                      </p>
                    </div>
                    <div className="shrink-0 text-amber-400 mt-0.5">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="my-auto py-1">
                    <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                      {averageTicket?.formatted || "R$ 0,00"}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {averageTicket?.consideredSalesCount
                        ? `${averageTicket.consideredSalesCount} ${averageTicket.consideredSalesCount === 1 ? 'venda considerada' : 'vendas consideradas'}`
                        : "Média por pedido aprovado"}
                    </p>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* =========================================================================
            COLUNA DIREITA: GRÁFICO SEU DESEMPENHO (60% da largura)
           ========================================================================= */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <div 
            className="bg-[#0E0E11] border border-white/[0.06] hover:border-rose-500/30 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm transition-all flex flex-col justify-between h-full relative overflow-hidden min-h-[320px] sm:min-h-[340px]"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 95% 8%, rgba(244, 63, 94, 0.10) 0%, rgba(244, 63, 94, 0.02) 50%, transparent 80%), #0E0E11`
            }}
          >
            {/* Header: Title + Subtitle + Total Badge */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Seu Desempenho</h3>
                  <p className="text-xs text-zinc-400">{periodConfig.subtitle}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">
                  {periodConfig.badge}
                </span>
                <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono wg-tabular">
                  R$ {totalPeriodRevenue.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Performance Area Chart */}
            <div className="flex-1 min-h-[190px] sm:min-h-[210px] w-full flex items-center justify-center py-1 sm:py-2">
              {isPending ? (
                <div className="h-full w-full bg-white/[0.02] rounded-xl animate-pulse flex items-center justify-center text-zinc-500 text-xs">
                  Carregando desempenho...
                </div>
              ) : !hasSeriesSales ? (
                <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-[#141418]/40 rounded-xl border border-white/[0.04] space-y-1.5 my-auto">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-white/10 flex items-center justify-center text-zinc-500">
                    <BarChart3 className="w-4 h-4 opacity-50" />
                  </div>
                  <p className="text-zinc-300 text-xs font-semibold">{periodConfig.emptyText}</p>
                  <p className="text-zinc-500 text-[11px] max-w-xs leading-relaxed">
                    Quando novos pedidos forem aprovados, a curva de receita aparecerá aqui.
                  </p>
                </div>
              ) : (
                <div className="w-full h-48 sm:h-52 md:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={performanceSeries}
                      margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="rosePerformanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
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
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) =>
                          val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val}`
                        }
                      />
                      <RechartsTooltip content={<PerformanceTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#F43F5E"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#rosePerformanceGrad)"
                        dot={{ r: 3, fill: "#F43F5E", stroke: "#0E0E11", strokeWidth: 1.5 }}
                        activeDot={{
                          r: 5,
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                          fill: "#F43F5E"
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="pt-2.5 mt-auto border-t border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Receita confirmada
              </span>
              <span className="font-mono text-zinc-400">
                {periodConfig.footer}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
