"use client";

import React from "react";
import { 
  CheckCircle2, 
  TrendingUp, 
  Bot, 
  CreditCard, 
  HelpCircle,
  AlertCircle,
  QrCode
} from "lucide-react";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";

interface CommercialMetricsCardsProps {
  metrics?: CommercialMetrics | null;
  isPending?: boolean;
}

/**
 * Minimalist Semicircular Gauge for Conversion Rate.
 * Built with pure SVG, optimized for dark mode with purple accents.
 */
function SemicircleGauge({ 
  percentage, 
  isAvailable 
}: { 
  percentage: number | null; 
  isAvailable: boolean 
}) {
  const radius = 42;
  const strokeWidth = 8;
  const cx = 55;
  const cy = 50;
  const arcLength = Math.PI * radius; // ~131.95px

  const validPct = isAvailable && percentage !== null ? Math.min(Math.max(percentage, 0), 100) : 0;
  const strokeDashoffset = arcLength * (1 - validPct / 100);

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0 w-[110px] h-[65px] select-none">
      <svg 
        viewBox="0 0 110 60" 
        className="w-full h-full overflow-visible"
        aria-label={`Medidor de conversão: ${isAvailable && percentage !== null ? `${percentage}%` : "indisponível"}`}
      >
        <defs>
          <linearGradient id="purpleGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>

        {/* Background Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#27272A"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Foreground Progress */}
        {isAvailable && (
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="url(#purpleGaugeGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${arcLength}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>

      {/* Center Label */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
        <span className="text-base font-bold font-mono text-white leading-none wg-tabular">
          {isAvailable && percentage !== null ? `${percentage.toFixed(1).replace(".", ",")}%` : "—"}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium mt-0.5">
          {isAvailable ? "Taxa" : "Sem dados"}
        </span>
      </div>
    </div>
  );
}

export function CommercialMetricsCards({ metrics, isPending = false }: CommercialMetricsCardsProps) {
  const approvedSales = metrics?.approvedSales;
  const conversionRate = metrics?.conversionRate;
  const botStarts = metrics?.botStarts;
  const averageTicket = metrics?.averageTicket;

  return (
    <div className="w-full max-w-full space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-300">
            Métricas Comerciais
          </h2>
        </div>
        <span className="text-[11px] text-zinc-500 font-medium">
          Isolamento por loja autenticada
        </span>
      </div>

      {/* Responsive 2x2 Grid: 2 columns on desktop/tablet, 1 column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 w-full max-w-full">

        {/* =========================================================================
            CARD 1: VENDAS APROVADAS
           ========================================================================= */}
        <div 
          className="relative bg-[#0E0E11] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[160px]"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(147, 51, 234, 0.12) 0%, rgba(147, 51, 234, 0.03) 50%, transparent 80%), #0E0E11`
          }}
        >
          {isPending ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-8 bg-white/5 rounded w-2/3" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ) : (
            <>
              {/* Top row: Title + Purple Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Vendas Aprovadas
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Exclusivamente pagamentos confirmados
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Main Value in Highlight */}
              <div className="my-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                  {approvedSales?.formatted || "R$ 0,00"}
                </div>
              </div>

              {/* Progress Bar / Commercial Target (Meta) */}
              <div className="pt-2 mt-auto border-t border-white/[0.04] space-y-1.5">
                {approvedSales?.hasTargetGoal && approvedSales.targetGoal ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 font-medium">Meta comercial</span>
                      <span className="text-purple-300 font-bold font-mono">
                        {approvedSales.targetProgressPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
                        style={{ width: `${approvedSales.targetProgressPercent || 0}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>
                      {approvedSales?.count || 0} {approvedSales?.count === 1 ? "pedido confirmado" : "pedidos confirmados"}
                    </span>
                    <span className="italic text-zinc-600">Sem meta configurada</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* =========================================================================
            CARD 2: TAXA DE CONVERSÃO
           ========================================================================= */}
        <div 
          className="relative bg-[#0E0E11] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[160px]"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(147, 51, 234, 0.12) 0%, rgba(147, 51, 234, 0.03) 50%, transparent 80%), #0E0E11`
          }}
        >
          {isPending ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-8 bg-white/5 rounded w-2/3" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ) : (
            <>
              {/* Top row: Title + Purple Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Taxa de Conversão
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Sessões elegíveis vs compras aprovadas
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              {/* Main content: Value + Semicircular Gauge */}
              <div className="flex items-center justify-between gap-4 my-1">
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                    {conversionRate?.formatted || "—"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {conversionRate?.isTelemetryAvailable 
                      ? `${conversionRate.convertedOrders} vendas realizadas`
                      : "Dados de tráfego ausentes"}
                  </p>
                </div>

                {/* Semicircle Gauge */}
                <SemicircleGauge 
                  percentage={conversionRate?.ratePercent ?? null} 
                  isAvailable={Boolean(conversionRate?.isTelemetryAvailable)} 
                />
              </div>

              {/* Footer explanation / Data integrity note */}
              <div className="pt-2 mt-auto border-t border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-500">
                <span className="truncate">
                  {conversionRate?.statusMessage || "Rastreamento de visitas não disponível"}
                </span>
                {!conversionRate?.isTelemetryAvailable && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 shrink-0 ml-1">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Sem telemetria
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* =========================================================================
            CARD 3: TOTAL DE STARTS
           ========================================================================= */}
        <div 
          className="relative bg-[#0E0E11] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[160px]"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(147, 51, 234, 0.12) 0%, rgba(147, 51, 234, 0.03) 50%, transparent 80%), #0E0E11`
          }}
        >
          {isPending ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-8 bg-white/5 rounded w-2/3" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ) : (
            <>
              {/* Top row: Title + Purple Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Total de Starts
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Inícios de conversa nos bots da loja
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-400">
                  <Bot className="w-5 h-5" />
                </div>
              </div>

              {/* Main Value in Highlight */}
              <div className="my-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                  {botStarts?.formatted || "0"}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {botStarts?.isTelemetryAvailable 
                    ? `${botStarts.uniqueUsers} usuários únicos`
                    : "Webhook sem persistência de eventos"}
                </p>
              </div>

              {/* Footer explanation / Data integrity note */}
              <div className="pt-2 mt-auto border-t border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-500">
                <span className="truncate">
                  {botStarts?.statusMessage || "Eventos de /start não registrados no banco"}
                </span>
                {!botStarts?.isTelemetryAvailable && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 shrink-0 ml-1">
                    <HelpCircle className="w-3 h-3 text-purple-400" />
                    Pendente no webhook
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* =========================================================================
            CARD 4: TICKET MÉDIO
           ========================================================================= */}
        <div 
          className="relative bg-[#0E0E11] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-sm transition-all flex flex-col justify-between overflow-hidden min-h-[160px]"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 95% 10%, rgba(147, 51, 234, 0.12) 0%, rgba(147, 51, 234, 0.03) 50%, transparent 80%), #0E0E11`
          }}
        >
          {isPending ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-8 bg-white/5 rounded w-2/3" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ) : (
            <>
              {/* Top row: Title + Purple Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Ticket Médio
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Receita aprovada / pedidos pagos
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 text-purple-400">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>

              {/* Main Value in Highlight */}
              <div className="my-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono wg-tabular">
                  {averageTicket?.formatted || "R$ 0,00"}
                </div>
              </div>

              {/* Breakdown Indicators: Vendas consideradas, Pix pagos, Pix gerados */}
              <div className="pt-2 mt-auto border-t border-white/[0.04] space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Vendas consideradas:</span>
                  <span className="font-semibold text-white font-mono wg-tabular">
                    {averageTicket?.consideredSalesCount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-400">
                  <span className="flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-purple-400" />
                    Pix: {averageTicket?.approvedPixCount || 0} pagos / {averageTicket?.generatedPixCount || 0} gerados
                  </span>
                  {averageTicket?.pixConversionRatePercent !== null ? (
                    <span className="font-bold text-purple-300 font-mono wg-tabular">
                      {averageTicket?.pixConversionRatePercent}%
                    </span>
                  ) : (
                    <span className="text-zinc-500">0%</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
