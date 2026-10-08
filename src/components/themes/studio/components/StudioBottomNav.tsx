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
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))] px-3"
    >
      <div className="pointer-events-auto w-full max-w-[440px] mx-auto select-none relative">
        {/* Floating Pill/Capsule Container - Liquid Glass Style */}
        <div className="relative flex items-center justify-between h-[64px] px-2 rounded-[28px] bg-neutral-950/40 dark:bg-black/40 backdrop-blur-2xl border border-white/15 shadow-[0_10px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.2)] overflow-visible">
          
          {/* 1. FAVORITOS */}
          <Link
            href={`${basePath}/favorites`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/favorites`)}
            aria-label="Favoritos"
            className="w-1/5 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 group"
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
            className="w-1/5 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 group"
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

          {/* 3. INÍCIO (ELEVATED CIRCULAR BLACK BUTTON - EXACT CENTER, CLEAN DISCRETE SHADOW) */}
          <div className="w-1/5 flex flex-col items-center justify-center relative -mt-5 z-20">
            <Link
              href={basePath}
              prefetch={true}
              onClick={(e) => handleNavClick(e, basePath)}
              aria-label="Início"
              className="flex flex-col items-center justify-center group active:scale-95 transition-transform duration-200"
            >
              <div
                className={`w-[56px] h-[56px] rounded-full bg-black border flex items-center justify-center transition-all duration-300 ${
                  activeHome
                    ? "border-red-500/70 shadow-[0_4px_14px_rgba(0,0,0,0.8)] scale-105"
                    : "border-white/15 hover:border-red-500/50 shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                }`}
              >
                <Home
                  className={`w-6 h-6 stroke-[2.2] transition-colors duration-200 ${
                    activeHome
                      ? "text-red-500"
                      : "text-red-500/80 group-hover:text-red-500"
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
          </div>

          {/* 4. BUSCA */}
          <Link
            href={`${basePath}/search`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/search`)}
            aria-label="Busca"
            className="w-1/5 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 group"
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
            className="w-1/5 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 group relative"
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
      </div>
    </nav>
  );
}
