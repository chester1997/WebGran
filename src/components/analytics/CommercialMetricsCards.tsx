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
import { formatCivilDateToBR } from "@/lib/analytics/timezone-utils";

interface CommercialMetricsCardsProps {
  metrics?: CommercialMetrics | null;
  isPending?: boolean;
}

/**
 * Semicircular Velocímetro for Pix Conversion Rate.
 * Built with pure SVG, dark theme, neutral track (#25272B), and subtle blue progress.
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
  const strokeWidth = 7;
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
    <div className="relative flex flex-col items-center justify-center shrink-0 select-none py-0.5 sm:py-1 max-w-full">
      <div className="relative flex flex-col items-center justify-center w-[92px] xs:w-[105px] sm:w-[120px] h-[50px] xs:h-[57px] sm:h-[65px]">
        <svg 
          viewBox="0 0 110 58" 
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Medidor de conversão: ${hasValidData ? formattedPct : (hasError ? "erro na consulta" : "sem dados")}`}
        >
          {/* Background Track (Dark Neutral) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#25272B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Foreground Progress (Subtle Electric Blue) */}
          {hasValidData && validPct > 0 && (
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Center Percentage / Status Label */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          <span className={`font-mono font-bold text-[#F3F4F6] tracking-tight leading-none wg-tabular ${hasValidData ? "text-base sm:text-xl" : "text-[10px] sm:text-xs text-zinc-400"}`}>
            {formattedPct}
          </span>
        </div>
      </div>

      {/* Subtitle below speedometer: "X pagos de Y Pix" */}
      <span className="text-[9px] xs:text-[10px] sm:text-xs font-normal text-zinc-400 mt-1 sm:mt-1.5 text-center tracking-tight truncate max-w-full">
        {subText}
      </span>
    </div>
  );
}

/**
 * Custom dark tooltip for the performance chart with neutral surfaces and high legibility.
 */
function PerformanceTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const rev = Number(item.revenue || 0);
    const count = Number(item.salesCount || 0);

    return (
      <div className="bg-[#151619] border border-[#25272B] text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[140px]">
        <div className="flex items-center justify-between gap-2 border-b border-[#25272B] pb-1.5 mb-1">
          <span className="font-medium text-zinc-300 text-[11px]">{item.fullDate || item.dateLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Receita:</span>
          <span className="font-bold text-[#F3F4F6] font-mono wg-tabular">
            R$ {rev.toFixed(2).replace(".", ",")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Pedidos:</span>
          <span className="font-medium text-zinc-300 font-mono wg-tabular">
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
    THIS_MONTH: {
      subtitle: "Este mês",
      badge: "Total Este Mês",
      footer: "Mês atual em andamento",
      emptyText: "Sem vendas neste mês",
    },
    LAST_MONTH: {
      subtitle: "Mês anterior",
      badge: "Total Mês Anterior",
      footer: "Mês anterior consolidado",
      emptyText: "Sem vendas no mês anterior",
    },
    THIS_YEAR: {
      subtitle: "Este ano",
      badge: "Total Este Ano",
      footer: "Ano atual",
      emptyText: "Sem vendas neste ano",
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

  let periodConfig = periodConfigMap[period];
  if (!periodConfig && period.startsWith("CUSTOM:")) {
    const parts = period.split(":");
    const s = parts[1] ? formatCivilDateToBR(parts[1]) : "";
    const e = parts[2] ? formatCivilDateToBR(parts[2]) : "";
    periodConfig = {
      subtitle: `${s} a ${e}`,
      badge: "Total Período",
      footer: `${s} a ${e}`,
      emptyText: "Sem vendas no período personalizado",
    };
  }
  if (!periodConfig) {
    periodConfig = periodConfigMap["30D"];
  }

  return (
    <div className="w-full max-w-full space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Métricas Comerciais
          </h2>
        </div>
        <span className="text-[11px] text-zinc-500 font-normal">
          Isolamento por loja autenticada
        </span>
      </div>

      {/* Main 2-Area Grid:
          - Left (Desktop lg:col-span-2 / 40% width): 4 Cards in 2x2 Grid (2fr)
          - Right (Desktop lg:col-span-3 / 60% width): "Seu Desempenho" Performance Chart matching full height (3fr) 
      */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5 sm:gap-5 w-full max-w-full items-stretch">

        {/* =========================================================================
            COLUNA ESQUERDA: 4 CARDS (2 colunas x 2 linhas - 40% da largura)
           ========================================================================= */}
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-4 h-full">

            {/* CARD 1: VENDAS APROVADAS (Superior Esquerdo) */}
            <div className="relative bg-[#111214] border border-[#25272B] hover:border-zinc-700/80 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xs transition-colors flex flex-col justify-between overflow-hidden min-h-[145px] sm:min-h-[160px] h-full">
              {isPending ? (
                <div className="space-y-2 sm:space-y-3 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-6 sm:h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] block truncate leading-tight">
                        Vendas Aprovadas
                      </span>
                      <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-500 leading-tight line-clamp-2">
                        Exclusivamente pagamentos confirmados
                      </p>
                    </div>
                    <div className="shrink-0 text-blue-400 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-auto py-0.5 sm:py-1">
                    <div className="text-base xs:text-lg sm:text-2xl xl:text-3xl font-bold text-[#F3F4F6] tracking-tight font-mono wg-tabular truncate">
                      {approvedSales?.formatted || "R$ 0,00"}
                    </div>
                    <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
                      {approvedSales?.count || 0} {(approvedSales?.count || 0) === 1 ? "venda confirmada" : "vendas confirmadas"}
                    </p>
                  </div>

                  {approvedSales?.hasTargetGoal && approvedSales.targetGoal && (
                    <div className="pt-1.5 sm:pt-2 mt-auto border-t border-[#25272B] space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-zinc-400 font-medium truncate">Meta</span>
                        <span className="text-blue-400 font-bold font-mono">
                          {approvedSales.targetProgressPercent}%
                        </span>
                      </div>
                      <div className="h-1 sm:h-1.5 w-full bg-[#151619] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${approvedSales.targetProgressPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CARD 2: TAXA DE CONVERSÃO (Superior Direito) */}
            <div className="relative bg-[#111214] border border-[#25272B] hover:border-zinc-700/80 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xs transition-colors flex flex-col justify-between overflow-hidden min-h-[145px] sm:min-h-[160px] h-full">
              {isPending ? (
                <div className="space-y-2 sm:space-y-3 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-6 sm:h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] block truncate leading-tight">
                        Taxa de Conversão
                      </span>
                      <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-500 leading-tight line-clamp-2">
                        Cobranças Pix vs pagamentos aprovados
                      </p>
                    </div>
                    <div className="shrink-0 text-blue-400 mt-0.5">
                      <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-auto py-0.5 sm:py-1 flex flex-col items-center justify-center">
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
            <div className="relative bg-[#111214] border border-[#25272B] hover:border-zinc-700/80 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xs transition-colors flex flex-col justify-between overflow-hidden min-h-[145px] sm:min-h-[160px] h-full">
              {isPending ? (
                <div className="space-y-2 sm:space-y-3 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-6 sm:h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] block truncate leading-tight">
                        Total de Starts
                      </span>
                      <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-500 leading-tight line-clamp-2">
                        Inícios de conversa nos bots da loja
                      </p>
                    </div>
                    <div className="shrink-0 text-blue-400 mt-0.5">
                      <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-auto py-0.5 sm:py-1">
                    <div className="text-base xs:text-lg sm:text-2xl xl:text-3xl font-bold text-[#F3F4F6] tracking-tight font-mono wg-tabular truncate">
                      {botStarts?.formatted || "0"}
                    </div>
                    <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
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
            <div className="relative bg-[#111214] border border-[#25272B] hover:border-zinc-700/80 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xs transition-colors flex flex-col justify-between overflow-hidden min-h-[145px] sm:min-h-[160px] h-full">
              {isPending ? (
                <div className="space-y-2 sm:space-y-3 animate-pulse">
                  <div className="h-3 sm:h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-6 sm:h-8 bg-white/5 rounded w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] block truncate leading-tight">
                        Ticket Médio
                      </span>
                      <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-500 leading-tight line-clamp-2">
                        Receita aprovada / pedidos pagos
                      </p>
                    </div>
                    <div className="shrink-0 text-blue-400 mt-0.5">
                      <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                  </div>

                  <div className="my-auto py-0.5 sm:py-1">
                    <div className="text-base xs:text-lg sm:text-2xl xl:text-3xl font-bold text-[#F3F4F6] tracking-tight font-mono wg-tabular truncate">
                      {averageTicket?.formatted || "R$ 0,00"}
                    </div>
                    <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">
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
          <div className="bg-[#111214] border border-[#25272B] rounded-2xl p-4 sm:p-5 md:p-6 shadow-xs flex flex-col justify-between h-full relative overflow-hidden min-h-[320px] sm:min-h-[340px]">
            {/* Header: Title + Subtitle + Total Badge */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-[#F3F4F6] tracking-tight">Seu Desempenho</h3>
                  <p className="text-xs text-[#9CA3AF]">{periodConfig.subtitle}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block tracking-wider">
                  {periodConfig.badge}
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#F3F4F6] font-mono wg-tabular">
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
                <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-[#151619] rounded-xl border border-[#25272B] space-y-1.5 my-auto">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-[#25272B] flex items-center justify-center text-zinc-400">
                    <BarChart3 className="w-4 h-4 opacity-70 text-blue-400" />
                  </div>
                  <p className="text-zinc-200 text-xs font-semibold">{periodConfig.emptyText}</p>
                  <p className="text-zinc-400 text-[11px] max-w-xs leading-relaxed">
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
                        <linearGradient id="bluePerformanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2126" vertical={false} />
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
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#bluePerformanceGrad)"
                        dot={{ r: 2.5, fill: "#3B82F6", stroke: "#111214", strokeWidth: 1.5 }}
                        activeDot={{
                          r: 4.5,
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                          fill: "#3B82F6"
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="pt-2.5 mt-auto border-t border-[#25272B] flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Receita confirmada
              </span>
              <span className="font-mono text-zinc-500">
                {periodConfig.footer}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
