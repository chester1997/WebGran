"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

interface StudioHeaderProps {
  storeSlug: string;
  storeName: string;
  headerLogoUrl: string | null;
}

export function StudioHeader({ storeSlug, storeName: _storeName, headerLogoUrl: _headerLogoUrl }: StudioHeaderProps) {
  const { user } = useTelegram();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cachedUser, setCachedUser] = useState<any>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("miniapp-theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const isLight = document.documentElement.classList.contains("light");
      setTheme(isLight ? "light" : "dark");
    }

    if (!user && typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`webgran_tg_user_${storeSlug}`) || localStorage.getItem(`webgran_tg_user_${storeSlug}`);
        if (saved) {
          setCachedUser(JSON.parse(saved));
        }
      } catch (_e) {}
    }
  }, [user, storeSlug]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("miniapp-theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeUser = (user || cachedUser) as any;
  const userPhoto = activeUser?.photoUrl || activeUser?.photo_url || null;
  const firstName = activeUser?.firstName || activeUser?.first_name || "Usuário";
  const userId = activeUser?.id || activeUser?.telegramId || activeUser?.telegramUserId || null;
  const userInitial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  return (
    <header className="shrink-0 sticky top-0 left-0 right-0 z-40 px-2.5 py-2.5 flex items-center justify-between bg-white/80 dark:bg-[#0d0e10]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-md transition-colors duration-200">
      {/* Left: User Profile */}
      <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center gap-2.5 group select-none">
        {userPhoto ? (
          <img src={userPhoto} alt="Perfil" className="w-9 h-9 aspect-square rounded-lg object-cover border border-zinc-200 dark:border-white/20 shadow-sm shrink-0" />
        ) : (
          <div className="w-9 h-9 aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-800 dark:text-white border border-zinc-300 dark:border-white/20 shrink-0">
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

      {/* Right: Light / Dark Mode Toggle Button */}
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Alternar tema"
        title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all duration-200 active:scale-95 flex items-center justify-center shrink-0"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
        )}
      </button>
    </header>
  );
}
