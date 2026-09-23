"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, LibraryBig, Compass } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const basePath = `/miniapp/${storeSlug}`;

  const isHome     = pathname === basePath || pathname === `${basePath}/`;
  const isSearch   = pathname.startsWith(`${basePath}/search`);
  const isCart     = pathname.startsWith(`${basePath}/cart`);
  const isAccesses = pathname.startsWith(`${basePath}/accesses`);

  // Left items
  const leftItems = [
    { label: "Início",       href: basePath,               icon: Home,       isActive: isHome },
    { label: "Minha Lista",  href: `${basePath}/accesses`, icon: LibraryBig, isActive: isAccesses },
  ];

  // Right items — Acessos + Carrinho
  const rightItems = [
    { label: "Acessos",  href: `${basePath}/accesses`, icon: LibraryBig,   isActive: isAccesses, badge: false },
    { label: "Carrinho", href: `${basePath}/cart`,     icon: ShoppingCart,  isActive: isCart,     badge: true  },
  ];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="w-full h-[68px] bg-[#111114]/90 backdrop-blur-xl border-t border-white/8 flex items-center px-2 relative">

        {/* Left: Início + Minha Lista */}
        <div className="flex items-center flex-1 justify-around">
          {leftItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl transition-all duration-150 active:scale-95 select-none ${
                  item.isActive ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-all duration-150 ${item.isActive ? "scale-110" : ""}`}
                  strokeWidth={item.isActive ? 2 : 1.6}
                />
                <span className={`text-[10px] font-semibold leading-none ${item.isActive ? "text-red-400" : "text-zinc-500"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Center — Explorar button, elevated */}
        <div className="relative flex flex-col items-center justify-end pb-1 px-3" style={{ marginTop: "-20px" }}>
          <Link
            href={`${basePath}/search`}
            aria-label="Explorar"
            className={`flex items-center justify-center w-[54px] h-[54px] rounded-full transition-all duration-150 active:scale-95 select-none ${
              isSearch
                ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.55)]"
                : "bg-red-600 shadow-[0_4px_20px_rgba(239,68,68,0.35)] hover:bg-red-500"
            }`}
          >
            <Compass className="w-7 h-7 text-white" strokeWidth={2} />
          </Link>
          <span className={`text-[10px] font-semibold mt-1.5 leading-none ${isSearch ? "text-red-400" : "text-zinc-500"}`}>
            Explorar
          </span>
        </div>

        {/* Right: Acessos + Carrinho */}
        <div className="flex items-center flex-1 justify-around">
          {rightItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl transition-all duration-150 active:scale-95 select-none ${
                  item.isActive ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-[22px] h-[22px] transition-all duration-150 ${item.isActive ? "scale-110" : ""}`}
                    strokeWidth={item.isActive ? 2 : 1.6}
                  />
                  {item.badge && <CartBadge />}
                </div>
                <span className={`text-[10px] font-semibold leading-none ${item.isActive ? "text-red-400" : "text-zinc-500"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

      </div>
    </nav>
  );
}
