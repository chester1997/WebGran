"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingBag, Key } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const basePath = `/miniapp/${storeSlug}`;

  const isHome = pathname === basePath || pathname === `${basePath}/`;
  const isSearch = pathname.startsWith(`${basePath}/search`);
  const isCart = pathname.startsWith(`${basePath}/cart`);
  const isAccesses = pathname.startsWith(`${basePath}/accesses`);

  const navItems = [
    {
      label: "Início",
      href: basePath,
      icon: Home,
      isActive: isHome,
    },
    {
      label: "Buscar",
      href: `${basePath}/search`,
      icon: Search,
      isActive: isSearch,
    },
    {
      label: "Carrinho",
      href: `${basePath}/cart`,
      icon: ShoppingBag,
      isActive: isCart,
      badge: true,
    },
    {
      label: "Acessos",
      href: `${basePath}/accesses`,
      icon: Key,
      isActive: isAccesses,
    },
  ];

  return (
    <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] max-w-[360px] sm:max-w-[380px] pointer-events-none">
      <nav 
        aria-label="Navegação inferior" 
        className="pointer-events-auto h-[60px] px-2 bg-[#18181c]/85 backdrop-blur-xl border border-white/10 rounded-full shadow-lg shadow-black/40 flex items-center justify-between"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`relative flex flex-col items-center justify-center flex-1 h-[48px] mx-0.5 rounded-full transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                item.isActive
                  ? "bg-red-500/15 text-red-400 font-semibold border border-red-500/20 shadow-sm shadow-red-500/10"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${item.isActive ? "scale-105 text-red-400" : "text-zinc-400"}`} />
                {item.badge && <CartBadge />}
              </div>
              <span className="text-[10px] leading-none mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
