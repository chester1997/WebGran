"use client";

import React from "react";
import Link from "next/link";
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
  Ticket 
} from "lucide-react";

export interface TabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}

interface BotTabsNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  isAdmin: boolean;
}

export default function BotTabsNav({
  activeTab,
  onSelectTab,
  isAdmin,
}: BotTabsNavProps) {
  const tabs: TabDefinition[] = [
    { id: "visao-geral", label: "Visão Geral", icon: TrendingUp },
    { id: "conversas", label: "Conversas", icon: MessageSquare },
    { id: "configuracao", label: "Configuração", icon: Settings },
    { id: "boas-vindas", label: "Boas-vindas", icon: Sparkles, href: "/seller/boas-vindas" },
    { id: "banners", label: "Banners", icon: ImageIcon, href: "/seller/banners" },
    { id: "produtos", label: "Produtos", icon: Package, href: "/seller/products" },
    { id: "combos", label: "Combos", icon: Layers, href: "/seller/combos" },
    { id: "videos", label: "Biblioteca de Vídeos", icon: Video, href: "/seller/videos" },
    { id: "carrosseis", label: "Carrosséis", icon: ImageIcon, href: "/seller/carousels" },
    ...(isAdmin ? [{ id: "categorias", label: "Categorias", icon: Package, href: "/seller/categories" }] : []),
    { id: "clips", label: "Clips", icon: Film, href: "/seller/bot/clips" },
    { id: "notificacoes", label: "Notificações", icon: Bell, href: "/seller/bot/notifications" },
    { id: "cupons", label: "Cupons", icon: Ticket, href: "/seller/coupons" },
  ];

  return (
    <div className="w-full bg-[#111215] border border-white/[0.08] rounded-2xl p-2 shadow-lg overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2 select-none"
              >
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
                <span>{tab.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer select-none ${
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
  );
}

