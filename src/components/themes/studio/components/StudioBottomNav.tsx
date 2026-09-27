"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, ShoppingCart, LibraryBig, Compass, Search } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const basePath = `/miniapp/${storeSlug}`;

  const isHome      = pathname === basePath || pathname === `${basePath}/`;
  const isFavorites = pathname.startsWith(`${basePath}/favorites`);
  const isSearch    = pathname.startsWith(`${basePath}/search`);
  const isAccesses  = pathname.startsWith(`${basePath}/accesses`);
  const isCart      = pathname.startsWith(`${basePath}/cart`);

  // Main Pill 5 Items
  const navItems = [
    { label: "Início",     href: basePath,                icon: Home,       isActive: isHome,      badge: false, isExplorar: false },
    { label: "Favoritos",  href: `${basePath}/favorites`, icon: Heart,      isActive: isFavorites, badge: false, isExplorar: false },
    { label: "Explorar",   href: `${basePath}/search`,    icon: Compass,    isActive: isSearch,    badge: false, isExplorar: true  },
    { label: "Acessos",    href: `${basePath}/accesses`,  icon: LibraryBig,  isActive: isAccesses,  badge: false, isExplorar: false },
    { label: "Carrinho",   href: `${basePath}/cart`,      icon: ShoppingCart, isActive: isCart,      badge: true,  isExplorar: false },
  ];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent" }}
    >
      <div className="pointer-events-auto w-[calc(100%-16px)] max-w-md mx-auto flex items-center gap-2 select-none">
        
        {/* A) MAIN PILL CAPSULE (5 Items) */}
        <div
          className="flex-1 h-[66px] px-1 rounded-full 
                     bg-white/75 dark:bg-zinc-900/65 
                     backdrop-blur-xl backdrop-saturate-150
                     border border-white/60 dark:border-white/12 
                     shadow-[0_8px_30px_rgba(0,0,0,0.12),0_1px_2px_rgba(255,255,255,0.8)_inset] 
                     dark:shadow-[0_8px_30px_rgba(0,0,0,0.45),0_1px_1px_rgba(255,255,255,0.08)_inset] 
                     flex items-center justify-around transition-all duration-200"
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
                  className="flex-1 flex flex-col items-center justify-center py-1 transition-transform duration-150 active:scale-95 group"
                >
                  <div
                    className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all duration-200 ${
                      item.isActive
                        ? "bg-gradient-to-tr from-red-600 to-red-500 shadow-[0_0_14px_rgba(239,68,68,0.55)] scale-105"
                        : "bg-gradient-to-tr from-red-600 to-red-500 shadow-[0_3px_10px_rgba(239,68,68,0.35)] group-hover:scale-105"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] text-white stroke-[2.2]" />
                  </div>
                  <span
                    className={`text-[10px] font-semibold mt-0.5 leading-none transition-colors ${
                      item.isActive ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            }

            // Standard Nav Item (Início, Favoritos, Acessos, Carrinho)
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="flex-1 flex items-center justify-center py-1"
              >
                <div
                  className={`w-full h-full min-h-[44px] px-1 py-1 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 ${
                    item.isActive
                      ? "bg-black/8 dark:bg-white/12 text-red-600 dark:text-red-400 shadow-inner"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon
                      className={`w-[19px] h-[19px] transition-transform duration-200 ${
                        item.isActive ? "scale-110" : ""
                      }`}
                      strokeWidth={item.isActive ? 2.2 : 1.7}
                    />
                    {item.badge && <CartBadge />}
                  </div>
                  <span
                    className={`text-[10px] leading-none transition-colors ${
                      item.isActive ? "font-semibold text-red-600 dark:text-red-400" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* B) SEPARATED CIRCULAR SEARCH BUTTON (RIGHT SIDE) */}
        <Link
          href={`${basePath}/search`}
          aria-label="Pesquisar"
          className={`w-[54px] h-[54px] shrink-0 rounded-full flex items-center justify-center
                     bg-white/75 dark:bg-zinc-900/65 
                     backdrop-blur-xl backdrop-saturate-150
                     border border-white/60 dark:border-white/12 
                     shadow-[0_8px_25px_rgba(0,0,0,0.12),0_1px_2px_rgba(255,255,255,0.8)_inset] 
                     dark:shadow-[0_8px_25px_rgba(0,0,0,0.45),0_1px_1px_rgba(255,255,255,0.08)_inset] 
                     transition-all duration-200 active:scale-95 group ${
                       isSearch
                         ? "text-red-600 dark:text-red-400 border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.3)]"
                         : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                     }`}
        >
          <Search className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.2} />
        </Link>

      </div>
    </nav>
  );
}
