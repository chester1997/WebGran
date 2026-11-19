"use client";

import { SolarSellerSalesVolumeIcon } from "@/components/icons/solar/seller-icons";

/** Meta de vendas do card V2 (conta proprietária). */
export const OWNER_SALES_GOAL = 50000;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Percentual legível: uma casa decimal abaixo de 10%, inteiro acima. */
export function formatGoalPercent(revenue: number, goal: number): string {
  if (goal <= 0) return "0%";
  const pct = Math.max(0, (revenue / goal) * 100);
  if (pct > 0 && pct < 10) return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `${Math.round(pct).toLocaleString("pt-BR")}%`;
}

/**
 * Card "Volume de vendas" do Redesign V2 — exclusivo da conta proprietária.
 * Valor em destaque, meta e quanto falta, barra com marcos de 25/50/75%.
 */
export default function SalesVolumeCardV2({ totalRevenue, salesGoal }: { totalRevenue: number; salesGoal: number }) {
  const goal = salesGoal > 0 ? salesGoal : OWNER_SALES_GOAL;
  const revenue = Math.max(0, totalRevenue || 0);
  const ratio = Math.min(1, revenue / goal);
  const reached = revenue >= goal;
  const remaining = Math.max(0, goal - revenue);

  return (
    <div className="p-4 rounded-[14px] bg-[#0F1014] border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#3984FF]/12 flex items-center justify-center shrink-0">
            <SolarSellerSalesVolumeIcon size={16} className="text-[#3984FF]" />
          </span>
          <span className="text-[13px] font-semibold text-zinc-200 truncate">Volume de vendas</span>
        </div>
        <span
          className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${
            reached ? "bg-emerald-500/15 text-emerald-400" : "bg-[#3984FF]/12 text-[#60a5fa]"
          }`}
        >
          {formatGoalPercent(revenue, goal)}
        </span>
      </div>

      <div>
        <p className="text-[20px] leading-tight font-bold text-white tracking-tight tabular-nums">{brl(revenue)}</p>
        <p className="text-[12px] text-zinc-400 tabular-nums">de {brl(goal)}</p>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso da meta de vendas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        className="relative w-full h-2 bg-white/[0.06] rounded-full overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${reached ? "bg-emerald-500" : "bg-[#3984FF]"}`}
          style={{ width: `${Math.max(ratio * 100, revenue > 0 ? 1.5 : 0)}%` }}
        />
        {[25, 50, 75].map((m) => (
          <span key={m} aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-[#0F1014]" style={{ left: `${m}%` }} />
        ))}
      </div>

      <p className="text-[11px] text-zinc-500 tabular-nums">
        {reached ? (
          <span className="text-emerald-400 font-medium">Meta atingida</span>
        ) : (
          <>
            Faltam <span className="text-zinc-300 font-medium">{brl(remaining)}</span> para a meta
          </>
        )}
      </p>
    </div>
  );
}
