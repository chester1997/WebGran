"use client";

import React from "react";
import Link from "next/link";
import { useTelegram } from "@/app/miniapp/Providers";

interface StudioHeaderProps {
  storeSlug: string;
  storeName: string;
  headerLogoUrl: string | null;
}

export function StudioHeader({ storeSlug, storeName: _storeName, headerLogoUrl: _headerLogoUrl }: StudioHeaderProps) {
  const { user } = useTelegram();

  const tgUser = user as { id?: string | number; telegramId?: string | number; photo_url?: string; first_name?: string } | null;
  const userPhoto = tgUser?.photo_url || null;
  const firstName = tgUser?.first_name || "Usuário";
  const userId = tgUser?.id || tgUser?.telegramId || null;
  const userInitial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  return (
    <header className="shrink-0 sticky top-0 left-0 right-0 z-40 px-2.5 py-2.5 flex items-center justify-between bg-[#0d0e10]/95 backdrop-blur-md border-b border-white/5 shadow-md">
      <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center gap-2.5 group select-none">
        {userPhoto ? (
          <img src={userPhoto} alt="Perfil" className="w-9 h-9 aspect-square rounded-lg object-cover border border-white/20 shadow-md shrink-0" />
        ) : (
          <div className="w-9 h-9 aspect-square rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-white border border-white/20 shrink-0">
            {userInitial}
          </div>
        )}

        <div className="flex flex-col text-left min-w-0">
          <span className="text-white text-xs font-bold tracking-tight truncate leading-tight group-hover:text-zinc-200 transition-colors">
            Olá, {firstName}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium leading-tight">
            {userId ? `ID: ${userId}` : "ID: ---"}
          </span>
        </div>
      </Link>
    </header>
  );
}
