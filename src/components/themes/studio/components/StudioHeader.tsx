"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTelegram } from "@/app/miniapp/Providers";

interface StudioHeaderProps {
  storeSlug: string;
  storeName: string;
  headerLogoUrl: string | null;
}

export function StudioHeader({ storeSlug, storeName: _storeName, headerLogoUrl: _headerLogoUrl }: StudioHeaderProps) {
  const { user } = useTelegram();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cachedUser, setCachedUser] = useState<any>(null);

  useEffect(() => {
    // Force Dark Mode by default for all users
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");

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
  const userPhoto = activeUser?.photoUrl || activeUser?.photo_url || null;
  const firstName = activeUser?.firstName || activeUser?.first_name || "Usuário";
  const userId = activeUser?.id || activeUser?.telegramId || activeUser?.telegramUserId || null;
  const userInitial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  return (
    <header className="shrink-0 sticky top-2 z-40 w-full max-w-[460px] mx-auto px-4 select-none bg-transparent border-none shadow-none">
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#111214]/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm dark:shadow-black/30 transition-colors duration-200">
        {/* Left: User Profile */}
        <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center gap-2.5 group select-none min-w-0">
          {userPhoto ? (
            <img src={userPhoto} alt="Perfil" className="w-8 h-8 aspect-square rounded-lg object-cover border border-zinc-200 dark:border-white/20 shadow-sm shrink-0" />
          ) : (
            <div className="w-8 h-8 aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-800 dark:text-white border border-zinc-300 dark:border-white/20 shrink-0">
              {userInitial}
            </div>
          )}

          <div className="flex flex-col text-left min-w-0">
            <span className="text-zinc-900 dark:text-white text-xs font-bold tracking-tight truncate leading-tight group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
              Olá, {firstName}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-tight">
              {userId ? `ID: ${userId}` : "ID: ---"}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
