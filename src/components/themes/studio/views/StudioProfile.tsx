"use client";

import React from "react";
import { Settings, HelpCircle, ChevronRight } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

export function StudioProfile({ storeSlug }: { storeSlug: string }) {
  const { user } = useTelegram();

  const tgUser = user as { first_name?: string; last_name?: string; username?: string } | null;
  const fullName = tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : "Usuário Telegram";
  const initial = tgUser?.first_name ? tgUser.first_name.charAt(0).toUpperCase() : "U";

  return (
    <div className="p-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">Perfil</h1>
      
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-xl font-bold shadow-lg border border-white/5">
          {initial}
        </div>
        <div>
          <h2 className="font-bold text-lg text-white">{fullName}</h2>
          <p className="text-zinc-500 text-sm">
            {tgUser?.username ? `@${tgUser.username}` : "Sem username"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-zinc-900 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors border border-white/5">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-zinc-400" />
            <span className="font-medium text-white">Configurações</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
        
        <div className="bg-zinc-900 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors border border-white/5">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-zinc-400" />
            <span className="font-medium text-white">Ajuda & Suporte</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
    </div>
  );
}
