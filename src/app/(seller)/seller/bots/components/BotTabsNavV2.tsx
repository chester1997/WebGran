"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";

/**
 * Navegação agrupada do Redesign V2 das abas do bot.
 * Renderizada SOMENTE para a conta proprietária (ver `useRedesignV2` em SingleBotClient).
 * Os ids das abas são os mesmos da navegação clássica (BotTabsNav), então a URL `?tab=` continua compatível.
 */

export interface BotTabV2 {
  id: string;
  label: string;
}

export interface BotTabGroupV2 {
  id: string;
  label: string;
  tabs: BotTabV2[];
}

export function buildBotTabGroupsV2(opts: { isAdmin: boolean; mode?: string }): BotTabGroupV2[] {
  const isMiniApp = (opts.mode || "MINI_APP") === "MINI_APP";

  const groups: BotTabGroupV2[] = [
    {
      id: "bot",
      label: "Bot",
      tabs: [
        { id: "visao-geral", label: "Visão geral" },
        { id: "configuracao", label: "Configuração" },
        { id: "boas-vindas", label: "Boas-vindas" },
      ],
    },
  ];

  if (isMiniApp) {
    groups.push(
      {
        id: "catalogo",
        label: "Catálogo",
        tabs: [
          { id: "produtos", label: "Produtos" },
          ...(opts.isAdmin ? [{ id: "categorias", label: "Categorias" }] : []),
          { id: "combos", label: "Combos" },
          { id: "cupons", label: "Cupons" },
        ],
      },
      {
        id: "vitrine",
        label: "Vitrine do Mini App",
        tabs: [
          { id: "banners", label: "Banners" },
          { id: "carrosseis", label: "Carrosséis" },
          { id: "notificacoes", label: "Notificações" },
        ],
      },
      {
        id: "midia",
        label: "Mídia",
        tabs: [
          { id: "videos", label: "Biblioteca de vídeos" },
          { id: "clips", label: "Clipes" },
        ],
      }
    );
  }

  return groups;
}

interface BotTabsNavV2Props {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  isAdmin: boolean;
  mode?: "PADRAO" | "MINI_APP" | string;
}

export default function BotTabsNavV2({ activeTab, onSelectTab, isAdmin, mode = "MINI_APP" }: BotTabsNavV2Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = buildBotTabGroupsV2({ isAdmin, mode });

  const flat = groups.flatMap((g) => g.tabs.map((t) => ({ ...t, groupLabel: g.label })));
  const current = flat.find((t) => t.id === activeTab) || flat[0];

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const select = (id: string) => {
    onSelectTab(id);
    setSheetOpen(false);
  };

  return (
    <>
      {/* Celular / tablet: seletor único + folha inferior agrupada */}
      <div className="block lg:hidden w-full pt-1">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#131316] border border-[#2e2e34] hover:border-white/20 transition-colors text-left cursor-pointer"
        >
          <span className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b8b94]">
              {current.groupLabel}
            </span>
            <span className="text-[15px] font-semibold text-white truncate">{current.label}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
            Trocar <ChevronDown className="w-4 h-4" strokeWidth={1.8} />
          </span>
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            <div
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/70 animate-in fade-in duration-200"
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Seções do bot"
              className="fixed inset-x-0 bottom-0 z-[201] bg-[#131316] border-t border-[#2e2e34] rounded-t-[22px] px-4 pt-3 pb-8 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 overscroll-contain"
            >
              <div className="flex items-center justify-between pb-2 shrink-0">
                <div className="w-10 h-1 rounded-full bg-zinc-600/70 mx-auto" />
              </div>
              <div className="flex items-center justify-between pb-3 shrink-0">
                <h3 className="text-base font-bold text-white">Seções do bot</h3>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
                {groups.map((g) => (
                  <div key={g.id} className="flex flex-col gap-1">
                    <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b8b94]">
                      {g.label}
                    </span>
                    {g.tabs.map((t) => {
                      const isActive = t.id === current.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => select(t.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`w-full flex items-center justify-between min-h-[46px] px-3 rounded-[10px] text-left text-[15px] cursor-pointer transition-colors ${
                            isActive
                              ? "bg-[#2563eb]/25 text-white font-semibold"
                              : "text-zinc-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <span>{t.label}</span>
                          {isActive && <Check className="w-4 h-4 text-[#60a5fa]" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Computador: grupos lado a lado */}
      <nav aria-label="Seções do bot" className="hidden lg:flex flex-wrap items-end gap-3 w-full pt-1">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1.5">
            <span className="pl-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b8b94]">
              {g.label}
            </span>
            <div className="flex gap-0.5 bg-[#131316] border border-[#232328] rounded-[10px] p-[3px]">
              {g.tabs.map((t) => {
                const isActive = t.id === current.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTab(t.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-3 py-[7px] rounded-[7px] text-[13px] whitespace-nowrap cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#60a5fa] ${
                      isActive
                        ? "bg-[#2563eb] text-white font-semibold"
                        : "text-[#a1a1aa] hover:text-white hover:bg-[#1f1f24]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
