"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { SolarSellerSalesVolumeIcon } from "@/components/icons/solar/seller-icons";

/** Placas de faturamento (conta proprietária): a próxima ainda não alcançada vira a meta do card. */
export const SALES_PLAQUES = [50_000, 500_000, 1_500_000] as const;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Percentual legível: uma casa decimal abaixo de 10%, inteiro acima. */
export function formatGoalPercent(revenue: number, goal: number): string {
  if (goal <= 0) return "0%";
  const pct = Math.max(0, (revenue / goal) * 100);
  if (pct > 0 && pct < 10) return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `${Math.round(pct).toLocaleString("pt-BR")}%`;
}

/** Selo curto da placa: "50K", "500K", "1,5M". */
export function formatPlaqueShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  return `${Math.round(value / 1000).toLocaleString("pt-BR")}K`;
}

/** Nome da placa por extenso: "R$ 50 mil", "R$ 1,5 mi". */
export function formatPlaqueLong(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${Math.round(value / 1000).toLocaleString("pt-BR")} mil`;
}

/** Próxima placa ainda não alcançada (ou a última, quando todas já foram). */
export function nextPlaque(revenue: number): { goal: number; allReached: boolean } {
  const goal = SALES_PLAQUES.find((p) => revenue < p);
  return goal ? { goal, allReached: false } : { goal: SALES_PLAQUES[SALES_PLAQUES.length - 1], allReached: true };
}

/**
 * Card "Volume de vendas" do Redesign V2 — exclusivo da conta proprietária.
 * Mostra o faturamento rumo à próxima placa (50K → 500K → 1,5M), com trilha
 * marcada, cursor luminoso e a lista de placas em "Ver premiações".
 */
export default function SalesVolumeCardV2({ totalRevenue }: { totalRevenue: number }) {
  const [showPlaques, setShowPlaques] = useState(false);
  const revenue = Math.max(0, totalRevenue || 0);
  const { goal, allReached } = nextPlaque(revenue);
  const ratio = Math.min(1, revenue / goal);
  const remaining = Math.max(0, goal - revenue);

  const [intPart, centsPart] = brl(revenue).split(",");
  const pos = `${(ratio * 100).toFixed(2)}%`;

  return (
    <div
      className="relative overflow-hidden p-4 rounded-[18px] border border-white/[0.08]"
      style={{
        background: "linear-gradient(160deg, #161a24 0%, #0f1117 60%, #0c0d12 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -12px rgba(0,0,0,0.7)",
      }}
    >
      {/* marca d'água do ícone e brilho azul */}
      <SolarSellerSalesVolumeIcon
        size={120}
        className="pointer-events-none absolute -right-6 top-6 w-[120px] h-[120px] text-[#3b82f6] opacity-[0.06]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 w-40 h-32 rounded-full"
        style={{ background: "rgba(59,130,246,0.12)", filter: "blur(30px)" }}
      />

      {/* topo: ícone, título e próxima placa */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 flex items-center justify-center">
            <SolarSellerSalesVolumeIcon size={16} className="w-4 h-4 text-[#60a5fa]" />
          </span>
          <span className="text-[13px] font-semibold text-zinc-100 truncate">Volume de vendas</span>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#60a5fa] px-2 py-0.5 rounded-full border border-[#3b82f6]/35 bg-[#3b82f6]/10 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
          {allReached ? "Todas as placas" : `Próxima: ${formatPlaqueShort(goal)}`}
        </span>
      </div>

      {/* valor */}
      <div className="relative mt-3.5">
        <p className="leading-none font-bold text-white tracking-tight tabular-nums">
          <span className="text-[26px]">{intPart}</span>
          <span className="text-[17px] text-zinc-500">,{centsPart}</span>
        </p>
        <p className="mt-1.5 text-[11.5px] text-zinc-500 tabular-nums">
          <span className="text-[#60a5fa] font-semibold">{formatGoalPercent(revenue, goal)}</span> da placa de{" "}
          {formatPlaqueLong(goal)}
        </p>
      </div>

      {/* trilha com marcos e cursor */}
      <div
        role="progressbar"
        aria-label={`Progresso até a placa de ${formatPlaqueLong(goal)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        className="relative mt-4 h-4"
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/[0.08]" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-all duration-700 ease-out"
          style={{
            width: pos,
            background: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 60%, #93c5fd 100%)",
            boxShadow: "0 0 12px rgba(59,130,246,0.65)",
          }}
        />
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-white/25"
            style={{ left: `${t}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-[#3b82f6] transition-all duration-700 ease-out"
          style={{ left: `clamp(8px, ${pos}, calc(100% - 8px))`, boxShadow: "0 0 12px rgba(59,130,246,0.85)" }}
        />
      </div>

      {/* rodapé */}
      <div className="relative mt-3.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-zinc-500 tabular-nums truncate">
          {allReached ? (
            <span className="text-[#60a5fa] font-semibold">Todas as placas conquistadas</span>
          ) : (
            <>
              Faltam <span className="text-zinc-100 font-semibold">{brl(remaining)}</span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setShowPlaques((v) => !v)}
          aria-expanded={showPlaques}
          className="shrink-0 inline-flex items-center gap-1 font-medium text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
        >
          {showPlaques ? "Fechar" : "Ver premiações"}
          <ArrowRight className={`w-3 h-3 transition-transform ${showPlaques ? "rotate-90" : ""}`} />
        </button>
      </div>

      {showPlaques && (
        <ul className="relative mt-3 pt-3 border-t border-white/[0.06] flex flex-col gap-1.5">
          {SALES_PLAQUES.map((p) => {
            const done = revenue >= p;
            const current = !allReached && p === goal;
            return (
              <li key={p} className="flex items-center gap-2 text-[11.5px] tabular-nums">
                <span
                  className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center border ${
                    done
                      ? "bg-[#3b82f6] border-[#3b82f6]"
                      : current
                        ? "border-[#3b82f6] bg-[#3b82f6]/15"
                        : "border-white/20"
                  }`}
                >
                  {done && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className={done || current ? "text-zinc-100 font-medium" : "text-zinc-500"}>
                  Placa {formatPlaqueLong(p)}
                </span>
                <span className="ml-auto text-[10.5px] text-zinc-500">
                  {done ? "Conquistada" : current ? formatGoalPercent(revenue, p) : "Bloqueada"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
