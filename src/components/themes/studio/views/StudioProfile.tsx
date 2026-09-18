"use client";

import React from "react";
import { HelpCircle, ChevronRight } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

export function StudioProfile({ storeSlug }: { storeSlug: string }) {
  const { user } = useTelegram();

  const tgUser = user as {
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  } | null;

  const fullName = tgUser
    ? `${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim()
    : "Usuário Telegram";
  const initial = tgUser?.first_name ? tgUser.first_name.charAt(0).toUpperCase() : "U";
  const photoUrl = tgUser?.photo_url || null;

  return (
    <div className="p-4 pt-8 w-full">
      <h1 className="text-2xl font-bold mb-6">Perfil</h1>

      {/* User card */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-800 shadow-lg flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-white">{initial}</span>
          )}
        </div>
        <div>
          <h2 className="font-bold text-lg text-white">{fullName}</h2>
          <p className="text-zinc-500 text-sm">
            {tgUser?.username ? `@${tgUser.username}` : "Sem username"}
          </p>
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-3">
        <div className="bg-zinc-900 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors border border-white/5">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-zinc-400" />
            <span className="font-medium text-white">Ajuda &amp; Suporte</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
    </div>
  );
}
