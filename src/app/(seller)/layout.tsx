"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
  Ticket
} from "lucide-react";

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Sub-items for "Bot Telegram" group
  const botTelegramSubItems = [
    { name: "Configuração", href: "/seller/store", icon: Settings2 },
    { name: "Boas-vindas", href: "/seller/boas-vindas", icon: Sparkles },
    { name: "Banners", href: "/seller/banners", icon: ImageIcon },
    { name: "Produtos", href: "/seller/products", icon: Package },
    { name: "Carrosséis", href: "/seller/carousels", icon: Layers },
    { name: "Categorias", href: "/seller/categories", icon: Tags },
    { name: "Cupons", href: "/seller/coupons", icon: Ticket },
  ];

  // Root level items outside the group
  const dashboardItem = { name: "Dashboard", href: "/seller", icon: LayoutDashboard };
  const bottomRootItems = [
    { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
    { name: "Recebimento", href: "/seller/recebimentos", icon: CreditCard },
    { name: "Clientes", href: "/seller/customers", icon: Users },
    { name: "Configurações", href: "/seller/settings", icon: Settings },
  ];

  // Check if currently navigating inside any Bot Telegram child route
  const isBotChildActive = botTelegramSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  // Manual toggle state vs default route state
  const [userManuallyToggled, setUserManuallyToggled] = useState<boolean | null>(null);

  // Reset manual toggle override & close mobile drawer when navigating to a new route
  useEffect(() => {
    setUserManuallyToggled(null);
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

  // Group is open if user explicitly toggled it, or (if not manually toggled) if currently on a bot child route
  const botGroupOpen = userManuallyToggled !== null ? userManuallyToggled : isBotChildActive;

  const handleToggleBotGroup = () => {
    setUserManuallyToggled(!botGroupOpen);
  };

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
              status: data.data.subscription.status,
              isExempt: data.data.isExempt,
            });
          }
        })
        .catch(() => {});
    };

    loadProfile();
    loadSubscription();

    window.addEventListener("seller-profile-updated", loadProfile);
    return () => {
      window.removeEventListener("seller-profile-updated", loadProfile);
    };
  }, []);

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  const renderNavContent = (isMobile = false) => {
    const isExpanded = isMobile || !collapsed;

    return (
      <>
        <nav className="flex-1 overflow-y-auto py-5 custom-scrollbar px-3 space-y-1">
          {/* 1. Dashboard */}
          <Link 
            href={dashboardItem.href}
            onClick={() => isMobile && setMobileDrawerOpen(false)}
            title={!isExpanded ? dashboardItem.name : undefined}
            className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden ${
              pathname === dashboardItem.href 
                ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]" 
                : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {pathname === dashboardItem.href && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]" />
            )}
            <LayoutDashboard className={`w-5 h-5 shrink-0 transition-colors ${pathname === dashboardItem.href ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            {isExpanded && <span className="truncate">{dashboardItem.name}</span>}
          </Link>

          {/* 2. Bot Telegram Group (Expandable Parent Menu) */}
          <div className="space-y-1">
            {isExpanded ? (
              <>
                {/* Parent Group Header Button */}
                <button
                  type="button"
                  onClick={handleToggleBotGroup}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isBotChildActive
                      ? "text-white font-semibold bg-white/[0.03]"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Bot className={`w-5 h-5 shrink-0 transition-colors ${isBotChildActive ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">Bot Telegram</span>
                  </div>
                  {botGroupOpen ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200" strokeWidth={1.8} />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200" strokeWidth={1.8} />
                  )}
                </button>

                {/* Submenus (Indented with connecting line) */}
                {botGroupOpen && (
                  <div className="ml-5 pl-3 border-l border-white/10 space-y-1 my-1 transition-all duration-200 ease-in-out">
                    {botTelegramSubItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                      const SubIcon = subItem.icon;

                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => isMobile && setMobileDrawerOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 relative overflow-hidden ${
                            isSubActive
                              ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                              : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {isSubActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-red-500 rounded-r-[3px] shadow-[0_0_8px_#ef4444]" />
                          )}
                          <SubIcon className={`w-[17px] h-[17px] shrink-0 transition-colors ${isSubActive ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                          <span className="truncate">{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Collapsed mode icons (Desktop only) */
              botTelegramSubItems.map((subItem) => {
                const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                const SubIcon = subItem.icon;

                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    title={`Bot Telegram - ${subItem.name}`}
                    className={`flex items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden ${
                      isSubActive
                        ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                        : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {isSubActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]" />
                    )}
                    <SubIcon className={`w-5 h-5 shrink-0 transition-colors ${isSubActive ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                  </Link>
                );
              })
            )}
          </div>

          {/* 3. Bottom Root Level Items */}
          {bottomRootItems.map((item) => {
            const isActive = pathname === item.href;
            const ItemIcon = item.icon;

            return (
              <Link 
                key={item.href}
                href={item.href} 
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? item.name : undefined}
                className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden ${
                  isActive 
                    ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]" 
                    : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]" />
                )}

                <ItemIcon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                
                {isExpanded && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}

          {/* Active Trial Badge */}
          {isExpanded && subInfo?.isTrialActive && !subInfo?.isExempt && (
            <div className="mx-1.5 my-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>Teste Grátis Ativo</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Restam <strong className="text-white font-bold">{subInfo.trialDaysRemaining} dia(s)</strong> de uso livre.
              </p>
            </div>
          )}

          {/* Back to Admin Button for Platform Owners */}
          {(sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin") && (
            <div className="pt-3 border-t border-white/5 mt-3">
              <Link
                href="/admin"
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? "Voltar ao Admin" : undefined}
                className={`flex items-center ${!isExpanded ? "justify-center" : "justify-start"} gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all shadow-md shadow-red-950/30 group`}
              >
                <ArrowLeft className="w-4 h-4 text-red-400 group-hover:-translate-x-0.5 transition-transform shrink-0" strokeWidth={2} />
                {isExpanded && <span className="truncate">⚙️ Voltar ao Admin</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center ${!isExpanded ? "justify-center" : "justify-between"} p-2.5 rounded-xl bg-[#16161C] border border-white/5`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0 font-bold text-xs text-white overflow-hidden">
                {sellerProfile?.avatarUrl ? (
                  <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initialLetter
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{sellerProfile?.name || "Vendedor"}</p>
                  <p className="text-[11px] text-zinc-500 truncate">Vendedor</p>
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
                className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors cursor-pointer" 
                title="Sair"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-red-500/30 overflow-x-hidden max-w-full">
      
      {/* Mobile Top Header (Sticky / Fixed) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0F0F12] border-b border-white/10 z-40 px-4 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 text-zinc-300 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-lg border border-white/5 transition-all cursor-pointer"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/seller" className="flex items-center">
          <img 
            src="/logo-expanded.png" 
            alt="WebGran Logo" 
            className="h-9 w-auto max-w-[140px] object-contain drop-shadow-md" 
          />
        </Link>

        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0 font-bold text-xs text-white overflow-hidden">
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden"
        />
      )}

      {/* Mobile Drawer Side-Over Panel */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] bg-[#0F0F12] border-r border-white/10 shadow-2xl flex flex-col transition-all duration-300 ease-in-out md:hidden ${
          mobileDrawerOpen ? "translate-x-0 opacity-100 pointer-events-auto visible" : "-translate-x-full opacity-0 pointer-events-none invisible"
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-[#101114]">
          <Link href="/seller" className="flex items-center" onClick={() => setMobileDrawerOpen(false)}>
            <img 
              src="/logo-expanded.png" 
              alt="WebGran Logo" 
              className="h-9 w-auto max-w-[150px] object-contain drop-shadow-md" 
            />
          </Link>
          <button 
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-lg border border-white/5 transition-all cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderNavContent(true)}
      </aside>

      <div className="flex h-screen overflow-x-hidden max-w-full pt-14 md:pt-0">
        
        {/* Desktop Sidebar (Preserved exactly as is for >= md) */}
        <aside 
          className={`bg-[#0F0F12] border-r border-white/5 flex-shrink-0 hidden md:flex flex-col relative z-30 transition-all duration-300 ease-in-out shadow-[10px_0_30px_rgba(0,0,0,0.8)] ${
            collapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Desktop Sidebar Header: Logo Area & Collapse Toggle */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-[#101114]">
            {!collapsed ? (
              <>
                <Link href="/seller" className="flex items-center">
                  <img 
                    src="/logo-expanded.png" 
                    alt="WebGran Logo" 
                    className="h-12 w-auto max-w-[195px] object-contain drop-shadow-md" 
                  />
                </Link>
                <button 
                  onClick={() => setCollapsed(!collapsed)}
                  title="Recolher menu"
                  className="p-1.5 text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-lg border border-white/5 transition-all cursor-pointer shrink-0 ml-1"
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
                  className="h-9 w-9 object-contain drop-shadow-md mx-auto" 
                />
              </button>
            )}
          </div>

          {renderNavContent(false)}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden bg-[#070709]">
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 custom-scrollbar relative w-full max-w-full">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            
            {subInfo && subInfo.isSubscriptionActive === false && !pathname.startsWith("/seller/settings") ? (
              /* BLOCKING PAYWALL FOR EXPIRED 3-DAY TRIAL */
              <div className="min-h-[500px] flex items-center justify-center p-6 fade-in">
                <div className="max-w-lg w-full bg-[#121215] border border-red-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-60 h-60 bg-red-600/20 rounded-full blur-[80px] pointer-events-none" />
                  
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500 shadow-lg shadow-red-500/10">
                    <ShieldAlert className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Seu período de teste de 3 dias expirou!
                    </h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Para continuar utilizando todas as funcionalidades da sua loja e gerenciando seus produtos no Telegram, realize o pagamento da assinatura mensal.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#18181C] border border-white/5 space-y-3 text-left">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs text-zinc-400 font-medium">Plano Único WebGran</span>
                      <span className="text-sm font-black text-white">R$ 89,90 / mês</span>
                    </div>
                    <ul className="text-xs text-zinc-300 space-y-1.5">
                      <li className="flex items-center gap-2 text-emerald-400">✓ Bot Telegram e Miniapp ativados</li>
                      <li className="flex items-center gap-2 text-emerald-400">✓ Vendas e PIX direto na sua conta Mercado Pago</li>
                      <li className="flex items-center gap-2 text-emerald-400">✓ Produtos, clientes e categorias ilimitados</li>
                    </ul>
                  </div>

                  <Link
                    href="/seller/settings?tab=assinatura"
                    className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar Assinatura (R$ 89,90 via PIX)
                  </Link>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
