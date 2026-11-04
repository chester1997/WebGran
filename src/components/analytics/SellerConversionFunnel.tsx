"use client";

import React from "react";
import { Filter } from "lucide-react";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerConversionFunnelProps {
  metrics?: CommercialMetrics | null;
  isPending?: boolean;
  className?: string;
}

export function SellerConversionFunnel({
  metrics,
  isPending = false,
  className = "",
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
  const pixToPaidRate = totalPixGenerated > 0 ? Math.round((totalPaid / totalPixGenerated) * 100) : 0;
  const overallRate = totalStarts > 0 ? Math.round((totalPaid / totalStarts) * 100) : null;

  // Média de Pix por pessoa
  const avgPixPerPerson = totalStarts > 0 ? (totalPixGenerated / totalStarts).toFixed(1).replace(".", ",") : "0";

  const hasData = totalStarts > 0 || totalPixGenerated > 0 || totalPaid > 0;

  if (isPending) {
    return (
      <div className={`bg-[#1C1C1E] rounded-[22px] p-6 lg:p-7 animate-pulse h-full ${className}`}>
        <div className="h-5 bg-white/[0.04] rounded w-48 mb-6" />
        <div className="space-y-4">
          <div className="h-10 bg-white/[0.02] rounded-lg w-full" />
          <div className="h-10 bg-white/[0.02] rounded-lg w-full" />
          <div className="h-10 bg-white/[0.02] rounded-lg w-full" />
        </div>
      </div>
    );
  }

  // Larguras das barras baseadas na escala do maior valor (ou totalStarts)
  const maxScale = Math.max(totalStarts, totalPixGenerated, totalPaid, 1);
  const widthStarts = Math.round((totalStarts / maxScale) * 100);
  const widthPix = Math.round((totalPixGenerated / maxScale) * 100);
  const widthPaid = Math.round((totalPaid / maxScale) * 100);

  return (
    <section
      aria-label="Funil de conversão"
      title="Funil de conversão"
      className={`bg-[#1C1C1E] rounded-[18px] sm:rounded-[22px] p-4 sm:p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden ${className}`}
    >
      {/* Topo do Funil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-6">
        <div>
          <h3 className="text-[18px] sm:text-[20px] font-bold text-[var(--apple-text,#fff)] tracking-tight">
            Da conversa ao pagamento
          </h3>
          <p className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] mt-0.5">
            Jornada do visitante pelo bot até a compra confirmada
          </p>
        </div>

        {overallRate !== null && (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--apple-surface-2,#2c2c2e)] text-[12px] sm:text-[13px] font-semibold text-[var(--apple-blue,#0a84ff)] tabular-nums self-start sm:self-auto shrink-0">
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
        <div className="divide-y divide-[var(--apple-separator,rgba(84,84,88,0.25))] my-auto flex-1 flex flex-col justify-around py-2">
          {/* Linha 1: Conversas iniciadas */}
          <div className="py-4 sm:py-5 space-y-2.5">
            <div className="flex items-center justify-between text-[14px] sm:text-[15px]">
              <span className="font-medium text-[var(--apple-text,#fff)]">
                1. Conversas iniciadas
              </span>
              <span className="font-bold text-[var(--apple-text,#fff)] tabular-nums">
                {totalStarts} {totalStarts === 1 ? "lead" : "leads"}
              </span>
            </div>
            <div className="h-[10px] w-full bg-[var(--apple-surface-2,#2c2c2e)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--apple-blue,#0a84ff)] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(widthStarts, 2)}%` }}
              />
            </div>
          </div>

          {/* Linha 2: Pix gerados */}
          <div className="py-4 sm:py-5 space-y-2.5">
            <div className="flex items-center justify-between text-[14px] sm:text-[15px]">
              <span className="font-medium text-[var(--apple-text,#fff)]">
                2. Pix gerados
              </span>
              <div className="flex items-center gap-2">
                {startToPixRate !== null && (
                  <span className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] tabular-nums">
                    ({startToPixRate}%)
                  </span>
                )}
                <span className="font-bold text-[var(--apple-text,#fff)] tabular-nums">
                  {totalPixGenerated} {totalPixGenerated === 1 ? "cobrança" : "cobranças"}
                </span>
              </div>
            </div>
            <div className="h-[10px] w-full bg-[var(--apple-surface-2,#2c2c2e)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--apple-blue,#0a84ff)] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(widthPix, 2)}%` }}
              />
            </div>
          </div>

          {/* Linha 3: Vendas pagas */}
          <div className="py-4 sm:py-5 space-y-2.5">
            <div className="flex items-center justify-between text-[14px] sm:text-[15px]">
              <span className="font-medium text-[var(--apple-text,#fff)]">
                3. Vendas confirmadas
              </span>
              <div className="flex items-center gap-2">
                {pixToPaidRate > 0 && (
                  <span className="text-[12px] sm:text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] tabular-nums">
                    ({pixToPaidRate}%)
                  </span>
                )}
                <span className="font-bold text-[var(--apple-green,#30d158)] tabular-nums">
                  {totalPaid} {totalPaid === 1 ? "venda paga" : "vendas pagas"}
                </span>
              </div>
            </div>
            <div className="h-[10px] w-full bg-[var(--apple-surface-2,#2c2c2e)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--apple-green,#30d158)] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(widthPaid, 2)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Apple */}
      <div className="pt-4 mt-auto border-t border-[var(--apple-separator,rgba(84,84,88,0.25))] text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
        Cada pessoa gerou em média {avgPixPerPerson} Pix, e {pixToPaidRate}% dos Pix foram pagos.
      </div>
    </section>
  );
}
