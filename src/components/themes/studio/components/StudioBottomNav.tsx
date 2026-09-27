"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingCart, Compass, Film } from "lucide-react";
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
  const activeClips     = activeHref.startsWith(`${basePath}/clips`);

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
      <div className="pointer-events-auto w-full max-w-[460px] px-4 mx-auto flex items-center justify-between select-none">
        
        {/* LEFT SPACER — Keeps 3-button main pill mathematically 100% centered */}
        <div className="w-[52px] h-[52px] shrink-0 invisible pointer-events-none" aria-hidden="true" />

        {/* A) MAIN PILL CAPSULE — 3 BUTTONS (EXPLORAR, INÍCIO, CARRINHO) */}
        <div
          className="relative flex items-center justify-around h-[54px] px-2 py-1.5 rounded-full gap-2
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     border border-white/30 dark:border-white/10
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {/* 1. Explorar */}
          <Link
            href={`${basePath}/search`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/search`)}
            aria-label="Explorar"
            className="relative z-10 flex items-center justify-center"
          >
            {activeExplorar ? (
              <div className="w-[42px] h-[42px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/40">
                <Compass className="w-[20px] h-[20px] stroke-[2]" />
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <Compass className="w-[20px] h-[20px]" strokeWidth={1.8} />
              </div>
            )}
          </Link>

          {/* 2. Início */}
          <Link
            href={basePath}
            prefetch={true}
            onClick={(e) => handleNavClick(e, basePath)}
            aria-label="Início"
            className="relative z-10 flex items-center justify-center"
          >
            {activeHome ? (
              <div className="h-[42px] px-3.5 rounded-full bg-red-600 text-white font-semibold flex items-center gap-2 shadow-md shadow-red-600/40">
                <Home className="w-[20px] h-[20px] stroke-[2] shrink-0" />
                <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
                  Início
                </span>
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <Home className="w-[20px] h-[20px]" strokeWidth={1.8} />
              </div>
            )}
          </Link>

          {/* 3. Carrinho */}
          <Link
            href={`${basePath}/cart`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/cart`)}
            aria-label="Carrinho"
            className="relative z-10 flex items-center justify-center"
          >
            {activeCart ? (
              <div className="w-[42px] h-[42px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/40">
                <div className="relative flex items-center justify-center">
                  <ShoppingCart className="w-[20px] h-[20px]" strokeWidth={2.0} />
                  <CartBadge active={true} />
                </div>
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <div className="relative flex items-center justify-center">
                  <ShoppingCart className="w-[20px] h-[20px]" strokeWidth={1.8} />
                  <CartBadge active={false} />
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* B) SEPARATED CIRCULAR CLIPS BUTTON — ANCHORED AT FAR RIGHT EDGE */}
        <Link
          href={`${basePath}/clips`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/clips`)}
          aria-label="Clips"
          className={`relative w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center
                     backdrop-blur-md transition-all duration-200
                     border shadow-lg ${
                       activeClips
                         ? "bg-red-600 border-red-500 text-white shadow-red-600/40"
                         : "bg-white/50 dark:bg-black/40 border-white/30 dark:border-white/10 shadow-black/10 dark:shadow-black/40 text-red-600 dark:text-red-500 hover:text-red-500"
                     }`}
        >
          <Film className="relative z-10 w-[24px] h-[24px]" strokeWidth={2.2} />
        </Link>

      </div>
    </nav>
  );
}
