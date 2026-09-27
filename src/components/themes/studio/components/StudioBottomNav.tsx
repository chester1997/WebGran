"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Compass, Plus } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const basePath = `/miniapp/${storeSlug}`;

  const isHome      = pathname === basePath || pathname === `${basePath}/`;
  const isExplorar  = pathname.startsWith(`${basePath}/search`);
  const isCart      = pathname.startsWith(`${basePath}/cart`);

  // Main Pill Items: Explorar (Esquerda), Início (Centro/Destaque), Carrinho (Direita)
  const navItems = [
    { label: "Explorar", href: `${basePath}/search`,  icon: Compass,      isActive: isExplorar, badge: false, isCentral: false },
    { label: "Início",   href: basePath,             icon: Home,         isActive: isHome,     badge: false, isCentral: true  },
    { label: "Carrinho", href: `${basePath}/cart`,    icon: ShoppingCart, isActive: isCart,     badge: true,  isCentral: false },
  ];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
    >
      <div className="pointer-events-auto w-full max-w-[460px] px-4 mx-auto flex items-center justify-between select-none">
        
        {/* LEFT SPACER — Keeps main pill perfectly centered */}
        <div className="w-[52px] h-[52px] shrink-0 invisible pointer-events-none" aria-hidden="true" />

        {/* A) MAIN PILL CAPSULE — FLUID SMOOTH GLASS DOCK (54px Height) */}
        <div
          className="relative flex items-center justify-around h-[54px] px-2 py-1.5 rounded-full 
                     transition-all duration-300 ease-out gap-1.5
                     
                     /* Clean Liquid Glass Base */
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     
                     /* Subtle Rim Border */
                     border border-white/30 dark:border-white/10
                     
                     /* Soft Drop Shadow */
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="relative z-10 flex items-center justify-center transition-all duration-300 ease-out active:scale-95 group"
              >
                <div
                  className={`h-[42px] rounded-full flex items-center justify-center transition-all duration-300 ease-out ${
                    item.isCentral
                      ? item.isActive
                        ? "bg-red-600 text-white px-3.5 shadow-md shadow-red-600/40"
                        : "bg-red-600 text-white w-[42px] shadow-md shadow-red-600/30 group-hover:scale-105"
                      : item.isActive
                      ? "bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 text-red-600 dark:text-red-400 px-3.5 shadow-sm"
                      : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white w-[42px]"
                  }`}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-[20px] h-[20px] transition-transform duration-300 ease-out ${
                        item.isActive ? "scale-105" : ""
                      }`}
                      strokeWidth={item.isActive ? 2.0 : 1.8}
                    />
                    {item.badge && <CartBadge />}
                  </div>

                  {/* Ultra-smooth Label Expand & Fade Transition */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${
                      item.isActive
                        ? "max-w-[100px] opacity-100 ml-2"
                        : "max-w-0 opacity-0 ml-0"
                    }`}
                  >
                    <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* B) SEPARATED CIRCULAR "+" BUTTON — 52px LARGER CIRCLE */}
        <Link
          href={`${basePath}/search`}
          aria-label="Adicionar / Explorar"
          className="relative w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center
                     transition-all duration-200 active:scale-95 group
                     
                     /* Clean Liquid Glass Base */
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     
                     /* Subtle Glass Rim Border */
                     border border-white/30 dark:border-white/10
                     
                     /* Soft Drop Shadow */
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          <Plus className="relative z-10 w-[24px] h-[24px] text-red-600 dark:text-red-500 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.2} />
        </Link>

      </div>
    </nav>
  );
}
