"use client";

import { ReactNode, useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import SellerSidebar, { SellerProfileData } from "./SellerSidebar";
import { SaleNotificationSoundHandler } from "@/components/audio/SaleNotificationSoundHandler";

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
        .catch(() => { });
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

  useEffect(() => {
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  return (
    <div
      style={
        {
          "--seller-bg": "#0B0F14",
          "--seller-surface": "#101218",
          "--seller-surface-raised": "#151821",
          "--seller-border": "rgba(255, 255, 255, 0.06)",
          "--seller-accent": "#3984FF",
          "--seller-accent-deep": "#1D4ED8",
          "--seller-accent-light": "#60A5FA",
          "--seller-accent-glow": "rgba(57, 132, 255, 0.12)",
        } as React.CSSProperties
      }
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[var(--seller-bg,#0B0F14)] text-zinc-100 antialiased selection:bg-[#3984FF]/25 selection:text-[#93C5FD]"
    >
      <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-[var(--seller-bg,#0B0F14)]">

        {/* Desktop Sidebar: Fixa à esquerda, sem colapso, scroll invisível */}
        <aside className="w-[282px] xl:w-[290px] bg-[var(--seller-bg,#0B0F14)] h-full shrink-0 hidden lg:block">
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
            className="fixed inset-0 bg-black/75 z-[60] lg:hidden transition-opacity duration-200"
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
          className={`fixed inset-y-0 left-0 z-[70] w-[290px] max-w-[85vw] bg-[var(--seller-bg,#0B0F14)] border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out lg:hidden ${mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
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
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden relative bg-[var(--seller-bg,#0B0F14)]">

          {/* Header Unificado (Mobile: barra compacta única <= 96px / Desktop: portal executivo) */}
          <header className="flex-none shrink-0 grow-0 w-full bg-[var(--seller-bg,#0B0F14)] border-b border-white/[0.08] lg:border-b-0 z-30 relative overflow-visible">
            {/* Linha Mobile Refinada (Menu + WebGran Logo Oficial + Avatar): lg:hidden */}
            <div className="lg:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#0B0F14]">
              <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                <button
                  ref={hamburgerButtonRef}
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/10 transition-colors cursor-pointer shrink-0"
                  title="Abrir menu"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <Link href="/seller" className="flex items-center gap-2 shrink-0">
                  <Image
                    src="/logo-webgran-icon.png"
                    alt="WebGran"
                    width={32}
                    height={32}
                    priority
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-contain shrink-0"
                  />
                  <span className="font-semibold text-sm text-white tracking-tight shrink-0 whitespace-nowrap">
                    WebGran
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 tracking-wider uppercase shrink-0">
                    Vendedor
                  </span>
                </Link>
              </div>

              <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] flex items-center justify-center border border-[#3984FF]/30 shrink-0 font-bold text-[11px] text-white overflow-hidden">
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
              className="w-full px-6 md:px-7 lg:px-8 py-2 md:py-3.5 min-h-0 flex items-center relative z-30 overflow-visible"
            />
          </header>

          {/* Canvas de Conteúdo com Canto Superior Esquerdo Arredondado e Fundo Sólido Uniforme */}
          <div className="flex-1 min-h-0 flex flex-col min-w-0 relative overflow-hidden bg-[var(--seller-bg,#0B0F14)] rounded-none lg:rounded-tl-[24px] border-0 lg:border-t lg:border-l lg:border-white/10 z-10">
            {/* Área de Rolagem do Conteúdo */}
            <main
              tabIndex={0}
              aria-label="Painel do Vendedor"
              className="flex-1 min-h-0 overflow-y-auto px-6 md:px-7 lg:px-8 pt-4 sm:pt-6 pb-6 md:pb-8 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 custom-scrollbar relative z-10"
            >
              <SaleNotificationSoundHandler />
              <div className="w-full relative z-10 overflow-clip">
                <Suspense fallback={<div className="p-8 text-center text-zinc-400 animate-pulse text-xs font-mono">Carregando painel...</div>}>
                  {children}
                </Suspense>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
