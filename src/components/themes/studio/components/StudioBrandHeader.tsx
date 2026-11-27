"use client";

import React, { useEffect } from "react";
import Link from "next/link";

/**
 * Topo do Mini App com a marca do bot (Personalização): logo enviada pelo vendedor + nome escolhido.
 * Substitui o "Olá, {cliente} / ID" só nos bots que têm Personalização salva.
 */
export function StudioBrandHeader({ storeSlug, name, logoUrl }: { storeSlug: string; name: string; logoUrl: string | null }) {
  useEffect(() => {
    // Mesmo comportamento do topo padrão: Mini App sempre no modo escuro
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  const initial = (name || "L").trim().charAt(0).toUpperCase();

  return (
    <header className="shrink-0 sticky top-2 z-40 w-full max-w-[460px] mx-auto px-4 select-none bg-transparent border-none shadow-none">
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#111214]/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm dark:shadow-black/30 transition-colors duration-200">
        <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center gap-2.5 select-none min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="w-8 h-8 aspect-square rounded-lg object-cover border border-zinc-200 dark:border-white/20 shadow-sm shrink-0" />
          ) : (
            <div className="w-8 h-8 aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-800 dark:text-white border border-zinc-300 dark:border-white/20 shrink-0">
              {initial}
            </div>
          )}
          <span className="text-zinc-900 dark:text-white text-[13px] font-bold tracking-tight truncate">{name}</span>
        </Link>
      </div>
    </header>
  );
}
