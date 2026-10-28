"use client";

import { ReactNode, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ExpiredPaywall } from "@/components/billing/ExpiredPaywall";
import { 
  LayoutDashboard, 
  Bot,
  Settings2,
  Package, 
  Tags,
  Layers, 
  ShoppingCart, 
  Users, 
  CreditCard,
  Settings,
  PanelLeftClose,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  LogOut,
  ShieldAlert,
  ArrowLeft,
  Menu,
  X,
  Ticket,
  Bell,
  Video,
  Film,
  DollarSign,
  Boxes
} from "lucide-react";

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Group items
  const botTelegramSubItems = [
    { name: "Configuração", href: "/seller/store", icon: Settings2 },
    { name: "Boas-vindas", href: "/seller/boas-vindas", icon: Sparkles },
    { name: "Banners", href: "/seller/banners", icon: ImageIcon },
    { name: "Produtos", href: "/seller/products", icon: Package },
    { name: "Combos", href: "/seller/combos", icon: Boxes },
    { name: "Biblioteca de Vídeos", href: "/seller/videos", icon: Film },
    { name: "Carrosséis", href: "/seller/carousels", icon: Layers },
    { name: "Categorias", href: "/seller/categories", icon: Tags },
    { name: "Clips", href: "/seller/bot/clips", icon: Video },
    { name: "Notificações", href: "/seller/bot/notifications", icon: Bell },
    { name: "Cupons", href: "/seller/coupons", icon: Ticket },
  ];

  const financeSubItems = [
    { name: "Visão Geral", href: "/seller/financeiro", icon: DollarSign },
    { name: "Gateways", href: "/seller/recebimentos", icon: CreditCard },
  ];

  // Root level items outside groups
  const dashboardItem = { name: "Dashboard", href: "/seller", icon: LayoutDashboard };
  const bottomRootItems = [
    { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
    { name: "Clientes", href: "/seller/customers", icon: Users },
    { name: "Configurações", href: "/seller/settings", icon: Settings },
  ];

  // Active child checks
  const isBotChildActive = botTelegramSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const isFinanceChildActive = financeSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  // Manual toggle state vs default route state
  const [userManuallyToggledBot, setUserManuallyToggledBot] = useState<boolean | null>(null);
  const [userManuallyToggledFinance, setUserManuallyToggledFinance] = useState<boolean | null>(null);

  // Reset manual toggle override & close mobile drawer when navigating to a new route
  useEffect(() => {
    setUserManuallyToggledBot(null);
    setUserManuallyToggledFinance(null);
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll and ESC key listener when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
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
  }, [mobileDrawerOpen]);

  const botGroupOpen = userManuallyToggledBot !== null ? userManuallyToggledBot : isBotChildActive;
  const financeGroupOpen = userManuallyToggledFinance !== null ? userManuallyToggledFinance : isFinanceChildActive;

  // Real Seller Profile State
  const [sellerProfile, setSellerProfile] = useState<{
    name: string;
    email: string;
    avatarUrl: string | null;
    role?: string;
  } | null>(null);

  // Subscription & Trial Info State
  const [subInfo, setSubInfo] = useState<{
    isSubscriptionActive: boolean;
    isTrialActive: boolean;
    trialDaysRemaining: number;
    status: string;
    isExempt: boolean;
    plan?: any;
    latestInvoice?: any;
  } | null>(null);

  useEffect(() => {
    const loadProfile = () => {
      fetch(`/api/seller/profile?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setSellerProfile(data.user);
          }
        })
        .catch(() => {});
    };

    const loadSubscription = () => {
      fetch(`/api/billing/subscription?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setSubInfo({
              isSubscriptionActive: data.data.isSubscriptionActive,
              isTrialActive: data.data.isTrialActive,
              trialDaysRemaining: data.data.trialDaysRemaining,
              status: data.data.subscription?.status || 'EXPIRED',
              isExempt: data.data.isExempt,
              plan: data.data.plan,
              latestInvoice: data.data.latestInvoice,
            });
          }
        })
        .catch(() => {});
    };

    loadProfile();
    loadSubscription();

    const handleUpdate = () => {
      loadProfile();
      loadSubscription();
    };

    window.addEventListener("seller-profile-updated", handleUpdate);
    return () => {
      window.removeEventListener("seller-profile-updated", handleUpdate);
    };
  }, []);

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  const isAdminOrSuperAdmin = sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin";

  const visibleBotSubItems = botTelegramSubItems.filter((item) => {
    if (item.href === "/seller/categories") {
      return isAdminOrSuperAdmin;
    }
    return true;
  });

  const renderNavContent = (isMobile = false) => {
    const isExpanded = isMobile || !collapsed;

    return (
      <>
        <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar px-2.5 space-y-1">
          {/* 1. Dashboard */}
          <Link 
            href={dashboardItem.href}
            onClick={() => isMobile && setMobileDrawerOpen(false)}
            title={!isExpanded ? dashboardItem.name : undefined}
            className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative ${
              pathname === dashboardItem.href 
                ? "bg-[#151619] text-zinc-100 border border-[#25272B] font-semibold" 
                : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
            }`}
          >
            {pathname === dashboardItem.href && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-blue-500 rounded-r-full" />
            )}
            <LayoutDashboard className={`w-4 h-4 shrink-0 transition-colors ${pathname === dashboardItem.href ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            {isExpanded && <span className="truncate">{dashboardItem.name}</span>}
          </Link>

          {/* 2. Bot Telegram Group (Expandable Parent Menu with Tree connections) */}
          <div className="space-y-0.5">
            {isExpanded ? (
              <>
                <button
                  type="button"
                  onClick={() => setUserManuallyToggledBot(!botGroupOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isBotChildActive
                      ? "text-zinc-200 font-semibold bg-[#151619]/60"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Bot className={`w-4 h-4 shrink-0 transition-colors ${isBotChildActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">Bot Telegram</span>
                  </div>
                  {botGroupOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
                  )}
                </button>

                {/* Submenu Tree with Curved SVG Connection Lines */}
                {botGroupOpen && (
                  <div className="relative pl-6 space-y-1 my-1">
                    {visibleBotSubItems.map((subItem, index) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                      const SubIcon = subItem.icon;
                      const isLast = index === visibleBotSubItems.length - 1;

                      return (
                        <div key={subItem.href} className="relative flex items-center">
                          {/* Curved SVG Tree Connection Line matching reference screenshot */}
                          <svg
                            className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none"
                            overflow="visible"
                          >
                            {/* Vertical Trunk Line */}
                            <line
                              x1="0"
                              y1="0"
                              x2="0"
                              y2={isLast ? "14" : "100%"}
                              stroke="rgba(255,255,255,0.12)"
                              strokeWidth="1.25"
                            />
                            {/* Curved Arc Branch */}
                            <path
                              d="M 0 0 V 8 Q 0 14 6 14 H 12"
                              fill="none"
                              stroke="rgba(255,255,255,0.12)"
                              strokeWidth="1.25"
                              strokeLinecap="round"
                            />
                          </svg>

                          <Link
                            href={subItem.href}
                            onClick={() => isMobile && setMobileDrawerOpen(false)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                              isSubActive
                                ? "bg-[#151619] text-zinc-100 font-semibold border border-[#25272B]"
                                : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                            }`}
                          >
                            {isSubActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[14px] bg-blue-500 rounded-r-full" />
                            )}
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                            <span className="truncate flex-1">{subItem.name}</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              visibleBotSubItems.map((subItem) => {
                const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                const SubIcon = subItem.icon;

                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    title={`Bot Telegram - ${subItem.name}`}
                    className={`flex items-center justify-center p-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                      isSubActive
                        ? "bg-[#151619] text-zinc-100 border border-[#25272B]"
                        : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                    }`}
                  >
                    {isSubActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-blue-500 rounded-r-full" />
                    )}
                    <SubIcon className={`w-4 h-4 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                  </Link>
                );
              })
            )}
          </div>

          {/* 3. Pedidos (Root) */}
          <Link 
            href="/seller/orders"
            onClick={() => isMobile && setMobileDrawerOpen(false)}
            title={!isExpanded ? "Pedidos" : undefined}
            className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative ${
              pathname === "/seller/orders"
                ? "bg-[#151619] text-zinc-100 border border-[#25272B] font-semibold" 
                : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
            }`}
          >
            {pathname === "/seller/orders" && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-blue-500 rounded-r-full" />
            )}
            <ShoppingCart className={`w-4 h-4 shrink-0 transition-colors ${pathname === "/seller/orders" ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            {isExpanded && <span className="truncate">Pedidos</span>}
          </Link>

          {/* 4. Financeiro Group (Expandable Parent Menu) */}
          <div className="space-y-0.5">
            {isExpanded ? (
              <>
                <button
                  type="button"
                  onClick={() => setUserManuallyToggledFinance(!financeGroupOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isFinanceChildActive
                      ? "text-zinc-200 font-semibold bg-[#151619]/60"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DollarSign className={`w-4 h-4 shrink-0 transition-colors ${isFinanceChildActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">Financeiro</span>
                  </div>
                  {financeGroupOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
                  )}
                </button>

                {financeGroupOpen && (
                  <div className="relative pl-6 space-y-1 my-1">
                    {financeSubItems.map((subItem, index) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                      const SubIcon = subItem.icon;
                      const isLast = index === financeSubItems.length - 1;

                      return (
                        <div key={subItem.href} className="relative flex items-center">
                          <svg
                            className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none"
                            overflow="visible"
                          >
                            <line
                              x1="0"
                              y1="0"
                              x2="0"
                              y2={isLast ? "14" : "100%"}
                              stroke="rgba(255,255,255,0.12)"
                              strokeWidth="1.25"
                            />
                            <path
                              d="M 0 0 V 8 Q 0 14 6 14 H 12"
                              fill="none"
                              stroke="rgba(255,255,255,0.12)"
                              strokeWidth="1.25"
                              strokeLinecap="round"
                            />
                          </svg>

                          <Link
                            href={subItem.href}
                            onClick={() => isMobile && setMobileDrawerOpen(false)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                              isSubActive
                                ? "bg-[#151619] text-zinc-100 font-semibold border border-[#25272B]"
                                : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                            }`}
                          >
                            {isSubActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[14px] bg-blue-500 rounded-r-full" />
                            )}
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                            <span className="truncate flex-1">{subItem.name}</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              financeSubItems.map((subItem) => {
                const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                const SubIcon = subItem.icon;

                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    title={`Financeiro - ${subItem.name}`}
                    className={`flex items-center justify-center p-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                      isSubActive
                        ? "bg-[#151619] text-zinc-100 border border-[#25272B]"
                        : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                    }`}
                  >
                    {isSubActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-blue-500 rounded-r-full" />
                    )}
                    <SubIcon className={`w-4 h-4 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                  </Link>
                );
              })
            )}
          </div>

          {/* 5. Clientes & Configurações */}
          {bottomRootItems.filter((item) => item.name !== "Pedidos").map((item) => {
            const isActive = pathname === item.href;
            const ItemIcon = item.icon;

            return (
              <Link 
                key={item.href}
                href={item.href} 
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? item.name : undefined}
                className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                  isActive 
                    ? "bg-[#151619] text-zinc-100 border border-[#25272B] font-semibold" 
                    : "bg-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] bg-blue-500 rounded-r-full" />
                )}

                <ItemIcon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                
                {isExpanded && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}

          {/* Active Trial Badge */}
          {isExpanded && subInfo?.isTrialActive && !subInfo?.isExempt && (
            <div className="mx-1 my-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Teste Grátis Ativo</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Restam <strong className="text-white font-bold">{subInfo.trialDaysRemaining} dia(s)</strong> de uso livre.
              </p>
            </div>
          )}

          {/* Back to Admin Button for Platform Owners */}
          {(sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin") && (
            <div className="pt-2 border-t border-white/[0.06] mt-2">
              <Link
                href="/admin"
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? "Voltar ao Admin" : undefined}
                className={`
                  flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3 py-2.5 rounded-xl text-xs font-medium 
                  text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] hover:border-white/20 
                  transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 group
                `}
              >
                <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all shrink-0" strokeWidth={1.8} />
                {isExpanded && <span className="truncate">Voltar ao Admin</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[#25272B] p-2.5">
          <div className={`flex items-center ${!isExpanded ? "justify-center" : "justify-between"} p-2 rounded-xl bg-[#151619] border border-[#25272B]`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#1A1C20] flex items-center justify-center border border-[#25272B] shrink-0 font-bold text-[11px] text-zinc-200 overflow-hidden">
                {sellerProfile?.avatarUrl ? (
                  <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initialLetter
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{sellerProfile?.name || "Vendedor"}</p>
                  <p className="text-[10px] text-zinc-400 truncate">Vendedor WebGran</p>
                </div>
              )}
            </div>
            
            {isExpanded && (
              <button 
                type="button"
                onClick={() => {
                  if (isMobile) setMobileDrawerOpen(false);
                  signOut({ callbackUrl: "/login" });
                }} 
                className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-[#1A1C20] transition-colors cursor-pointer" 
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-blue-500/20 overflow-x-hidden max-w-full">
      
      {/* Mobile Top Header (Sticky / Fixed) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0D0D0F] border-b border-[#25272B] z-40 px-4 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-1.5 text-zinc-300 hover:text-white bg-[#151619] hover:bg-zinc-800 rounded-lg border border-[#25272B] transition-all cursor-pointer"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/seller" className="flex items-center">
          <img 
            src="/logo-expanded.png" 
            alt="WebGran Logo" 
            className="h-8 w-auto max-w-[130px] object-contain" 
          />
        </Link>

        <div className="w-7 h-7 rounded-full bg-[#1A1C20] flex items-center justify-center border border-[#25272B] shrink-0 font-bold text-[11px] text-zinc-200 overflow-hidden">
          {sellerProfile?.avatarUrl ? (
            <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            initialLetter
          )}
        </div>
      </header>

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileDrawerOpen && (
        <div 
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 transition-opacity duration-200 md:hidden"
        />
      )}

      {/* Mobile Drawer Side-Over Panel */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[280px] bg-[#0D0D0F] border-r border-[#25272B] shadow-2xl flex flex-col transition-all duration-200 ease-in-out md:hidden ${
          mobileDrawerOpen ? "translate-x-0 opacity-100 pointer-events-auto visible" : "-translate-x-full opacity-0 pointer-events-none invisible"
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#25272B]">
          <Link href="/seller" className="flex items-center" onClick={() => setMobileDrawerOpen(false)}>
            <img 
              src="/logo-expanded.png" 
              alt="WebGran Logo" 
              className="h-8 w-auto max-w-[140px] object-contain" 
            />
          </Link>
          <button 
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white bg-[#151619] rounded-lg border border-[#25272B] cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderNavContent(true)}
      </aside>

      <div className="flex h-screen overflow-x-hidden max-w-full pt-14 md:pt-0">
        
        {/* Desktop Sidebar */}
        <aside 
          className={`bg-[#0D0D0F] border-r border-[#25272B] flex-shrink-0 hidden md:flex flex-col relative z-30 transition-all duration-200 ease-in-out shadow-xs ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Desktop Sidebar Header: Logo Area & Collapse Toggle */}
          <div className="h-14 px-3.5 flex items-center justify-between border-b border-[#25272B]">
            {!collapsed ? (
              <>
                <Link href="/seller" className="flex items-center">
                  <img 
                    src="/logo-expanded.png" 
                    alt="WebGran Logo" 
                    className="h-8 w-auto max-w-[160px] object-contain" 
                  />
                </Link>
                <button 
                  onClick={() => setCollapsed(!collapsed)}
                  title="Recolher menu"
                  className="p-1 text-zinc-400 hover:text-white bg-[#151619] hover:bg-zinc-800 rounded-lg border border-[#25272B] transition-all cursor-pointer shrink-0 ml-1"
                >
                  <PanelLeftClose className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </>
            ) : (
              <button 
                onClick={() => setCollapsed(!collapsed)}
                title="Expandir menu"
                className="w-full flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer py-1"
              >
                <img 
                  src="/logo-icon.png" 
                  alt="WebGran Icon" 
                  className="h-7 w-7 object-contain mx-auto" 
                />
              </button>
            )}
          </div>

          {renderNavContent(false)}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden bg-[#09090B]">
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-7 custom-scrollbar relative w-full max-w-full">
            
            <Suspense fallback={<div className="p-8 text-center text-zinc-400 animate-pulse text-xs font-mono">Carregando painel...</div>}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
