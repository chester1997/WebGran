"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Heart, LibraryBig, Search, ShoppingCart, Headphones } from "lucide-react";
import { CartBadge } from "./CartBadge";
import { parseSupportConfig, openSupportLink } from "@/lib/support/support-helper";

interface StudioBottomNavProps {
  storeSlug: string;
  supportType?: string | null;
  supportValue?: string | null;
}

export function StudioBottomNav({
  storeSlug,
  supportType,
  supportValue,
}: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const basePath = `/miniapp/${storeSlug}`;

  const [activeHref, setActiveHref] = useState<string>(pathname);
  const [, startNavTransition] = useTransition();

  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  const supportConfig = parseSupportConfig(supportType, supportValue);
  const hasValidSupport = supportConfig.isValid;

  const activeHome = activeHref === basePath || activeHref === `${basePath}/`;
  const activeFavorites = activeHref.startsWith(`${basePath}/favorites`);
  const activeAccesses = activeHref.startsWith(`${basePath}/accesses`);
  const activeSearch = activeHref.startsWith(`${basePath}/search`);
  const activeCart = activeHref.startsWith(`${basePath}/cart`);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    setActiveHref(href);
    startNavTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#0d0e12]/95 dark:bg-[#090a0d]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.6)] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto select-none"
    >
      <div
        className={`mx-auto grid ${
          hasValidSupport
            ? "grid-cols-6 max-w-[540px]"
            : "grid-cols-5 max-w-[480px]"
        } h-[64px] px-1 items-center relative`}
      >
        {/* 1. INÍCIO (Extremidade esquerda) */}
        <Link
          href={basePath}
          prefetch={true}
          onClick={(e) => handleNavClick(e, basePath)}
          aria-label="Início"
          className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group"
        >
          {activeHome && (
            <div
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1 rounded-xl bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] pointer-events-none transition-all duration-300"
            />
          )}
          <div className="relative flex items-center justify-center">
            <Home
              className={`w-5 h-5 transition-all duration-200 ${
                activeHome
                  ? "text-red-500 stroke-[2.2] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 ${
              activeHome
                ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]"
                : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Início
          </span>
        </Link>

        {/* 2. FAVORITOS */}
        <Link
          href={`${basePath}/favorites`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/favorites`)}
          aria-label="Favoritos"
          className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group"
        >
          {activeFavorites && (
            <div
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1 rounded-xl bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] pointer-events-none transition-all duration-300"
            />
          )}
          <div className="relative flex items-center justify-center">
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${
                activeFavorites
                  ? "text-red-500 fill-red-500/20 stroke-[2.2] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 ${
              activeFavorites
                ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]"
                : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Favoritos
          </span>
        </Link>

        {/* 3. ACESSOS */}
        <Link
          href={`${basePath}/accesses`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/accesses`)}
          aria-label="Acessos"
          className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group"
        >
          {activeAccesses && (
            <div
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1 rounded-xl bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] pointer-events-none transition-all duration-300"
            />
          )}
          <div className="relative flex items-center justify-center">
            <LibraryBig
              className={`w-5 h-5 transition-all duration-200 ${
                activeAccesses
                  ? "text-red-500 fill-red-500/20 stroke-[2.2] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 ${
              activeAccesses
                ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]"
                : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Acessos
          </span>
        </Link>

        {/* 4. BUSCA */}
        <Link
          href={`${basePath}/search`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/search`)}
          aria-label="Busca"
          className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group"
        >
          {activeSearch && (
            <div
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1 rounded-xl bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] pointer-events-none transition-all duration-300"
            />
          )}
          <div className="relative flex items-center justify-center">
            <Search
              className={`w-5 h-5 transition-all duration-200 ${
                activeSearch
                  ? "text-red-500 stroke-[2.2] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
          </div>
          <span
            className={`text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 ${
              activeSearch
                ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]"
                : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Busca
          </span>
        </Link>

        {/* 5. CARRINHO */}
        <Link
          href={`${basePath}/cart`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/cart`)}
          aria-label="Carrinho"
          className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group"
        >
          {activeCart && (
            <div
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1 rounded-xl bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] pointer-events-none transition-all duration-300"
            />
          )}
          <div className="relative flex items-center justify-center">
            <ShoppingCart
              className={`w-5 h-5 transition-all duration-200 ${
                activeCart
                  ? "text-red-500 stroke-[2.2] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  : "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              }`}
            />
            <CartBadge active={activeCart} />
          </div>
          <span
            className={`text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 ${
              activeCart
                ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]"
                : "text-zinc-400 group-hover:text-zinc-200"
            }`}
          >
            Carrinho
          </span>
        </Link>

        {/* 6. SUPORTE (Renderizado apenas quando configuração for válida) */}
        {hasValidSupport && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              openSupportLink(supportConfig);
            }}
            aria-label="Suporte"
            className="relative flex flex-col items-center justify-center py-1 h-full transition-transform duration-200 active:scale-95 group focus:outline-none"
          >
            <div className="relative flex items-center justify-center">
              <Headphones
                className="w-5 h-5 transition-all duration-200 text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]"
              />
            </div>
            <span
              className="text-[9.5px] sm:text-[10px] font-medium mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 text-center transition-colors duration-200 text-zinc-400 group-hover:text-zinc-200"
            >
              Suporte
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
