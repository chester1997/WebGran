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

  // Main Pill Items: Início, Explorar, Carrinho (Preserving exact existing items)
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
        
        {/* A) MAIN PILL CAPSULE — COMPACT ACRYLIC GLASS (46px Height) */}
        <div
          className="relative flex items-center justify-around h-[46px] px-2 py-1 rounded-full 
                     overflow-hidden transition-all duration-200 gap-1.5
                     
                     /* Glass Base & Refraction */
                     bg-white/65 dark:bg-[#12161b]/60
                     backdrop-blur-[20px] backdrop-saturate-[160%] backdrop-contrast-[1.05]
                     
                     /* Fine Specular Rim Border */
                     border border-white/70 dark:border-white/20
                     
                     /* Multi-layer Inner Bevel & Outer Drop Shadow */
                     shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1.5px_1px_rgba(255,255,255,0.9),inset_0_-1.5px_2px_rgba(0,0,0,0.1)] 
                     dark:shadow-[0_10px_28px_rgba(0,0,0,0.50),inset_0_1.5px_1px_rgba(255,255,255,0.35),inset_0_-1.5px_2.5px_rgba(0,0,0,0.40)]
                     
                     /* Specular Highlight Sheen Gradient Overlay */
                     before:absolute before:inset-0 before:rounded-full before:pointer-events-none
                     before:bg-[linear-gradient(135deg,rgba(255,255,255,0.35),rgba(255,255,255,0.05)_45%,transparent_70%)]
                     dark:before:bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.02)_45%,transparent_70%)]"
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
                        ? "bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.55),inset_0_1.5px_1px_rgba(255,255,255,0.45)] scale-105"
                        : "bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 shadow-[0_2px_8px_rgba(239,68,68,0.35),inset_0_1.5px_1px_rgba(255,255,255,0.35)] group-hover:scale-105"
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
                      ? "bg-white/80 dark:bg-white/15 border border-white/90 dark:border-white/20 text-red-600 dark:text-red-400 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1.5px_rgba(0,0,0,0.35)]"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
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

        {/* B) SEPARATED CIRCULAR "+" BUTTON — 46px COMPACT GLASS CIRCLE */}
        <Link
          href={`${basePath}/search`}
          aria-label="Adicionar / Explorar"
          className="relative overflow-hidden w-[46px] h-[46px] shrink-0 rounded-full flex items-center justify-center
                     transition-all duration-200 active:scale-95 group
                     
                     /* Glass Base & Refraction */
                     bg-white/65 dark:bg-[#12161b]/60
                     backdrop-blur-[20px] backdrop-saturate-[160%] backdrop-contrast-[1.05]
                     
                     /* Fine Specular Rim Border */
                     border border-white/70 dark:border-white/20
                     
                     /* Multi-layer Inner Bevel & Outer Drop Shadow */
                     shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1.5px_1px_rgba(255,255,255,0.9),inset_0_-1.5px_2px_rgba(0,0,0,0.1)] 
                     dark:shadow-[0_10px_28px_rgba(0,0,0,0.50),inset_0_1.5px_1px_rgba(255,255,255,0.35),inset_0_-1.5px_2.5px_rgba(0,0,0,0.40)]
                     
                     /* Specular Highlight Sheen Gradient Overlay */
                     before:absolute before:inset-0 before:rounded-full before:pointer-events-none
                     before:bg-[linear-gradient(135deg,rgba(255,255,255,0.35),rgba(255,255,255,0.05)_45%,transparent_70%)]
                     dark:before:bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.02)_45%,transparent_70%)]
                     text-red-600 dark:text-red-400"
        >
          <Plus className="relative z-10 w-[22px] h-[22px] transition-transform duration-200 group-hover:scale-110" strokeWidth={2.0} />
        </Link>

      </div>
    </nav>
  );
}
