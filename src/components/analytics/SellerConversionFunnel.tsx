"use client";

import React from "react";
import { Filter, Bot, QrCode, CheckCircle2, ArrowRight } from "lucide-react";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerConversionFunnelProps {
  metrics?: CommercialMetrics | null;
  isPending?: boolean;
}

export function SellerConversionFunnel({
  metrics,
  isPending = false,
}: SellerConversionFunnelProps) {
  const conversionRate = metrics?.conversionRate;
  const botStarts = metrics?.botStarts;
  const approvedSales = metrics?.approvedSales;

  // 1. Conversas (Leads que iniciaram conversa no bot)
  const totalStarts = botStarts?.uniqueUsers || botStarts?.totalStarts || 0;

  // 2. Pix gerados (Tentativas de compra / checkout)
  const totalPixGenerated = conversionRate?.totalPixGerados ?? 0;

  // 3. Pagos (Vendas confirmadas)
  const totalPaid = conversionRate?.totalPixPagos ?? approvedSales?.count ?? 0;

  // Percentuais de conversão entre etapas
  const startToPixRate = totalStarts > 0 ? Math.round((totalPixGenerated / totalStarts) * 100) : null;
  const pixToPaidRate = totalPixGenerated > 0 ? Math.round((totalPaid / totalPixGenerated) * 100) : null;
  const overallRate = totalStarts > 0 ? Math.round((totalPaid / totalStarts) * 100) : null;

  const hasData = totalStarts > 0 || totalPixGenerated > 0 || totalPaid > 0;

  if (isPending) {
    return (
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[360px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-36" />
          <div className="h-3 bg-white/[0.03] rounded w-24" />
        </div>
        <div className="space-y-4 my-auto">
          <div className="h-14 bg-white/[0.02] rounded-xl w-full" />
          <div className="h-14 bg-white/[0.02] rounded-xl w-full" />
          <div className="h-14 bg-white/[0.02] rounded-xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Funil de conversão"
      className="relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none flex flex-col justify-between before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent min-h-[360px]"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#3984FF]" />
            <span>Funil de conversão</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Da primeira conversa ao pagamento</p>
        </div>

        {overallRate !== null && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3984FF] text-[11px] font-bold tabular-nums">
            <span>{overallRate}% conv. global</span>
          </div>
        )}
      </div>

      {!hasData ? (
        <DashboardEmptyState
          icon={Filter}
          title="Funil sem atividades"
          description="Compartilhe o link do seu bot para que novos visitantes iniciem conversas e gerem pagamentos."
          actionText="Ver link do bot"
          actionHref="/seller/store"
          className="my-auto"
        />
      ) : (
        <div className="space-y-3.5 my-auto">
          {/* Etapa 1: Conversas Iniciadas */}
          <div className="p-3.5 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3984FF] flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <span>1. Conversas iniciadas</span>
              </div>
              <span className="font-bold text-white tabular-nums">
                {totalStarts} {totalStarts === 1 ? "lead" : "leads"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-[#3984FF] rounded-full w-full" />
            </div>
          </div>

          {/* Seta de Transição 1 -> 2 */}
          <div className="flex items-center justify-between px-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3 text-[#3984FF]" />
              <span>Geração de cobrança</span>
            </div>
            <span className="font-semibold text-zinc-300 tabular-nums">
              {startToPixRate !== null ? `${startToPixRate}%` : "—"}
            </span>
          </div>

          {/* Etapa 2: Pix Gerados */}
          <div className="p-3.5 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <span>2. Pix gerados no checkout</span>
              </div>
              <span className="font-bold text-white tabular-nums">
                {totalPixGenerated} {totalPixGenerated === 1 ? "cobrança" : "cobranças"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(startToPixRate || (totalPixGenerated > 0 ? 100 : 0), 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Seta de Transição 2 -> 3 */}
          <div className="flex items-center justify-between px-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span>Taxa de pagamento</span>
            </div>
            <span className="font-semibold text-emerald-400 tabular-nums">
              {pixToPaidRate !== null ? `${pixToPaidRate}%` : "—"}
            </span>
          </div>

          {/* Etapa 3: Pagamentos Concluídos */}
          <div className="p-3.5 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>3. Pagamentos confirmados</span>
              </div>
              <span className="font-bold text-emerald-400 tabular-nums">
                {totalPaid} {totalPaid === 1 ? "venda paga" : "vendas pagas"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(pixToPaidRate || (totalPaid > 0 ? 100 : 0), 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

