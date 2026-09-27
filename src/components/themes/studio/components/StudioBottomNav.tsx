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
      <div className="pointer-events-auto flex items-center gap-2 select-none mx-auto max-w-[95vw]">
        
        {/* A) SEPARATED CIRCULAR "+" BUTTON — ON THE LEFT SIDE */}
        <Link
          href={`${basePath}/search`}
          aria-label="Adicionar / Explorar"
          className="relative w-[48px] h-[48px] shrink-0 rounded-full flex items-center justify-center
                     transition-all duration-200 active:scale-95 group
                     
                     /* Clean Liquid Glass Base */
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     
                     /* Subtle Glass Rim Border */
                     border border-white/30 dark:border-white/10
                     
                     /* Soft Drop Shadow */
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          <Plus className="relative z-10 w-[22px] h-[22px] text-red-600 dark:text-red-500 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.2} />
        </Link>

        {/* B) MAIN PILL CAPSULE — 3 BUTTONS (EXPLORAR, INÍCIO, CARRINHO) */}
        <div
          className="relative flex items-center justify-around h-[50px] px-2 py-1.5 rounded-full 
                     transition-all duration-300 gap-2
                     
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

            // Início Item (Central Highlight inside Main Pill)
            if (item.isCentral) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="relative z-10 flex items-center justify-center transition-all duration-300 active:scale-95 group"
                >
                  {item.isActive ? (
                    <div className="flex items-center gap-2 px-3.5 h-[38px] rounded-full bg-red-600 text-white font-semibold text-xs shadow-md shadow-red-600/40 transition-all duration-300">
                      <Icon className="w-[18px] h-[18px] text-white stroke-[2]" />
                      <span className="text-[12px] font-medium tracking-tight whitespace-nowrap">{item.label}</span>
                    </div>
                  ) : (
                    <div className="w-[38px] h-[38px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30 group-hover:scale-105 transition-all duration-200">
                      <Icon className="w-[18px] h-[18px] text-white stroke-[2]" />
                    </div>
                  )}
                </Link>
              );
            }

            // Standard Nav Items (Explorar na Esquerda, Carrinho na Direita)
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="relative z-10 flex items-center justify-center transition-all duration-300"
              >
                {item.isActive ? (
                  <div className="flex items-center gap-2 px-3.5 h-[38px] rounded-full bg-white/70 dark:bg-white/20 border border-white/40 dark:border-white/20 text-red-600 dark:text-red-400 font-semibold text-xs shadow-sm transition-all duration-300">
                    <div className="relative flex items-center justify-center">
                      <Icon className="w-[18px] h-[18px]" strokeWidth={2.0} />
                      {item.badge && <CartBadge />}
                    </div>
                    <span className="text-[12px] font-medium tracking-tight whitespace-nowrap">{item.label}</span>
                  </div>
                ) : (
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-all duration-200 active:scale-95">
                    <div className="relative flex items-center justify-center">
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                      {item.badge && <CartBadge />}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

      </div>
    </nav>
  );
}
