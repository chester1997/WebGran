"use client";

import React, { useState, useEffect } from "react";
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
  type SolarIconProps,
} from "@/components/icons/solar/seller-icons";
import { 
  ChevronDown,
  X,
  Check
} from "lucide-react";

export interface TabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<SolarIconProps>;
}

interface BotTabsNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  isAdmin: boolean;
  mode?: "MINI_APP" | string;
}

export default function BotTabsNav({
  activeTab,
  onSelectTab,
  isAdmin,
  mode = "MINI_APP",
}: BotTabsNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Trava scroll do body e escuta tecla Escape quando o bottom sheet estiver aberto
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setSheetOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [sheetOpen]);

  // GRUPO 1: GERENCIAMENTO DO BOT (Conversas removida da barra horizontal, acessível via botão dedicado no header)
  const botManagementTabs: TabDefinition[] = [
    { id: "visao-geral", label: "Visão geral", icon: SolarSellerOverviewIcon },
    { id: "configuracao", label: "Configuração", icon: SolarSellerBotIcon },
    { id: "boas-vindas", label: "Boas-vindas", icon: SolarSellerWelcomeIcon },
  ];

  // GRUPO 2: MINI APP (Visível quando mode === 'MINI_APP')
  const isMiniApp = mode === "MINI_APP";
  const miniAppTabs: TabDefinition[] = isMiniApp
    ? [
        { id: "banners", label: "Banners", icon: SolarSellerBannersIcon },
        { id: "produtos", label: "Produtos", icon: SolarSellerProductsIcon },
        { id: "combos", label: "Combos", icon: SolarSellerCombosIcon },
        { id: "videos", label: "Biblioteca de Vídeos", icon: SolarSellerVideosIcon },
        { id: "carrosseis", label: "Carrosséis", icon: SolarSellerCarouselsIcon },
        ...(isAdmin ? [{ id: "categorias", label: "Categorias", icon: SolarSellerCategoriesIcon }] : []),
        { id: "clips", label: "Clipes", icon: SolarSellerClipsIcon },
        { id: "notificacoes", label: "Notificações", icon: SolarSellerNotificationsIcon },
        { id: "cupons", label: "Cupons", icon: SolarSellerCouponsIcon },
      ]
    : [];

  const allTabs: TabDefinition[] = [...botManagementTabs, ...miniAppTabs];
  const currentTab = allTabs.find((t) => t.id === activeTab) || botManagementTabs[0];
  const CurrentIcon = currentTab.icon;

  return (
    <>
      {/* ========================================================= */}
      {/* 1. SELETOR MOBILE "Seções do bot" + BOTTOM SHEET (Mobile)  */}
      {/* ========================================================= */}
      <div className="block lg:hidden w-full pt-1">
        {/* Botão seletor fechado — minimalista, sem texto 'SEÇÕES DO BOT' e sem card atrás do ícone */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 sm:py-3.5 rounded-[10px] bg-[#141416] hover:bg-[#18181D] border border-white/[0.08] hover:border-white/20 transition-all text-left group shadow-sm active:scale-[0.99] cursor-pointer"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label="Abrir seções do bot"
        >
          <div className="flex items-center gap-3 min-w-0">
            <CurrentIcon className="w-5 h-5 text-[#3984FF] shrink-0" size={20} />
            <span className="text-sm font-semibold text-white truncate">
              {currentTab.label}
            </span>
          </div>

          <div className="flex items-center text-zinc-400 group-hover:text-white transition-colors shrink-0">
            <ChevronDown className="w-4 h-4" strokeWidth={1.8} />
          </div>
        </button>

        {/* BOTTOM SHEET: Painel inferior com backdrop e lista vertical */}
        {sheetOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            {/* Backdrop escurecido com desfoque */}
            <div
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
              aria-hidden="true"
            />

            {/* Painel inferior (Bottom Sheet) */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Seções do bot"
              className="fixed inset-x-0 bottom-0 z-[201] bg-[#141417] border-t border-white/10 rounded-t-[28px] p-5 pb-8 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 outline-none overscroll-contain"
            >
              {/* Puxador central decorativo */}
              <div className="w-12 h-1.5 rounded-full bg-zinc-600/70 mx-auto mb-3 shrink-0" />

              {/* Cabeçalho do Bottom Sheet */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Seções do bot</h3>
                  <p className="text-xs text-zinc-400">Escolha a área que deseja gerenciar</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Fechar painel"
                  aria-label="Fechar painel"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>

              {/* Lista Vertical de Seções: Scrollbar invisível e sem containers atrás dos ícones */}
              <div className="flex-1 overflow-y-auto overscroll-contain py-2 space-y-1 scrollbar-hide min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {allTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(tab.id);
                        setSheetOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer text-left min-h-[48px] bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] border border-transparent group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Icon
                          size={20}
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive
                              ? "text-[#3984FF]"
                              : "text-zinc-400 group-hover:text-zinc-200"
                          }`}
                        />
                        <span
                          className={`text-sm truncate transition-colors ${
                            isActive
                              ? "font-semibold text-white"
                              : "font-medium text-zinc-300 group-hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </span>
                      </div>

                      {isActive && (
                        <Check className="w-4 h-4 text-[#3984FF] stroke-[2.5] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. NAVEGAÇÃO HORIZONTAL CLÁSSICA (Desktop >= lg)            */}
      {/* ========================================================= */}
      <nav className="hidden lg:block w-full overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center gap-1 sm:gap-2 min-w-max">
          {/* GRUPO 1: Gerenciamento do Bot */}
          <div className="flex items-center gap-1">
            {botManagementTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`group relative inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none whitespace-nowrap ${
                    isActive
                      ? "text-white font-semibold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon
                    size={16}
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  />
                  <span>{tab.label}</span>

                  {/* Indicador de aba ativa: linha inferior contínua e nítida no azul WebGran */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3984FF] rounded-full transition-all" />
                  )}
                </button>
              );
            })}
          </div>

          {/* GRUPO 2: Recursos do Mini App */}
          {isMiniApp && (
            <div className="flex items-center gap-1">
              {miniAppTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`group relative inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none whitespace-nowrap ${
                      isActive
                        ? "text-white font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    />
                    <span>{tab.label}</span>

                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3984FF] rounded-full transition-all" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
