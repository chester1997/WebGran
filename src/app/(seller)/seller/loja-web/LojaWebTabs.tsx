"use client";

import React, { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { SolarIconProps } from "@/components/icons/solar/seller-icons";

/** Abas da Loja Web no header, no mesmo padrão das abas do bot (folha de baixo para cima no celular). */

export interface LojaWebTab<K extends string> {
  id: K;
  label: string;
  icon: React.ComponentType<SolarIconProps>;
  count?: number | null;
}

export default function LojaWebTabs<K extends string>({ tabs, active, onSelect }: { tabs: LojaWebTab<K>[]; active: K; onSelect: (k: K) => void }) {
  const [sheet, setSheet] = useState(false);
  const current = tabs.find((t) => t.id === active) || tabs[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet]);

  const badge = (n: number | null | undefined, on: boolean) =>
    typeof n === "number" ? <span className={`min-w-[18px] h-[18px] px-1 rounded-[5px] text-[10.5px] font-semibold tabular-nums flex items-center justify-center ${on ? "bg-[#3984FF]/20 text-[#9cc2ff]" : "bg-white/[0.06] text-zinc-400"}`}>{n}</span> : null;

  return (
    <>
      {/* Celular / tablet: seletor único + folha inferior */}
      <div className="block lg:hidden w-full pt-1">
        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          aria-label="Abrir seções da Loja Web"
          className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] bg-[#141416] hover:bg-[#18181D] border border-white/[0.08] hover:border-white/20 transition-colors text-left cursor-pointer"
        >
          <span className="flex items-center gap-3 min-w-0">
            <CurrentIcon className="w-5 h-5 text-[#3984FF] shrink-0" size={20} />
            <span className="text-sm font-semibold text-white truncate">{current.label}</span>
            {badge(current.count, true)}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.8} />
        </button>

        {sheet && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            <div onClick={() => setSheet(false)} className="fixed inset-0 bg-black/75 animate-in fade-in duration-200" aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Seções da Loja Web"
              className="fixed inset-x-0 bottom-0 z-[201] bg-[#141417] border-t border-white/10 rounded-t-[28px] px-5 pt-3 pb-8 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 overscroll-contain"
            >
              <div className="w-12 h-1.5 rounded-full bg-zinc-600/70 mx-auto mb-3 shrink-0" />
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
                <h3 className="text-base font-bold text-white">Seções da Loja Web</h3>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-1">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const on = t.id === current.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelect(t.id);
                        setSheet(false);
                      }}
                      aria-current={on ? "page" : undefined}
                      className="group w-full flex items-center justify-between min-h-[48px] px-3.5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08]"
                    >
                      <span className="flex items-center gap-3.5 min-w-0">
                        <Icon size={20} className={`w-5 h-5 shrink-0 ${on ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"}`} />
                        <span className={`text-sm truncate ${on ? "font-semibold text-white" : "font-medium text-zinc-300 group-hover:text-white"}`}>{t.label}</span>
                        {badge(t.count, on)}
                      </span>
                      {on && <Check className="w-4 h-4 text-[#3984FF] stroke-[2.5] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Computador: ícone + nome, sublinhado na aba ativa */}
      <nav aria-label="Seções da Loja Web" className="hidden lg:block w-full overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = t.id === current.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                aria-current={on ? "page" : undefined}
                className={`group relative inline-flex items-center gap-2 px-3.5 py-3 text-sm transition-colors cursor-pointer select-none whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#60a5fa] ${
                  on ? "text-white font-semibold" : "text-zinc-400 hover:text-white font-medium"
                }`}
              >
                <Icon size={16} className={`w-4 h-4 shrink-0 transition-colors ${on ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"}`} />
                <span>{t.label}</span>
                {badge(t.count, on)}
                {on && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3984FF] rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
