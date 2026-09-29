"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingCart, Compass, Film, Bookmark, LibraryBig, User, X, ChevronRight } from "lucide-react";
import { CartBadge } from "./CartBadge";

interface StudioBottomNavProps {
  storeSlug: string;
}

export function StudioBottomNav({ storeSlug }: StudioBottomNavProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const basePath = `/miniapp/${storeSlug}`;

  const [activeHref, setActiveHref] = useState<string>(pathname);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, startNavTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveHref(pathname);
    setIsMenuOpen(false);
  }, [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMenuOpen]);

  const activeHome      = (activeHref === basePath || activeHref === `${basePath}/`);
  const activeExplorar  = activeHref.startsWith(`${basePath}/search`);
  const activeCart      = activeHref.startsWith(`${basePath}/cart`);
  const activeClips     = activeHref.startsWith(`${basePath}/clips`);
  const activeFavorites = activeHref.startsWith(`${basePath}/favorites`);
  const activeAccesses  = activeHref.startsWith(`${basePath}/accesses`);
  const activeProfile   = activeHref.startsWith(`${basePath}/profile`);

  const activeMenuButton = activeFavorites || activeAccesses || activeProfile;

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveHref(href);
    startNavTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
      style={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
    >
      <div className="pointer-events-auto w-full max-w-[460px] px-4 mx-auto flex items-center justify-between select-none">
        
        {/* A) LEFT CIRCULAR MENU BUTTON & DROPDOWN MENU SUSPENSO */}
        <div className="relative" ref={menuRef}>
          {/* MENU SUSPENSO — POPUP / DROPDOWN PANEL */}
          {isMenuOpen && (
            <div
              className="absolute bottom-[66px] left-0 z-50 w-[220px] p-2 rounded-2xl
                         bg-white/90 dark:bg-[#121316]/95
                         backdrop-blur-xl
                         border border-zinc-200 dark:border-white/15
                         shadow-2xl shadow-black/20 dark:shadow-black/60
                         animate-in fade-in slide-in-from-bottom-3 duration-200"
            >
              <div className="flex flex-col gap-1">
                {/* Title / Header */}
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-white/10 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Menu do Usuário
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-0.5 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Meus Favoritos */}
                <Link
                  href={`${basePath}/favorites`}
                  prefetch={true}
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleNavClick(e, `${basePath}/favorites`);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                    activeFavorites
                      ? "bg-red-600 text-white font-semibold shadow-sm"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Bookmark className={`w-4 h-4 ${activeFavorites ? "text-white" : "text-red-500"}`} />
                    <span className="text-xs font-semibold">Meus Favoritos</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${activeFavorites ? "text-white/80" : "text-zinc-400"}`} />
                </Link>

                {/* 2. Meus Acessos */}
                <Link
                  href={`${basePath}/accesses`}
                  prefetch={true}
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleNavClick(e, `${basePath}/accesses`);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                    activeAccesses
                      ? "bg-red-600 text-white font-semibold shadow-sm"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LibraryBig className={`w-4 h-4 ${activeAccesses ? "text-white" : "text-amber-500 dark:text-amber-400"}`} />
                    <span className="text-xs font-semibold">Meus Acessos</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${activeAccesses ? "text-white/80" : "text-zinc-400"}`} />
                </Link>

                {/* 3. Meu Perfil */}
                <Link
                  href={`${basePath}/profile`}
                  prefetch={true}
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleNavClick(e, `${basePath}/profile`);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                    activeProfile
                      ? "bg-red-600 text-white font-semibold shadow-sm"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User className={`w-4 h-4 ${activeProfile ? "text-white" : "text-sky-500 dark:text-sky-400"}`} />
                    <span className="text-xs font-semibold">Meu Perfil</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${activeProfile ? "text-white/80" : "text-zinc-400"}`} />
                </Link>
              </div>
            </div>
          )}

          {/* LEFT TRIGGER BUTTON — ANCHORED AT FAR LEFT EDGE */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Menu de opções"
            aria-expanded={isMenuOpen}
            className={`relative w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center
                       backdrop-blur-md transition-all duration-200 cursor-pointer
                       border shadow-lg ${
                         isMenuOpen || activeMenuButton
                           ? "bg-red-600 border-red-500 text-white shadow-red-600/40"
                           : "bg-white/50 dark:bg-black/40 border-white/30 dark:border-white/10 shadow-black/10 dark:shadow-black/40 text-zinc-800 dark:text-zinc-200 hover:text-red-500"
                       }`}
          >
            <User className="relative z-10 w-[22px] h-[22px]" strokeWidth={2.0} />
          </button>
        </div>

        {/* B) MAIN PILL CAPSULE — 3 BUTTONS (EXPLORAR, INÍCIO, CARRINHO) */}
        <div
          className="relative flex items-center justify-around h-[54px] px-2 py-1.5 rounded-full gap-2
                     bg-white/50 dark:bg-black/40
                     backdrop-blur-md
                     border border-white/30 dark:border-white/10
                     shadow-lg shadow-black/10 dark:shadow-black/40"
        >
          {/* 1. Explorar */}
          <Link
            href={`${basePath}/search`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/search`)}
            aria-label="Explorar"
            className="relative z-10 flex items-center justify-center"
          >
            {activeExplorar ? (
              <div className="w-[42px] h-[42px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/40">
                <Compass className="w-[20px] h-[20px] stroke-[2]" />
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <Compass className="w-[20px] h-[20px]" strokeWidth={1.8} />
              </div>
            )}
          </Link>

          {/* 2. Início */}
          <Link
            href={basePath}
            prefetch={true}
            onClick={(e) => handleNavClick(e, basePath)}
            aria-label="Início"
            className="relative z-10 flex items-center justify-center"
          >
            {activeHome ? (
              <div className="h-[42px] px-3.5 rounded-full bg-red-600 text-white font-semibold flex items-center gap-2 shadow-md shadow-red-600/40">
                <Home className="w-[20px] h-[20px] stroke-[2] shrink-0" />
                <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
                  Início
                </span>
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <Home className="w-[20px] h-[20px]" strokeWidth={1.8} />
              </div>
            )}
          </Link>

          {/* 3. Carrinho */}
          <Link
            href={`${basePath}/cart`}
            prefetch={true}
            onClick={(e) => handleNavClick(e, `${basePath}/cart`)}
            aria-label="Carrinho"
            className="relative z-10 flex items-center justify-center"
          >
            {activeCart ? (
              <div className="w-[42px] h-[42px] rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/40">
                <div className="relative flex items-center justify-center">
                  <ShoppingCart className="w-[20px] h-[20px]" strokeWidth={2.0} />
                  <CartBadge active={true} />
                </div>
              </div>
            ) : (
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <div className="relative flex items-center justify-center">
                  <ShoppingCart className="w-[20px] h-[20px]" strokeWidth={1.8} />
                  <CartBadge active={false} />
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* C) SEPARATED CIRCULAR CLIPS BUTTON — ANCHORED AT FAR RIGHT EDGE */}
        <Link
          href={`${basePath}/clips`}
          prefetch={true}
          onClick={(e) => handleNavClick(e, `${basePath}/clips`)}
          aria-label="Clips"
          className={`relative w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center
                     backdrop-blur-md transition-all duration-200
                     border shadow-lg ${
                       activeClips
                         ? "bg-red-600 border-red-500 text-white shadow-red-600/40"
                         : "bg-white/50 dark:bg-black/40 border-white/30 dark:border-white/10 shadow-black/10 dark:shadow-black/40 text-red-600 dark:text-red-500 hover:text-red-500"
                     }`}
        >
          <Film className="relative z-10 w-[24px] h-[24px]" strokeWidth={2.2} />
        </Link>

      </div>
    </nav>
  );
}
