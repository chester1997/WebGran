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

  // Nav items setup
  const navItems = [
    { id: "explorar", label: "Explorar", href: `${basePath}/search`, icon: Compass, badge: false, isCentral: false },
    { id: "inicio",   label: "Início",   href: basePath,             icon: Home,    badge: false, isCentral: true  },
    { id: "carrinho", label: "Carrinho", href: `${basePath}/cart`,    icon: ShoppingCart, badge: true, isCentral: false },
  ];

  // Determine active index based on current pathname
  const getActiveIndexFromPath = (path: string): number => {
    if (path.startsWith(`${basePath}/search`)) return 0;
    if (path.startsWith(`${basePath}/cart`)) return 2;
    return 1; // Default to Início (center)
  };

  const [activeIndex, setActiveIndex] = useState<number>(() => getActiveIndexFromPath(pathname));
  const [, startNavTransition] = useTransition();

  // Sync activeIndex if pathname changes externally
  useEffect(() => {
    setActiveIndex(getActiveIndexFromPath(pathname));
  }, [pathname]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, index: number) => {
    // 1. Instant 0ms visual active indicator update (GPU transform)
    setActiveIndex(index);

    // 2. Perform page transition separately without blocking UI thread
    startNavTransition(() => {
      router.push(href);
    });
  };

  // Fixed slot geometry for 0-reflow sliding indicator
  // Slot width = 94px. Offset = 94px * activeIndex
  const SLOT_WIDTH = 94;
  const indicatorTranslateX = activeIndex * SLOT_WIDTH;

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
    >
      <div className="pointer-events-auto w-full max-w-[460px] px-4 mx-auto flex items-center justify-between select-none">
        
        {/* LEFT SPACER — Keeps main pill perfectly centered */}
        <div className="w-[52px] h-[52px] shrink-0 invisible pointer-events-none" aria-hidden="true" />

        {/* A) MAIN PILL CAPSULE — STATIC GLASS BASE (NO ANIMATED BLUR) */}
        <div
          className="relative flex items-center h-[54px] p-1.5 rounded-full 
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     border border-white/30 dark:border-white/10
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {/* PERSISTENT SINGLE SLIDING ACTIVE INDICATOR (GPU Composite Only) */}
          <div
            className={`absolute top-1.5 bottom-1.5 w-[94px] rounded-full pointer-events-none
                        transition-transform duration-[100ms] ease-out
                        will-change-transform motion-reduce:transition-none ${
                          activeIndex === 1
                            ? "bg-red-600 shadow-md shadow-red-600/40"
                            : "bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 shadow-sm"
                        }`}
            style={{
              transform: `translate3d(${indicatorTranslateX}px, 0, 0)`,
            }}
          />

          {/* ITEM SLOTS (Fixed dimensions = 0 layout shift) */}
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeIndex === index;

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                onClick={(e) => handleNavClick(e, item.href, index)}
                aria-label={item.label}
                className="relative z-10 w-[94px] h-[42px] flex items-center justify-center rounded-full active:scale-95 transition-transform duration-75"
              >
                <div
                  className={`flex items-center gap-1.5 transition-opacity duration-[100ms] ease-out ${
                    item.isCentral
                      ? "text-white"
                      : isActive
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                  }`}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-[19px] h-[19px] transition-transform duration-[100ms] ${
                        isActive ? "scale-105" : ""
                      }`}
                      strokeWidth={isActive ? 2.0 : 1.8}
                    />
                    {item.badge && <CartBadge />}
                  </div>

                  <span className="text-[12.5px] font-semibold tracking-tight whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* B) SEPARATED CIRCULAR "+" BUTTON — STATIC GLASS (NO BLUR ANIMATION) */}
        <Link
          href={`${basePath}/search`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/search`, 0)}
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
