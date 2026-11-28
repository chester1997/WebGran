"use client";

import React from "react";
import Link from "next/link";
import { House, Heart, Clapperboard, Search, ShoppingBag, MessageCircle, type LucideIcon } from "lucide-react";
import { CartBadge } from "../studio/components/CartBadge";

interface Item {
  label: string;
  href?: string;
  icon: LucideIcon;
  active: boolean;
  /** Ícone preenchido quando ativo */
  fillable?: boolean;
  cart?: boolean;
  onClick?: () => void;
}

/**
 * Menu de baixo do Tema XDs: barra sólida e reta, ícone preenchido e branco na aba ativa.
 * Mesmos botões e mesma ordem do tema Padrão.
 */
export function XdsBottomNav({
  basePath,
  active,
  hasSupport,
  onSupport,
  onNavigate,
}: {
  basePath: string;
  active: { home: boolean; favorites: boolean; accesses: boolean; search: boolean; cart: boolean };
  hasSupport: boolean;
  onSupport: () => void;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const items: Item[] = [
    { label: "Início", href: basePath, icon: House, active: active.home, fillable: true },
    { label: "Favoritos", href: `${basePath}/favorites`, icon: Heart, active: active.favorites, fillable: true },
    { label: "Acessos", href: `${basePath}/accesses`, icon: Clapperboard, active: active.accesses },
    { label: "Busca", href: `${basePath}/search`, icon: Search, active: active.search },
    { label: "Carrinho", href: `${basePath}/cart`, icon: ShoppingBag, active: active.cart, fillable: true, cart: true },
    ...(hasSupport ? [{ label: "Suporte", icon: MessageCircle, active: false, onClick: onSupport } as Item] : []),
  ];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#141519] border-t border-white/[0.07] pb-[env(safe-area-inset-bottom,0px)] select-none"
    >
      <div className={`mx-auto grid ${hasSupport ? "grid-cols-6 max-w-[560px]" : "grid-cols-5 max-w-[500px]"} h-[62px] items-center`}>
        {items.map((it) => {
          const Icon = it.icon;
          const inner = (
            <>
              <span className="relative flex items-center justify-center">
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${it.active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}`}
                  strokeWidth={it.active ? 2.2 : 1.8}
                  fill={it.active && it.fillable ? "currentColor" : "none"}
                />
                {it.cart && <CartBadge active={it.active} />}
              </span>
              <span className={`mt-1 text-[10.5px] leading-tight truncate max-w-full px-0.5 ${it.active ? "text-white font-semibold" : "text-zinc-500 font-medium group-hover:text-zinc-300"}`}>
                {it.label}
              </span>
            </>
          );
          const cls = "group relative flex flex-col items-center justify-center h-full active:scale-95 transition-transform";
          return it.href ? (
            <Link key={it.label} href={it.href} prefetch={true} aria-label={it.label} onClick={(e) => onNavigate(e, it.href!)} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={it.label} type="button" aria-label={it.label} onClick={it.onClick} className={`${cls} focus:outline-none`}>
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
