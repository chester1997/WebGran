"use client";

import React, { useEffect } from "react";
import Link from "next/link";

/** Topo do Tema XDs: logo do bot + nome, grande, sem ícones à direita */
export function XdsHeader({ storeSlug, name, logoUrl }: { storeSlug: string; name: string; logoUrl: string | null }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);
  const initial = (name || "L").trim().charAt(0).toUpperCase();
  return (
    <header className="w-full max-w-[560px] mx-auto px-4 pt-4 pb-3">
      <Link href={`/miniapp/${storeSlug}/profile`} className="inline-flex items-center gap-3 min-w-0 max-w-full">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-10 h-10 rounded-[9px] object-cover ring-1 ring-white/15 shrink-0" />
        ) : (
          <span className="w-10 h-10 rounded-[9px] bg-zinc-800 ring-1 ring-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0">{initial}</span>
        )}
        <span className="text-[26px] font-bold tracking-tight text-white truncate">{name}</span>
      </Link>
    </header>
  );
}

/** Categorias no topo: botões quadrados com cantos levemente arredondados */
export function XdsCategoryChips({ storeSlug, categories }: { storeSlug: string; categories: { id: string; name: string; slug: string }[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorias" className="w-full max-w-[560px] mx-auto">
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-1">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/miniapp/${storeSlug}/category/${c.slug}`}
            className="shrink-0 h-10 px-4 inline-flex items-center rounded-[8px] border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] transition text-[14px] font-medium text-zinc-100 whitespace-nowrap"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
