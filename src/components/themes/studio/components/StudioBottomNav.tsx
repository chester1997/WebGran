"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, Key } from "lucide-react";
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
      icon: ShoppingCart,
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
    <nav className="shrink-0 h-16 bg-[#161616]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-4 items-center z-50 pb-[env(safe-area-inset-bottom,0px)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`relative flex flex-col items-center justify-center w-full h-full text-[10px] transition-colors ${
              item.isActive
                ? "text-red-500 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className={`w-5 h-5 mb-0.5 transition-transform ${item.isActive ? "scale-110 text-red-500" : "text-zinc-400"}`} />
              {item.badge && <CartBadge />}
            </div>
            <span>{item.label}</span>
            {item.isActive && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
