"use client";

import React from "react";
import { Filter, Bot, QrCode, CheckCircle2 } from "lucide-react";
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
      <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 min-h-[340px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-36" />
          <div className="h-3 bg-white/[0.03] rounded w-24" />
        </div>
        <div className="space-y-3 my-auto">
          <div className="h-12 bg-white/[0.02] rounded-[8px] w-full" />
          <div className="h-12 bg-white/[0.02] rounded-[8px] w-full" />
          <div className="h-12 bg-white/[0.02] rounded-[8px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Funil de conversão"
      className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 shadow-none flex flex-col justify-between min-h-[340px]"
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3984FF]/10 border border-[#3984FF]/25 text-[#3984FF] text-[11px] font-semibold tabular-nums">
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
        <div className="space-y-3 my-auto">
          {/* Etapa 1: Conversas Iniciadas */}
          <div className="p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-5 h-5 rounded-full bg-[#3984FF]/10 border border-[#3984FF]/25 text-[#3984FF] flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3" />
                </div>
                <span>1. Conversas iniciadas</span>
              </div>
              <span className="font-bold text-white font-sans tabular-nums">
                {totalStarts} {totalStarts === 1 ? "lead" : "leads"}
              </span>
            </div>
            <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-[#3984FF] rounded-full w-full" />
            </div>
          </div>

          {/* Taxa intermediária 1 -> 2 */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-sans tabular-nums -my-1">
            <div className="h-px w-8 bg-white/[0.04]" />
            <span>{startToPixRate !== null ? `${startToPixRate}% geraram Pix` : "—"}</span>
            <div className="h-px w-8 bg-white/[0.04]" />
          </div>

          {/* Etapa 2: Cobranças Pix Geradas */}
          <div className="p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-3 h-3" />
                </div>
                <span>2. Pix gerados</span>
              </div>
              <span className="font-bold text-white font-sans tabular-nums">
                {totalPixGenerated} {totalPixGenerated === 1 ? "cobrança" : "cobranças"}
              </span>
            </div>
            <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(startToPixRate ?? 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Taxa intermediária 2 -> 3 */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-sans tabular-nums -my-1">
            <div className="h-px w-8 bg-white/[0.04]" />
            <span>{pixToPaidRate !== null ? `${pixToPaidRate}% converteram em pagamento` : "—"}</span>
            <div className="h-px w-8 bg-white/[0.04]" />
          </div>

          {/* Etapa 3: Vendas Aprovadas */}
          <div className="p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <span>3. Vendas confirmadas</span>
              </div>
              <span className="font-bold text-emerald-400 font-sans tabular-nums">
                {totalPaid} {totalPaid === 1 ? "venda paga" : "vendas pagas"}
              </span>
            </div>
            <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(overallRate ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Rodapé informativo */}
      <div className="pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-zinc-400 flex items-center justify-between">
        <span>Eficiência do fluxo</span>
        <span className="font-sans font-medium tabular-nums text-zinc-300">
          {totalPaid} de {totalStarts} conversas
        </span>
      </div>
    </section>
  );
}
