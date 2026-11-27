"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import {
  SolarSellerOverviewIcon,
  SolarSellerBotIcon,
  SolarSellerWelcomeIcon,
  SolarSellerBannersIcon,
  SolarSellerProductsIcon,
  SolarSellerCombosIcon,
  SolarSellerVideosIcon,
  SolarSellerCarouselsIcon,
  SolarSellerCategoriesIcon,
  SolarSellerClipsIcon,
  SolarSellerNotificationsIcon,
  SolarSellerCouponsIcon,
  SolarSellerPersonalizeIcon,
  type SolarIconProps,
} from "@/components/icons/solar/seller-icons";

/**
 * Navegação do Redesign V2 das abas do bot.
 * Renderizada SOMENTE para a conta proprietária (ver `useRedesignV2` em SingleBotClient).
 * Visual igual ao clássico (ícone + nome, sublinhado na aba ativa); muda só a ordem das abas,
 * que ficam agrupadas por assunto, sem títulos nem separadores.
 * Os ids das abas são os mesmos da navegação clássica (BotTabsNav), então a URL `?tab=` continua compatível.
 */

export interface BotTabV2 {
  id: string;
  label: string;
  icon: React.ComponentType<SolarIconProps>;
}

export interface BotTabGroupV2 {
  id: string;
  /** Nome do grupo: usado só na folha do celular, não aparece na barra do computador. */
  label: string;
  tabs: BotTabV2[];
}

export function buildBotTabGroupsV2(opts: { isAdmin: boolean; mode?: string; showPersonalization?: boolean }): BotTabGroupV2[] {
  const isMiniApp = (opts.mode || "MINI_APP") === "MINI_APP";

  const groups: BotTabGroupV2[] = [
    {
      id: "bot",
      label: "Bot",
      tabs: [
        { id: "visao-geral", label: "Visão geral", icon: SolarSellerOverviewIcon },
        { id: "configuracao", label: "Configuração", icon: SolarSellerBotIcon },
        ...(opts.showPersonalization && isMiniApp ? [{ id: "personalizacao", label: "Personalização", icon: SolarSellerPersonalizeIcon }] : []),
        { id: "boas-vindas", label: "Boas-vindas", icon: SolarSellerWelcomeIcon },
      ],
    },
  ];

  if (isMiniApp) {
    groups.push(
      {
        id: "catalogo",
        label: "Catálogo",
        tabs: [
          { id: "produtos", label: "Produtos", icon: SolarSellerProductsIcon },
          ...(opts.isAdmin ? [{ id: "categorias", label: "Categorias", icon: SolarSellerCategoriesIcon }] : []),
          { id: "combos", label: "Combos", icon: SolarSellerCombosIcon },
          { id: "cupons", label: "Cupons", icon: SolarSellerCouponsIcon },
        ],
      },
      {
        id: "vitrine",
        label: "Vitrine do Mini App",
        tabs: [
          { id: "banners", label: "Banners", icon: SolarSellerBannersIcon },
          { id: "carrosseis", label: "Carrosséis", icon: SolarSellerCarouselsIcon },
          { id: "notificacoes", label: "Notificações", icon: SolarSellerNotificationsIcon },
        ],
      },
      {
        id: "midia",
        label: "Mídia",
        tabs: [
          { id: "videos", label: "Biblioteca de Vídeos", icon: SolarSellerVideosIcon },
          { id: "clips", label: "Clipes", icon: SolarSellerClipsIcon },
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
  showPersonalization?: boolean;
}

export default function BotTabsNavV2({ activeTab, onSelectTab, isAdmin, mode = "MINI_APP", showPersonalization = false }: BotTabsNavV2Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = buildBotTabGroupsV2({ isAdmin, mode, showPersonalization });

  const flat = groups.flatMap((g) => g.tabs);
  const current = flat.find((t) => t.id === activeTab) || flat[0];
  const CurrentIcon = current.icon;

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
      {/* Celular / tablet: seletor único + folha inferior */}
      <div className="block lg:hidden w-full pt-1">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label="Abrir seções do bot"
          className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] bg-[#141416] hover:bg-[#18181D] border border-white/[0.08] hover:border-white/20 transition-colors text-left cursor-pointer"
        >
          <span className="flex items-center gap-3 min-w-0">
            <CurrentIcon className="w-5 h-5 text-[#3984FF] shrink-0" size={20} />
            <span className="text-sm font-semibold text-white truncate">{current.label}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.8} />
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            <div
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/75 animate-in fade-in duration-200"
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Seções do bot"
              className="fixed inset-x-0 bottom-0 z-[201] bg-[#141417] border-t border-white/10 rounded-t-[28px] px-5 pt-3 pb-8 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 overscroll-contain"
            >
              <div className="w-12 h-1.5 rounded-full bg-zinc-600/70 mx-auto mb-3 shrink-0" />
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
                <h3 className="text-base font-bold text-white">Seções do bot</h3>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-1">
                {groups.map((g) => (
                  <div key={g.id} className="space-y-1">
                    {g.tabs.map((t) => {
                      const Icon = t.icon;
                      const isActive = t.id === current.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => select(t.id)}
                          aria-current={isActive ? "page" : undefined}
                          className="group w-full flex items-center justify-between min-h-[48px] px-3.5 rounded-xl text-left cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08]"
                        >
                          <span className="flex items-center gap-3.5 min-w-0">
                            <Icon
                              size={20}
                              className={`w-5 h-5 shrink-0 ${isActive ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"}`}
                            />
                            <span className={`text-sm truncate ${isActive ? "font-semibold text-white" : "font-medium text-zinc-300 group-hover:text-white"}`}>
                              {t.label}
                            </span>
                          </span>
                          {isActive && <Check className="w-4 h-4 text-[#3984FF] stroke-[2.5] shrink-0" />}
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

      {/* Computador: ícone + nome, sublinhado na aba ativa */}
      <nav aria-label="Seções do bot" className="hidden lg:block w-full overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center gap-1 min-w-max">
          {groups.map((g) => (
            <React.Fragment key={g.id}>
              {g.tabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === current.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTab(t.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm transition-colors cursor-pointer select-none whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#60a5fa] ${
                      isActive ? "text-white font-semibold" : "text-zinc-400 hover:text-white font-medium"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    />
                    <span>{t.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3984FF] rounded-full" />
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </nav>
    </>
  );
}
