"use client";

import React, { useState, useEffect } from "react";
import { HelpCircle, ChevronRight } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

export function StudioProfile({ storeSlug }: { storeSlug: string }) {
  const { user } = useTelegram();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cachedUser, setCachedUser] = useState<any>(null);

  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`webgran_tg_user_${storeSlug}`) || localStorage.getItem(`webgran_tg_user_${storeSlug}`);
        if (saved) {
          setCachedUser(JSON.parse(saved));
        }
      } catch (_e) {}
    }
  }, [user, storeSlug]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeUser = (user || cachedUser) as any;
  const firstName = activeUser?.firstName || activeUser?.first_name || "";
  const lastName = activeUser?.lastName || activeUser?.last_name || "";
  const username = activeUser?.username || null;
  const photoUrl = activeUser?.photoUrl || activeUser?.photo_url || null;

  const fullName = firstName ? `${firstName} ${lastName}`.trim() : "Usuário Telegram";
  const initial = firstName ? firstName.charAt(0).toUpperCase() : "U";

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
            {username ? `@${username}` : "Sem username"}
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
