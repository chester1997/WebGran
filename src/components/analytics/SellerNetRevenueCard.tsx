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
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[340px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-36" />
          <div className="h-3 bg-white/[0.03] rounded w-24" />
        </div>
        <div className="space-y-3 my-auto">
          <div className="h-10 bg-white/[0.04] rounded w-44" />
          <div className="h-4 bg-white/[0.02] rounded w-full" />
          <div className="h-12 bg-white/[0.03] rounded-xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Receita líquida versus bruta"
      className="group relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none flex flex-col justify-between before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent hover:-translate-y-0.5 hover:border-white/10 hover:shadow-xl transition-all duration-200 min-h-[340px]"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <span>Receita líquida vs. bruta</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Split transparente da plataforma</p>
        </div>

        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
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
        <div className="space-y-4 my-auto">
          {/* Valor Líquido em Destaque Principal */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
              Sua Receita Líquida (no seu bolso)
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-sans tracking-tight tabular-nums text-white">
              {formatBRL(net)}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Margem líquida retida:</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {marginPct}%
              </span>
            </div>
          </div>

          {/* Comparativo de Detalhamento */}
          <div className="space-y-2 pt-1 text-xs">
            {/* Receita Bruta */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04]">
              <span className="text-zinc-400">Receita bruta (paga pelos clientes):</span>
              <span className="font-semibold text-white tabular-nums">
                {formatBRL(gross)}
              </span>
            </div>

            {/* Taxa da Plataforma */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span>Taxa WebGran ({count}x R$ 0,50):</span>
              </div>
              <span className="font-semibold text-rose-400 tabular-nums">
                - {formatBRL(fee)}
              </span>
            </div>
          </div>

          {/* Barra de Progresso Visual Líquido vs Taxa */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(marginPct, 100)}%` }}
              />
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${Math.max(0, 100 - marginPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-400 text-center leading-tight">
              Apenas R$ 0,50 por venda aprovada. Zero taxas em pedidos pendentes.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

