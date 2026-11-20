"use client";

import Link from "next/link";
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

/** Valor curto para caber dentro da barra: "R$ 49,9 mil", "R$ 850". */
export function formatCompactBRL(value: number): string {
  const v = Math.max(0, value);
  if (v >= 1000) {
    const mil = Math.floor((v / 1000) * 10) / 10;
    return `R$ ${mil.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

/**
 * Card "Volume de vendas" do Redesign V2 — exclusivo da conta proprietária.
 * Estilo "cartão de progresso": valor em destaque, barra grossa com brilho azul
 * e o quanto falta escrito dentro da própria barra.
 */
export default function SalesVolumeCardV2({
  totalRevenue,
  salesGoal,
  onNavigate,
}: {
  totalRevenue: number;
  salesGoal: number;
  onNavigate?: (e: React.MouseEvent, href: string) => void;
}) {
  const goal = salesGoal > 0 ? salesGoal : OWNER_SALES_GOAL;
  const revenue = Math.max(0, totalRevenue || 0);
  const ratio = Math.min(1, revenue / goal);
  const reached = revenue >= goal;
  const remaining = Math.max(0, goal - revenue);

  const fill = reached
    ? "linear-gradient(90deg, #059669 0%, #10b981 55%, #6ee7b7 100%)"
    : "linear-gradient(90deg, #1d4ed8 0%, #3984FF 55%, #7cc4ff 100%)";
  const glow = reached ? "0 0 18px rgba(16,185,129,0.55)" : "0 0 18px rgba(57,132,255,0.6)";

  return (
    <div
      className="relative overflow-hidden p-4 rounded-[18px] border border-white/[0.08] space-y-3.5"
      style={{
        background: "linear-gradient(180deg, #1A1C22 0%, #111216 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -12px rgba(0,0,0,0.7)",
      }}
    >
      {/* brilho azul suave no canto */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -bottom-12 w-40 h-32 rounded-full"
        style={{ background: reached ? "rgba(16,185,129,0.12)" : "rgba(57,132,255,0.14)", filter: "blur(28px)" }}
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SolarSellerSalesVolumeIcon size={18} className={reached ? "text-emerald-400 shrink-0" : "text-[#3984FF] shrink-0"} />
          <span className="text-[13px] font-semibold text-zinc-100 truncate">Volume de vendas</span>
        </div>
        <span className="shrink-0 text-[10.5px] font-medium text-zinc-400 px-2 py-0.5 rounded-full border border-white/[0.1] bg-white/[0.03] tabular-nums">
          Meta {formatCompactBRL(goal).replace("R$ ", "")}
        </span>
      </div>

      <div className="relative">
        <p className="text-[26px] leading-none font-bold text-white tracking-tight tabular-nums">{brl(revenue)}</p>
        <p className="mt-1.5 text-[11.5px] text-zinc-500 tabular-nums">
          <span className={reached ? "text-emerald-400 font-semibold" : "text-[#60a5fa] font-semibold"}>
            {formatGoalPercent(revenue, goal)}
          </span>{" "}
          da meta de {brl(goal)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso da meta de vendas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        className="relative w-full h-7 rounded-full bg-white/[0.07] border border-white/[0.05]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: revenue > 0 ? `max(28px, ${ratio * 100}%)` : "0px",
            background: fill,
            boxShadow: `${glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        />
        <span className="absolute inset-y-0 right-3 flex items-center text-[11px] font-medium text-zinc-200 tabular-nums whitespace-nowrap">
          {reached ? "Meta atingida" : `Faltam ${formatCompactBRL(remaining)}`}
        </span>
      </div>

      <div className="relative flex justify-end">
        <Link
          href="/seller/orders"
          onClick={onNavigate ? (e) => onNavigate(e, "/seller/orders") : undefined}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-200 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          Ver vendas
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
