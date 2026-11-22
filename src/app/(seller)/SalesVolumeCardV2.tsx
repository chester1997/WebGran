"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SolarSellerSalesVolumeIcon } from "@/components/icons/solar/seller-icons";
import { brl, formatGoalPercent, formatPlaqueLong, plaqueProgress } from "@/lib/rewards/plaques";

/**
 * Card "Volume de vendas" do Redesign V2 — exclusivo da conta proprietária.
 * Mostra o faturamento rumo à próxima placa (50K → 250K → 500K → 1M → 1,5M), na cor
 * da placa, e leva para a área de Premiações.
 */
export default function SalesVolumeCardV2({ totalRevenue }: { totalRevenue: number }) {
  const revenue = Math.max(0, totalRevenue || 0);
  const { next, allReached } = plaqueProgress(revenue);
  const goal = next.value;
  const ratio = Math.min(1, revenue / goal);
  const remaining = Math.max(0, goal - revenue);
  const t = next.theme;

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
      {/* marca d'água do ícone e brilho na cor da placa */}
      <SolarSellerSalesVolumeIcon
        size={120}
        className="pointer-events-none absolute -right-6 top-6 w-[120px] h-[120px] opacity-[0.07]"
        style={{ color: t.main }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 w-40 h-32 rounded-full"
        style={{ background: `rgba(${t.rgb},0.13)`, filter: "blur(30px)" }}
      />

      {/* topo: ícone, título e próxima placa */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center"
            style={{ borderColor: `rgba(${t.rgb},0.35)`, background: `rgba(${t.rgb},0.12)`, color: t.light }}
          >
            <SolarSellerSalesVolumeIcon size={16} className="w-4 h-4" />
          </span>
          <span className="text-[13px] font-semibold text-zinc-100 truncate">Volume de vendas</span>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border tabular-nums"
          style={{ color: t.light, borderColor: `rgba(${t.rgb},0.4)`, background: `rgba(${t.rgb},0.1)` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.main }} />
          {allReached ? "Todas as placas" : `Próxima: ${next.short}`}
        </span>
      </div>

      {/* valor */}
      <div className="relative mt-3.5">
        <p className="leading-none font-bold text-white tracking-tight tabular-nums">
          <span className="text-[26px]">{intPart}</span>
          <span className="text-[17px] text-zinc-500">,{centsPart}</span>
        </p>
        <p className="mt-1.5 text-[11.5px] text-zinc-500 tabular-nums">
          <span className="font-semibold" style={{ color: t.light }}>{formatGoalPercent(revenue, goal)}</span> da placa de{" "}
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
          style={{ width: pos, background: t.gradient, boxShadow: `0 0 12px rgba(${t.rgb},0.65)` }}
        />
        {[25, 50, 75].map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-white/25"
            style={{ left: `${tick}%` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-[3px] transition-all duration-700 ease-out"
          style={{ left: `clamp(8px, ${pos}, calc(100% - 8px))`, borderColor: t.main, boxShadow: `0 0 12px rgba(${t.rgb},0.85)` }}
        />
      </div>

      {/* rodapé */}
      <div className="relative mt-3.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-zinc-500 tabular-nums truncate">
          {allReached ? (
            <span className="font-semibold" style={{ color: t.light }}>Todas as placas conquistadas</span>
          ) : (
            <>
              Faltam <span className="text-zinc-100 font-semibold">{brl(remaining)}</span>
            </>
          )}
        </span>
        <Link
          href="/seller/premiacoes"
          className="shrink-0 inline-flex items-center gap-1 font-medium text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
        >
          Ver premiações
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
