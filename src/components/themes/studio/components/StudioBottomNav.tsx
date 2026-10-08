"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LibraryBig, Home, Search, ShoppingCart } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const basePath = `/miniapp/${storeSlug}`;

  const [activeHref, setActiveHref] = useState<string>(pathname);
  const [, startNavTransition] = useTransition();

  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  const activeHome      = activeHref === basePath || activeHref === `${basePath}/`;
  const activeFavorites = activeHref.startsWith(`${basePath}/favorites`);
  const activeAccesses  = activeHref.startsWith(`${basePath}/accesses`);
  const activeSearch    = activeHref.startsWith(`${basePath}/search`);
  const activeCart      = activeHref.startsWith(`${basePath}/cart`);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveHref(href);
    startNavTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#111215]/95 dark:bg-[#0c0d10]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto select-none"
    >
      <div className="max-w-[480px] mx-auto grid grid-cols-5 h-[64px] px-1 items-center relative">
        
        {/* 1. FAVORITOS */}
        <Link
          href={`${basePath}/favorites`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/favorites`)}
          aria-label="Favoritos"
          className="flex flex-col items-center justify-center py-1 transition-transform duration-200 active:scale-95 group"
        >
          <div className="relative flex items-center justify-center">
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${
                activeFavorites
                  ? "text-red-500 fill-red-500/20 stroke-[2.2]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
              activeFavorites ? "text-red-500 font-bold" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Favoritos
          </span>
        </Link>

        {/* 2. ACESSOS */}
        <Link
          href={`${basePath}/accesses`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/accesses`)}
          aria-label="Acessos"
          className="flex flex-col items-center justify-center py-1 transition-transform duration-200 active:scale-95 group"
        >
          <div className="relative flex items-center justify-center">
            <LibraryBig
              className={`w-5 h-5 transition-all duration-200 ${
                activeAccesses
                  ? "text-red-500 fill-red-500/20 stroke-[2.2]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
              activeAccesses ? "text-red-500 font-bold" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Acessos
          </span>
        </Link>

        {/* 3. INÍCIO */}
        <Link
          href={basePath}
          prefetch={true}
          onClick={(e) => handleNavClick(e, basePath)}
          aria-label="Início"
          className="flex flex-col items-center justify-center py-1 transition-transform duration-200 active:scale-95 group"
        >
          <div className="relative flex items-center justify-center">
            <Home
              className={`w-5 h-5 transition-all duration-200 ${
                activeHome
                  ? "text-red-500 stroke-[2.2]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
              activeHome ? "text-red-500 font-bold" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Início
          </span>
        </Link>

        {/* 4. BUSCA */}
        <Link
          href={`${basePath}/search`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/search`)}
          aria-label="Busca"
          className="flex flex-col items-center justify-center py-1 transition-transform duration-200 active:scale-95 group"
        >
          <div className="relative flex items-center justify-center">
            <Search
              className={`w-5 h-5 transition-all duration-200 ${
                activeSearch
                  ? "text-red-500 stroke-[2.2]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
              activeSearch ? "text-red-500 font-bold" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Busca
          </span>
        </Link>

        {/* 5. CARRINHO */}
        <Link
          href={`${basePath}/cart`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/cart`)}
          aria-label="Carrinho"
          className="flex flex-col items-center justify-center py-1 transition-transform duration-200 active:scale-95 group relative"
        >
          <div className="relative flex items-center justify-center">
            <ShoppingCart
              className={`w-5 h-5 transition-all duration-200 ${
                activeCart
                  ? "text-red-500 stroke-[2.2]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
            <CartBadge active={activeCart} />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
              activeCart ? "text-red-500 font-bold" : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Carrinho
          </span>
        </Link>

      </div>
    </nav>
  );
}
