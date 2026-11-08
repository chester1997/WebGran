"use client";

import { ReactNode, useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import SellerSidebar, { SellerProfileData } from "./SellerSidebar";
import { SaleNotificationSoundHandler } from "@/components/audio/SaleNotificationSoundHandler";

interface SellerLayoutProps {
  children: ReactNode;
}

function SellerLayoutContent({ children }: SellerLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSidebarRef = useRef<HTMLElement | null>(null);
  const prevMobileOpenRef = useRef(mobileDrawerOpen);
  const DRAWER_STATE_KEY = "webgran_mobile_drawer";
  const drawerHistoryPushedRef = useRef(false);
  const isHandlingPopStateRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

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

  // Fechar drawer móvel e sincronizar estados ao alterar rota
  useEffect(() => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    pendingNavigationRef.current = null;
    drawerHistoryPushedRef.current = false;
    isHandlingPopStateRef.current = false;
    isNavigatingRef.current = false;
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleMobileNavigate = (href: string) => {
    if (href === pathname) {
      setMobileDrawerOpen(false);
      return;
    }

    if (drawerHistoryPushedRef.current) {
      pendingNavigationRef.current = href;
      drawerHistoryPushedRef.current = false;
      setMobileDrawerOpen(false);

      if (typeof window !== "undefined") {
        window.history.back();
      }

      navigationTimeoutRef.current = setTimeout(() => {
        if (pendingNavigationRef.current) {
          const target = pendingNavigationRef.current;
          pendingNavigationRef.current = null;
          router.push(target);
        }
      }, 150);
    } else {
      setMobileDrawerOpen(false);
      router.push(href);
    }
  };

  // Suporte ao gesto/botão voltar do Android (popstate) e coordenação de navegação
  useEffect(() => {
    const handlePopState = () => {
      if (pendingNavigationRef.current) {
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
          navigationTimeoutRef.current = null;
        }
        const target = pendingNavigationRef.current;
        pendingNavigationRef.current = null;
        drawerHistoryPushedRef.current = false;
        isHandlingPopStateRef.current = true;
        setMobileDrawerOpen(false);
        router.push(target);
        return;
      }

      if (mobileDrawerOpen) {
        isHandlingPopStateRef.current = true;
        drawerHistoryPushedRef.current = false;
        setMobileDrawerOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [mobileDrawerOpen, router]);

  // Acessibilidade do drawer móvel e sincronização de histórico
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
      mobileSidebarRef.current?.focus();

      if (!drawerHistoryPushedRef.current && typeof window !== "undefined") {
        window.history.pushState({ [DRAWER_STATE_KEY]: true }, "");
        drawerHistoryPushedRef.current = true;
      }

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

      if (isHandlingPopStateRef.current) {
        isHandlingPopStateRef.current = false;
    isNavigatingRef.current = false;
      } else if (drawerHistoryPushedRef.current) {
        drawerHistoryPushedRef.current = false;
        if (typeof window !== "undefined" && window.history.state?.[DRAWER_STATE_KEY]) {
          window.history.back();
        }
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
          "--seller-bg": "#0A0A0A",
          "--seller-surface": "#101218",
          "--seller-surface-raised": "#151821",
          "--seller-border": "rgba(255, 255, 255, 0.06)",
          "--seller-accent": "#3984FF",
          "--seller-accent-deep": "#1D4ED8",
          "--seller-accent-light": "#60A5FA",
          "--seller-accent-glow": "rgba(57, 132, 255, 0.12)",
          "--sidebar-mobile-w": "min(296px, 85vw)",
        } as React.CSSProperties
      }
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[var(--seller-bg,#0A0A0A)] text-zinc-100 antialiased selection:bg-[#3984FF]/25 selection:text-[#93C5FD]"
    >
      <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-[var(--seller-bg,#0A0A0A)] relative">

        {/* Desktop Sidebar: Fixa à esquerda, sem colapso, scroll invisível */}
        <aside className="w-[var(--sidebar-w,320px)] bg-[var(--seller-bg,#0A0A0A)] h-full shrink-0 hidden lg:block">
          <SellerSidebar
            sellerProfile={sellerProfile}
            totalRevenue={totalRevenue}
            salesGoal={SALES_GOAL}
          />
        </aside>

        {/* Mobile Drawer Backdrop (Transição suave sincronizada) */}
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className={`fixed inset-0 bg-black/60 z-[60] lg:hidden transition-opacity duration-300 ease-in-out ${
            mobileDrawerOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          aria-hidden="true"
        />

        {/* Mobile Drawer Panel (Push drawer com 300ms ease-in-out) */}
        <aside
          ref={mobileSidebarRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Menu do Vendedor"
          className={`fixed inset-y-0 left-0 z-[70] w-[var(--sidebar-mobile-w,296px)] max-w-[85vw] h-[100dvh] bg-[var(--seller-bg,#0A0A0A)] border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out will-change-transform outline-none focus:outline-none overscroll-contain lg:hidden ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SellerSidebar
            sellerProfile={sellerProfile}
            totalRevenue={totalRevenue}
            salesGoal={SALES_GOAL}
            isMobileDrawer
            onCloseMobile={() => setMobileDrawerOpen(false)}
            onNavigateMobile={handleMobileNavigate}
          />
        </aside>

        {/* Content Canvas Wrapper (Acompanha o movimento empurrando suavemente para a direita) */}
        <div
          className={`flex-1 min-h-0 flex flex-col min-w-0 w-full overflow-hidden relative bg-[var(--seller-bg,#0A0A0A)] transition-transform duration-300 ease-in-out will-change-transform lg:transition-none lg:transform-none ${
            mobileDrawerOpen
              ? "translate-x-[var(--sidebar-mobile-w,296px)] lg:translate-x-0"
              : "translate-x-0"
          }`}
        >

          {/* Header Unificado (Mobile: barra compacta única <= 96px / Desktop: portal executivo) */}
          <header className="flex-none shrink-0 grow-0 w-full bg-[var(--seller-bg,#0A0A0A)] border-b border-white/[0.08] lg:border-b-0 z-30 relative overflow-visible">
            {/* Linha Mobile Refinada (Menu + WebGran Logo Oficial + Avatar): lg:hidden */}
            <div className="lg:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#0A0A0A]">
              <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                <button
                  ref={hamburgerButtonRef}
                  type="button"
                  onClick={() => setMobileDrawerOpen((prev) => !prev)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/10 transition-colors cursor-pointer shrink-0"
                  title={mobileDrawerOpen ? "Fechar menu" : "Abrir menu"}
                  aria-label={mobileDrawerOpen ? "Fechar menu" : "Abrir menu"}
                  aria-expanded={mobileDrawerOpen}
                >
                  <Menu className="w-4 h-4" />
                </button>

                <Link href="/seller" className="flex items-center gap-2.5 shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center shadow-sm select-none">
                    <Image
                      src="/logo-webgran-icon.png"
                      alt="WebGran"
                      width={32}
                      height={32}
                      priority
                      className="w-full h-full object-cover scale-[1.38]"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[14px] text-white tracking-tight leading-tight whitespace-nowrap">
                      WebGran
                    </span>
                    <span className="text-[10px] font-medium text-[#3984FF] tracking-normal leading-tight whitespace-nowrap">
                      Painel do Vendedor
                    </span>
                  </div>
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

            {/* External Header Slot para Páginas do Seller (Portal) com altura uniforme de 112px no desktop e padding vertical refinado no mobile */}
            <div
              id="seller-page-header-portal"
              className="w-full px-4 sm:px-6 md:px-7 lg:px-8 pt-3.5 pb-4 lg:py-0 min-h-0 lg:min-h-[var(--header-h,112px)] h-auto flex items-center relative z-30 overflow-visible"
            />
          </header>

          {/* Canvas de Conteúdo com Canto Superior Esquerdo Arredondado e Fundo Sólido Uniforme */}
          <div className="flex-1 min-h-0 flex flex-col min-w-0 relative overflow-hidden bg-[var(--seller-bg,#0A0A0A)] rounded-none lg:rounded-tl-[24px] border-0 lg:border-t lg:border-l lg:border-white/10 z-10">
            {/* Área de Rolagem do Conteúdo */}
            <main
              tabIndex={0}
              aria-label="Painel do Vendedor"
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 md:px-7 lg:px-8 pt-4 sm:pt-6 pb-6 md:pb-8 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 custom-scrollbar relative z-10"
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

export default function SellerLayout({ children }: SellerLayoutProps) {
  return (
    <Suspense fallback={<div className="h-full w-full bg-[#0A0A0A]" />}>
      <SellerLayoutContent>{children}</SellerLayoutContent>
    </Suspense>
  );
}
