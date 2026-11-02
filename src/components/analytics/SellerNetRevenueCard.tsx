"use client";

import React from "react";
import { ShieldCheck, Percent, HelpCircle } from "lucide-react";
import { FinancialSummary } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerNetRevenueCardProps {
  financialSummary?: FinancialSummary;
  totalGrossFallback?: number;
  salesCountFallback?: number;
  isPending?: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SellerNetRevenueCard({
  financialSummary,
  totalGrossFallback = 0,
  salesCountFallback = 0,
  isPending = false,
}: SellerNetRevenueCardProps) {
  // Dados financeiros calculados
  const gross = financialSummary?.grossRevenue ?? totalGrossFallback;
  const count = financialSummary?.paidOrdersCount ?? salesCountFallback;
  const fee = financialSummary?.platformFeeTotal ?? count * 0.5;
  const net = financialSummary?.netRevenue ?? Math.max(0, gross - fee);
  const marginPct = financialSummary?.netMarginPercent ?? (gross > 0 ? Math.round((net / gross) * 1000) / 10 : 100);

  const hasSales = gross > 0;

  if (isPending) {
    return (
      <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 min-h-[340px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-36" />
          <div className="h-3 bg-white/[0.03] rounded w-24" />
        </div>
        <div className="space-y-3 my-auto">
          <div className="h-10 bg-white/[0.04] rounded w-44" />
          <div className="h-4 bg-white/[0.02] rounded w-full" />
          <div className="h-12 bg-white/[0.03] rounded-[8px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Receita líquida versus bruta"
      className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 shadow-none flex flex-col justify-between min-h-[340px]"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Percent className="w-4 h-4 text-[#3984FF]" />
            <span>Receita líquida vs. bruta</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Split transparente da plataforma</p>
        </div>

        <div className="w-6 h-6 rounded-md bg-white/[0.03] text-zinc-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      </div>

      {!hasSales ? (
        <DashboardEmptyState
          icon={Percent}
          title="Sem faturamento no período"
          description="Quando houver vendas aprovadas, você verá aqui o valor líquido exato creditado na sua conta."
          className="my-auto"
        />
      ) : (
        <div className="space-y-3.5 my-auto">
          {/* Valor Líquido em Destaque Principal */}
          <div className="p-4 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] space-y-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Sua Receita Líquida
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
              {formatBRL(net)}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Margem líquida retida:</span>
              <span className="font-bold text-emerald-400 font-sans tabular-nums">
                {marginPct}%
              </span>
            </div>
          </div>

          {/* Comparativo de Detalhamento */}
          <div className="space-y-2 pt-1 text-xs">
            {/* Receita Bruta */}
            <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))]">
              <span className="text-zinc-400">Receita bruta paga pelos clientes:</span>
              <span className="font-semibold text-white font-sans tabular-nums">
                {formatBRL(gross)}
              </span>
            </div>

            {/* Taxa da Plataforma */}
            <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))]">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span>Taxa da plataforma (R$ 0,50 / venda):</span>
              </div>
              <span className="font-semibold text-rose-400 font-sans tabular-nums">
                - {formatBRL(fee)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé informativo */}
      <div className="pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-zinc-400 flex items-center justify-between">
        <span>Pedidos calculados</span>
        <span className="font-sans font-medium tabular-nums text-zinc-300">
          {count} {count === 1 ? "venda aprovada" : "vendas aprovadas"}
        </span>
      </div>
    </section>
  );
}
