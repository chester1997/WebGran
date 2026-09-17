"use client";

import React from "react";
import Link from "next/link";
import { Search, UserCircle } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

interface StudioHeaderProps {
  storeSlug: string;
  storeName: string;
  headerLogoUrl: string | null;
}

export function StudioHeader({ storeSlug, storeName, headerLogoUrl }: StudioHeaderProps) {
  const { user } = useTelegram();

  const tgUser = user as { photo_url?: string; first_name?: string } | null;
  const userPhoto = tgUser?.photo_url || null;
  const userInitial = tgUser?.first_name ? tgUser.first_name.charAt(0).toUpperCase() : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md border-b border-white/5 shadow-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        {headerLogoUrl ? (
          <img src={headerLogoUrl} alt={storeName} className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
            {storeName.charAt(0)}
          </div>
        )}
        <span className="text-white font-bold tracking-tight text-sm truncate">{storeName}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link href={`/miniapp/${storeSlug}/search`} className="p-1.5 text-zinc-300 hover:text-white transition-colors">
          <Search className="w-5 h-5" />
        </Link>
        <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center justify-center">
          {userPhoto ? (
            <img src={userPhoto} alt="Perfil" className="w-7 h-7 rounded-full object-cover border border-white/20 shadow-md" />
          ) : userInitial ? (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white border border-white/20">
              {userInitial}
            </div>
          ) : (
            <UserCircle className="w-6 h-6 text-zinc-300 hover:text-white transition-colors" />
          )}
        </Link>
      </div>
    </header>
  );
}
