"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Settings, HelpCircle, FileText, ChevronRight, Bookmark } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

export function StudioProfile({ storeSlug }: { storeSlug: string }) {
  const { user, webApp } = useTelegram();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cachedUser, setCachedUser] = useState<any>(null);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);

  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`webgran_tg_user_${storeSlug}`) || localStorage.getItem(`webgran_tg_user_${storeSlug}`);
        if (saved) {
          setCachedUser(JSON.parse(saved));
        }
      } catch (_e) {}
    }

    // Load favorites count from localStorage
    try {
      const storedFavs = localStorage.getItem(`webgran_favorites_${storeSlug}`);
      if (storedFavs) {
        const parsed = JSON.parse(storedFavs);
        if (Array.isArray(parsed)) {
          setFavoritesCount(parsed.length);
        }
      }
    } catch (_e) {}
  }, [user, storeSlug]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeUser = (user || cachedUser) as any;
  const firstName = activeUser?.firstName || activeUser?.first_name || "";
  const lastName = activeUser?.lastName || activeUser?.last_name || "";
  const username = activeUser?.username || null;
  const photoUrl = activeUser?.photoUrl || activeUser?.photo_url || null;

  const fullName = firstName ? `${firstName} ${lastName}`.trim() : "Usuário";
  const initial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tgWebApp = webApp as any;

  const menuItems = [
    {
      id: "favorites",
      label: "Favoritos",
      subtitle: `${favoritesCount} ${favoritesCount === 1 ? "título" : "títulos"}`,
      icon: Bookmark,
      href: `/miniapp/${storeSlug}/favorites`,
    },
    {
      id: "settings",
      label: "Configurações",
      subtitle: "",
      icon: Settings,
      href: "#",
      onClick: () => {
        if (tgWebApp?.showAlert) {
          tgWebApp.showAlert("Configurações do aplicativo.");
        } else if (typeof window !== "undefined") {
          alert("Configurações do aplicativo.");
        }
      },
    },
    {
      id: "help",
      label: "Ajuda e suporte",
      subtitle: "",
      icon: HelpCircle,
      href: "#",
      onClick: () => {
        if (tgWebApp?.showAlert) {
          tgWebApp.showAlert("Para suporte, entre em contato com nosso atendimento no Telegram.");
        } else if (typeof window !== "undefined") {
          alert("Para suporte, entre em contato com nosso atendimento no Telegram.");
        }
      },
    },
    {
      id: "terms",
      label: "Termos de uso",
      subtitle: "",
      icon: FileText,
      href: "#",
      onClick: () => {
        if (tgWebApp?.showAlert) {
          tgWebApp.showAlert("Termos de Uso e Políticas de Privacidade do WebGran.");
        } else if (typeof window !== "undefined") {
          alert("Termos de Uso e Políticas de Privacidade do WebGran.");
        }
      },
    },
  ];

  return (
    <div className="p-4 pt-6 pb-24 w-full min-h-[85vh]">
      {/* Header User Card supporting Light & Dark mode */}
      <div className="bg-white/80 dark:bg-[#121316]/90 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 mb-6 flex items-center gap-4 shadow-sm dark:shadow-lg backdrop-blur-md transition-colors duration-200">
        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-zinc-800 dark:text-white">{initial}</span>
          )}
        </div>

        <div className="flex flex-col justify-center min-w-0">
          <h2 className="font-bold text-lg text-zinc-900 dark:text-white truncate">
            Olá, {fullName}!
          </h2>
          {username && (
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium truncate mt-0.5">
              @{username}
            </p>
          )}
        </div>
      </div>

      {/* Profile Menu Options supporting Light & Dark mode */}
      <div className="bg-white/80 dark:bg-[#121316]/90 border border-zinc-200 dark:border-white/10 rounded-2xl divide-y divide-zinc-100 dark:divide-white/5 overflow-hidden shadow-sm dark:shadow-lg backdrop-blur-md transition-colors duration-200">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const rowContent = (
            <div
              key={item.id}
              onClick={item.onClick}
              className="p-4 flex items-center justify-between hover:bg-zinc-100/80 dark:hover:bg-white/5 active:bg-zinc-200/80 dark:active:bg-white/10 transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3.5">
                <IconComponent className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                <span className="font-medium text-sm text-zinc-900 dark:text-white">{item.label}</span>
              </div>

              <div className="flex items-center gap-2">
                {item.subtitle ? (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    {item.subtitle}
                  </span>
                ) : null}
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              </div>
            </div>
          );

          if (item.href && item.href !== "#") {
            return (
              <Link key={item.id} href={item.href}>
                {rowContent}
              </Link>
            );
          }

          return rowContent;
        })}
      </div>
    </div>
  );
}
