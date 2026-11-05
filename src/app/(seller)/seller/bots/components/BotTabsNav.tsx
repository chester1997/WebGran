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
  Tags,
  Bot,
  Smartphone
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
    { id: "visao-geral", label: "Visão Geral", icon: TrendingUp },
    { id: "conversas", label: "Conversas", icon: MessageSquare },
    { id: "configuracao", label: "Configuração", icon: Settings },
    { id: "boas-vindas", label: "Boas-vindas", icon: Sparkles },
  ];

  // GRUPO 2: MINI APP (Visível apenas quando mode === 'MINI_APP')
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
    <div className="w-full bg-[#111215] border border-white/[0.08] rounded-2xl p-3 shadow-lg space-y-3">
      {/* 1. SEÇÃO GERENCIAMENTO DO BOT */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-1 select-none">
          <Bot className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Gerenciamento do Bot
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {botManagementTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer select-none shrink-0 ${
                  isActive
                    ? "bg-[#3984FF]/15 text-[#3984FF] border border-[#3984FF]/30 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#3984FF]" : "text-zinc-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SEÇÃO MINI APP (Condicional ao tipo de bot MINI_APP) */}
      {isMiniApp && (
        <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 px-1 select-none">
            <Smartphone className="w-3 h-3 text-[#3984FF]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3984FF]/90">
              Recursos do Mini App
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {miniAppTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer select-none shrink-0 ${
                    isActive
                      ? "bg-[#3984FF]/15 text-[#3984FF] border border-[#3984FF]/30 shadow-sm font-bold"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#3984FF]" : "text-zinc-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
