"use client";

import React from "react";
import { 
  TrendingUp, 
  MessageSquare, 
  Settings, 
  Sparkles, 
  Image as ImageIcon, 
  Package, 
  Layers, 
  Video, 
  Film, 
  Bell, 
  Ticket,
  Tags
} from "lucide-react";

export interface TabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
  // GRUPO 1: GERENCIAMENTO DO BOT
  const botManagementTabs: TabDefinition[] = [
    { id: "visao-geral", label: "Visão geral", icon: TrendingUp },
    { id: "conversas", label: "Conversas", icon: MessageSquare },
    { id: "configuracao", label: "Configuração", icon: Settings },
    { id: "boas-vindas", label: "Boas-vindas", icon: Sparkles },
  ];

  // GRUPO 2: MINI APP (Visível quando mode === 'MINI_APP')
  const isMiniApp = mode === "MINI_APP";
  const miniAppTabs: TabDefinition[] = isMiniApp
    ? [
        { id: "banners", label: "Banners", icon: ImageIcon },
        { id: "produtos", label: "Produtos", icon: Package },
        { id: "combos", label: "Combos", icon: Layers },
        { id: "videos", label: "Biblioteca de Vídeos", icon: Video },
        { id: "carrosseis", label: "Carrosséis", icon: ImageIcon },
        ...(isAdmin ? [{ id: "categorias", label: "Categorias", icon: Tags }] : []),
        { id: "clips", label: "Clipes", icon: Film },
        { id: "notificacoes", label: "Notificações", icon: Bell },
        { id: "cupons", label: "Cupons", icon: Ticket },
      ]
    : [];

  return (
    <nav className="w-full overflow-x-auto no-scrollbar scroll-smooth">
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
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                />
                <span>{tab.label}</span>

                {/* Indicador de aba ativa: linha inferior contínua e nítida */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full transition-all" />
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
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                  <span>{tab.label}</span>

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full transition-all" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
