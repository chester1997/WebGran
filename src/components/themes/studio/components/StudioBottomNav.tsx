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

  // Main Pill Items: Início, Explorar, Carrinho
  const navItems = [
    { label: "Início",   href: basePath,             icon: Home,         isActive: isHome,     badge: false, isExplorar: false },
    { label: "Explorar", href: `${basePath}/search`,  icon: Compass,      isActive: isExplorar, badge: false, isExplorar: true  },
    { label: "Carrinho", href: `${basePath}/cart`,    icon: ShoppingCart, isActive: isCart,     badge: true,  isExplorar: false },
  ];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
    >
      <div className="pointer-events-auto flex items-center gap-2 select-none mx-auto max-w-[92vw]">
        
        {/* A) MAIN PILL CAPSULE — CLEAN LIQUID GLASS WITH MEDIUM TRANSPARENCY */}
        <div
          className="relative flex items-center justify-around h-[46px] px-2 py-1 rounded-full 
                     transition-all duration-200 gap-1.5
                     
                     /* Clean Liquid Glass Base */
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     
                     /* Subtle Glass Rim Border */
                     border border-white/30 dark:border-white/10
                     
                     /* Soft Drop Shadow */
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {navItems.map((item) => {
            const Icon = item.icon;

            // Explorar Item (Central Highlight inside Main Pill)
            if (item.isExplorar) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="relative z-10 flex items-center justify-center transition-transform duration-150 active:scale-95 group"
                >
                  <div
                    className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-200 ${
                      item.isActive
                        ? "bg-red-600 text-white shadow-md shadow-red-600/30 scale-105"
                        : "bg-red-600/90 text-white shadow-sm hover:bg-red-600 group-hover:scale-105"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] text-white stroke-[2]" />
                  </div>
                </Link>
              );
            }

            // Standard Nav Item (Início, Carrinho)
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="relative z-10 flex items-center justify-center"
              >
                <div
                  className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                    item.isActive
                      ? "bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 text-red-600 dark:text-red-400 shadow-sm"
                      : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon
                      className={`w-[18px] h-[18px] transition-transform duration-200 ${
                        item.isActive ? "scale-105" : ""
                      }`}
                      strokeWidth={item.isActive ? 2.0 : 1.8}
                    />
                    {item.badge && <CartBadge />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* B) SEPARATED CIRCULAR "+" BUTTON — CLEAN LIQUID GLASS */}
        <Link
          href={`${basePath}/search`}
          aria-label="Adicionar / Explorar"
          className="relative w-[46px] h-[46px] shrink-0 rounded-full flex items-center justify-center
                     transition-all duration-200 active:scale-95 group
                     
                     /* Clean Liquid Glass Base */
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     
                     /* Subtle Glass Rim Border */
                     border border-white/30 dark:border-white/10
                     
                     /* Soft Drop Shadow */
                     shadow-lg shadow-black/10 dark:shadow-black/40
                     text-red-600 dark:text-red-400"
        >
          <Plus className="relative z-10 w-[22px] h-[22px] transition-transform duration-200 group-hover:scale-110" strokeWidth={2.0} />
        </Link>

      </div>
    </nav>
  );
}
