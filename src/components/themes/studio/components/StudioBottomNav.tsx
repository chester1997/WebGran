"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingCart, Compass, Plus } from "lucide-react";
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

  const activeHome      = (activeHref === basePath || activeHref === `${basePath}/`);
  const activeExplorar  = activeHref.startsWith(`${basePath}/search`);
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
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
    >
      <div className="pointer-events-auto flex items-center justify-center gap-2 select-none mx-auto max-w-[95vw]">
        
        {/* A) MAIN PILL CAPSULE — 3 BUTTONS (EXPLORAR, INÍCIO, CARRINHO) */}
        <div
          className="relative flex items-center justify-around h-[54px] px-2 py-1.5 rounded-full gap-2
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     border border-white/30 dark:border-white/10
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {/* 1. Explorar — ICON ONLY */}
          <Link
            href={`${basePath}/search`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/search`)}
            aria-label="Explorar"
            className="relative z-10 flex items-center justify-center transition-transform duration-100 active:scale-95 group"
          >
            <div
              className={`w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all duration-150 ${
                activeExplorar
                  ? "bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              <Compass className="w-[20px] h-[20px]" strokeWidth={activeExplorar ? 2.0 : 1.8} />
            </div>
          </Link>

          {/* 2. Início — ICON + NAME ("Início") */}
          <Link
            href={basePath}
            prefetch={true}
            onClick={(e) => handleNavClick(e, basePath)}
            aria-label="Início"
            className="relative z-10 flex items-center justify-center transition-transform duration-100 active:scale-95 group"
          >
            <div
              className={`h-[42px] px-3.5 rounded-full flex items-center gap-2 text-white transition-all duration-150 ${
                activeHome
                  ? "bg-red-600 shadow-md shadow-red-600/40"
                  : "bg-red-600/90 hover:bg-red-600 shadow-md shadow-red-600/30 group-hover:scale-105"
              }`}
            >
              <Home className="w-[20px] h-[20px] stroke-[2] shrink-0" />
              <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
                Início
              </span>
            </div>
          </Link>

          {/* 3. Carrinho — ICON ONLY */}
          <Link
            href={`${basePath}/cart`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/cart`)}
            aria-label="Carrinho"
            className="relative z-10 flex items-center justify-center transition-transform duration-100 active:scale-95 group"
          >
            <div
              className={`w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all duration-150 ${
                activeCart
                  ? "bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <ShoppingCart className="w-[20px] h-[20px]" strokeWidth={activeCart ? 2.0 : 1.8} />
                <CartBadge />
              </div>
            </div>
          </Link>
        </div>

        {/* B) SEPARATED CIRCULAR "+" BUTTON */}
        <Link
          href={`${basePath}/search`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/search`)}
          aria-label="Adicionar / Explorar"
          className="relative w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center
                     transition-transform duration-100 active:scale-95 group
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     border border-white/30 dark:border-white/10
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          <Plus className="relative z-10 w-[24px] h-[24px] text-red-600 dark:text-red-500 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.2} />
        </Link>

      </div>
    </nav>
  );
}
