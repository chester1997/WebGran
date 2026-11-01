"use client";

import { ReactNode, useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import SellerSidebar, { SellerProfileData } from "./SellerSidebar";

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSidebarRef = useRef<HTMLElement | null>(null);
  const prevMobileOpenRef = useRef(mobileDrawerOpen);

  // Perfil do vendedor e faturamento real
  const [sellerProfile, setSellerProfile] = useState<SellerProfileData | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const SALES_GOAL = 15000.0;

  useEffect(() => {
    const loadProfile = () => {
      fetch(`/api/seller/profile?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setSellerProfile(data.user);
          }
          if (data.success && data.store?.totalPaidRevenue !== undefined) {
            setTotalRevenue(Number(data.store.totalPaidRevenue));
          }
        })
        .catch(() => {});
    };

    loadProfile();

    const handleUpdate = () => {
      loadProfile();
    };

    window.addEventListener("seller-profile-updated", handleUpdate);
    window.addEventListener("webgran-revenue-updated", handleUpdate);
    return () => {
      window.removeEventListener("seller-profile-updated", handleUpdate);
      window.removeEventListener("webgran-revenue-updated", handleUpdate);
    };
  }, []);

  // Fechar drawer móvel ao navegar
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Acessibilidade do drawer móvel: Focus trap e listener da tecla Escape
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
      mobileSidebarRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setMobileDrawerOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
      if (prevMobileOpenRef.current) {
        hamburgerButtonRef.current?.focus();
      }
    }
    prevMobileOpenRef.current = mobileDrawerOpen;
  }, [mobileDrawerOpen]);

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  return (
    <div
      style={
        {
          "--seller-bg": "#0B0D13",
          "--seller-surface": "#12141A",
          "--seller-surface-raised": "#181A20",
          "--seller-border": "rgba(255, 255, 255, 0.05)",
          "--seller-accent": "#10B981",
        } as React.CSSProperties
      }
      className="min-h-screen bg-[var(--seller-bg,#0B0D13)] text-zinc-100 antialiased selection:bg-emerald-500/25 selection:text-emerald-200"
    >
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[var(--seller-bg,#0B0D13)]">
        
        {/* Desktop Sidebar: Fixa à esquerda, sem colapso, scroll invisível */}
        <aside className="w-72 bg-[var(--seller-bg,#0B0D13)] h-full border-r border-white/5 shrink-0 hidden md:block">
          <SellerSidebar
            sellerProfile={sellerProfile}
            totalRevenue={totalRevenue}
            salesGoal={SALES_GOAL}
          />
        </aside>

        {/* Mobile Drawer Backdrop (Sem blur, fundo escuro simples semitransparente) */}
        {mobileDrawerOpen && (
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/75 z-50 md:hidden transition-opacity duration-200"
            aria-hidden="true"
          />
        )}

        {/* Mobile Drawer Panel */}
        <aside
          ref={mobileSidebarRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Menu do Vendedor"
          className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[288px] bg-[var(--seller-bg,#0B0D13)] border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SellerSidebar
            sellerProfile={sellerProfile}
            totalRevenue={totalRevenue}
            salesGoal={SALES_GOAL}
            isMobileDrawer
            onCloseMobile={() => setMobileDrawerOpen(false)}
          />
        </aside>

        {/* Content Canvas Wrapper */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden relative bg-[var(--seller-bg,#0B0D13)]">
          
          {/* Header Unificado (Mobile: barra compacta única <= 96px / Desktop: portal executivo) */}
          <header className="shrink-0 w-full bg-[var(--seller-bg,#0B0D13)] border-b border-white/[0.08] md:border-b-0 z-30 relative overflow-visible">
            {/* Linha Mobile Compacta (Menu + WebGran + Avatar): md:hidden */}
            <div className="md:hidden flex items-center justify-between px-3.5 pt-2 pb-1.5 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <button
                  ref={hamburgerButtonRef}
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="p-1.5 text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/10 transition-colors cursor-pointer shrink-0"
                  title="Abrir menu"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <Link href="/seller" className="flex items-center gap-1.5 shrink-0">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-[1px]">
                    <div className="w-full h-full bg-[#0B0D13] rounded-[4px] flex items-center justify-center">
                      <span className="font-black text-[9px] text-white">W</span>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-white tracking-tight">WebGran</span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Vendedor
                  </span>
                </Link>
              </div>

              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center border border-white/10 shrink-0 font-bold text-[10px] text-white overflow-hidden">
                {sellerProfile?.avatarUrl ? (
                  <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initialLetter
                )}
              </div>
            </div>

            {/* External Header Slot para Páginas do Seller (Portal) */}
            <div
              id="seller-page-header-portal"
              className="w-full px-3.5 sm:px-6 lg:px-8 md:pl-[25px] lg:pl-[33px] py-2 md:py-4 min-h-0 md:min-h-[88px] flex items-center relative z-30 overflow-visible"
            />
          </header>

          {/* Canvas de Conteúdo com Canto Superior Esquerdo Arredondado */}
          <main
            tabIndex={0}
            aria-label="Painel do Vendedor"
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--seller-bg,#0B0D13)] rounded-none md:rounded-tl-[24px] border-0 md:border-t md:border-l md:border-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 custom-scrollbar relative z-10"
          >
            <div className="w-full space-y-6">
              <Suspense fallback={<div className="p-8 text-center text-zinc-400 animate-pulse text-xs font-mono">Carregando painel...</div>}>
                {children}
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
