"use client";

import { ReactNode, useState, useEffect, Suspense } from "react";
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
  DollarSign,
  Settings,
  PanelLeftClose,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Ticket,
  Bell,
  Video,
  Film,
  Boxes,
  TrendingUp,
  CreditCard
} from "lucide-react";

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // BOT TELEGRAM Subitens
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

  // VENDAS Subitens
  const salesItems = [
    { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
    { name: "Financeiro", href: "/seller/financeiro", icon: DollarSign },
    { name: "Clientes", href: "/seller/customers", icon: Users },
  ];

  // Active child checks
  const isBotChildActive = botTelegramSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  // Manual toggle state vs default route state
  const [userManuallyToggledBot, setUserManuallyToggledBot] = useState<boolean | null>(null);

  // Reset manual toggle override & close mobile drawer when navigating to a new route
  useEffect(() => {
    setUserManuallyToggledBot(null);
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

  // Real Seller Profile & Revenue State
  const [sellerProfile, setSellerProfile] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role?: string;
  } | null>(null);

  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const SALES_GOAL = 15000.0; // R$ 15.000,00 conforme especificação oficial

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

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();
  const isAdminOrSuperAdmin = sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin";

  const visibleBotSubItems = botTelegramSubItems.filter((item) => {
    if (item.href === "/seller/categories") {
      return isAdminOrSuperAdmin;
    }
    return true;
  });

  // Métricas de progresso do volume de vendas
  const percentage = Math.min(100, Math.max(0, (totalRevenue / SALES_GOAL) * 100));
  const formattedRevenue = totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedGoal = SALES_GOAL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const renderNavContent = (isMobile = false) => {
    const isExpanded = isMobile || !collapsed;

    return (
      <div className="flex-1 flex flex-col justify-between min-h-0">
        {/* Navegação estruturada em Seções */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 custom-scrollbar space-y-4">
          
          {/* ========================================= */}
          {/* SEÇÃO 1: PRINCIPAL */}
          {/* ========================================= */}
          <div>
            {isExpanded && (
              <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 font-mono select-none">
                Principal
              </p>
            )}
            <div className="space-y-0.5">
              <Link 
                href="/seller"
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? "Dashboard" : undefined}
                className={`group flex items-center ${!isExpanded ? "justify-center px-2" : "justify-start px-3"} py-2 rounded-xl text-[13px] font-medium transition-all duration-150 relative ${
                  pathname === "/seller" 
                    ? "bg-[#18181C] text-white font-semibold border border-white/5 shadow-xs" 
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                {pathname === "/seller" && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                )}
                <LayoutDashboard className={`w-4 h-4 shrink-0 transition-colors ${pathname === "/seller" ? "text-blue-500" : "text-zinc-400 group-hover:text-zinc-200"}`} strokeWidth={1.75} />
                {isExpanded && <span className="ml-3 truncate">Dashboard</span>}
              </Link>
            </div>
          </div>

          {/* ========================================= */}
          {/* SEÇÃO 2: BOT TELEGRAM */}
          {/* ========================================= */}
          <div>
            {isExpanded && (
              <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 font-mono select-none">
                Bot Telegram
              </p>
            )}
            <div className="space-y-0.5">
              {isExpanded ? (
                <>
                  <button
                    type="button"
                    onClick={() => setUserManuallyToggledBot(!botGroupOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                      isBotChildActive
                        ? "text-zinc-100 font-semibold bg-[#18181C]/70 border border-white/5"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Bot className={`w-4 h-4 shrink-0 transition-colors ${isBotChildActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.75} />
                      <span className="ml-3 truncate">Configurações do Bot</span>
                    </div>
                    {botGroupOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.75} />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.75} />
                    )}
                  </button>

                  {/* Submenu com linhas conectoras suaves */}
                  {botGroupOpen && (
                    <div className="relative pl-5 space-y-0.5 my-1">
                      {visibleBotSubItems.map((subItem, index) => {
                        const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                        const SubIcon = subItem.icon;
                        const isLast = index === visibleBotSubItems.length - 1;

                        return (
                          <div key={subItem.href} className="relative flex items-center">
                            {/* Linha guia vertical e curva inspirada na Astrofy */}
                            <svg
                              className="absolute -left-2.5 top-0 bottom-0 w-3.5 h-full pointer-events-none"
                              overflow="visible"
                            >
                              <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2={isLast ? "13" : "100%"}
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="1.2"
                              />
                              <path
                                d="M 0 0 V 7 Q 0 13 6 13 H 11"
                                fill="none"
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>

                            <Link
                              href={subItem.href}
                              onClick={() => isMobile && setMobileDrawerOpen(false)}
                              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                                isSubActive
                                  ? "bg-[#18181C] text-white font-semibold border border-white/5 shadow-xs"
                                  : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                              }`}
                            >
                              {isSubActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3.5 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                              )}
                              <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.75} />
                              <span className="truncate flex-1">{subItem.name}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Versão Recolhida (Apenas Ícones) */
                visibleBotSubItems.map((subItem) => {
                  const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                  const SubIcon = subItem.icon;

                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      title={`Bot Telegram • ${subItem.name}`}
                      className={`flex items-center justify-center p-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                        isSubActive
                          ? "bg-[#18181C] text-white border border-white/5"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                      }`}
                    >
                      {isSubActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                      )}
                      <SubIcon className={`w-4 h-4 shrink-0 transition-colors ${isSubActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.75} />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================= */}
          {/* SEÇÃO 3: VENDAS */}
          {/* ========================================= */}
          <div>
            {isExpanded && (
              <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 font-mono select-none">
                Vendas
              </p>
            )}
            <div className="space-y-0.5">
              {salesItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/seller" && pathname.startsWith(item.href + "/"));
                const ItemIcon = item.icon;

                return (
                  <Link 
                    key={item.href}
                    href={item.href}
                    onClick={() => isMobile && setMobileDrawerOpen(false)}
                    title={!isExpanded ? item.name : undefined}
                    className={`group flex items-center ${!isExpanded ? "justify-center px-2" : "justify-start px-3"} py-2 rounded-xl text-[13px] font-medium transition-all duration-150 relative ${
                      isActive 
                        ? "bg-[#18181C] text-white font-semibold border border-white/5 shadow-xs" 
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                    )}
                    <ItemIcon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400 group-hover:text-zinc-200"}`} strokeWidth={1.75} />
                    {isExpanded && <span className="ml-3 truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ========================================= */}
          {/* SEÇÃO 4: CONTA */}
          {/* ========================================= */}
          <div>
            {isExpanded && (
              <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 font-mono select-none">
                Conta
              </p>
            )}
            <div className="space-y-0.5">
              <Link 
                href="/seller/settings"
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                title={!isExpanded ? "Configurações" : undefined}
                className={`group flex items-center ${!isExpanded ? "justify-center px-2" : "justify-start px-3"} py-2 rounded-xl text-[13px] font-medium transition-all duration-150 relative ${
                  pathname === "/seller/settings" 
                    ? "bg-[#18181C] text-white font-semibold border border-white/5 shadow-xs" 
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                {pathname === "/seller/settings" && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                )}
                <Settings className={`w-4 h-4 shrink-0 transition-colors ${pathname === "/seller/settings" ? "text-blue-500" : "text-zinc-400 group-hover:text-zinc-200"}`} strokeWidth={1.75} />
                {isExpanded && <span className="ml-3 truncate">Configurações</span>}
              </Link>
            </div>
          </div>

          {/* ========================================= */}
          {/* SEÇÃO 5: ADMINISTRAÇÃO (Quando aplicável) */}
          {/* ========================================= */}
          {isAdminOrSuperAdmin && (
            <div>
              {isExpanded && (
                <p className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 font-mono select-none">
                  Administração
                </p>
              )}
              <div className="space-y-0.5">
                <Link
                  href="/admin"
                  onClick={() => isMobile && setMobileDrawerOpen(false)}
                  title={!isExpanded ? "Voltar ao Admin" : undefined}
                  className={`
                    group flex items-center ${!isExpanded ? "justify-center px-2" : "justify-start px-3"} py-2 rounded-xl text-[13px] font-medium 
                    text-zinc-300 bg-white/[0.02] hover:bg-white/[0.06] hover:text-white border border-white/[0.06] hover:border-white/15 
                    transition-all duration-150 active:scale-[0.99]
                  `}
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-blue-400 group-hover:-translate-x-0.5 transition-all shrink-0" strokeWidth={1.75} />
                  {isExpanded && <span className="ml-3 truncate">Voltar ao Admin</span>}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ========================================================================= */}
        {/* PARTE INFERIOR: CARD DE VOLUME DE VENDAS + PERFIL DO VENDEDOR */}
        {/* ========================================================================= */}
        <div className="p-3 border-t border-white/[0.06] space-y-2.5 bg-[#0D0D0F]">
          
          {/* Card de Volume de Vendas (Inspirado no Card de Faturamento Astrofy) */}
          {isExpanded ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#16161A] to-[#121214] border border-white/[0.08] shadow-lg space-y-2.5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" strokeWidth={2} />
                  <span className="text-[11px] font-semibold tracking-tight text-zinc-200">
                    Volume de vendas
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {percentage.toFixed(0)}%
                </span>
              </div>

              {/* Faturamento Bruto vs Meta */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="font-bold text-white text-sm tracking-tight">
                    {formattedRevenue}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    / {formattedGoal}
                  </span>
                </div>

                {/* Barra de Progresso com Gradiente Azul WebGran */}
                <div className="w-full h-1.5 bg-[#202026] rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-400 rounded-full transition-all duration-500 ease-out shadow-xs shadow-blue-500/50"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans">
                <span>Meta mensal</span>
                <span className="text-zinc-300 font-medium">Pedidos pagos</span>
              </div>
            </div>
          ) : (
            /* Versão Recolhida do Card (Apenas Ícone com Tooltip) */
            <div 
              title={`Volume de vendas: ${formattedRevenue} de ${formattedGoal} (${percentage.toFixed(0)}%)`}
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#16161A] border border-white/[0.08] text-blue-400 cursor-default"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={2} />
              <span className="text-[9px] font-bold font-mono mt-1 text-zinc-300">
                {percentage.toFixed(0)}%
              </span>
            </div>
          )}

          {/* Rodapé: Perfil do Vendedor */}
          <div className={`flex items-center ${!isExpanded ? "justify-center" : "justify-between"} p-2 rounded-xl bg-[#141417] border border-white/[0.06] hover:border-white/10 transition-colors`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center border border-white/15 shrink-0 font-bold text-xs text-white overflow-hidden shadow-xs">
                {sellerProfile?.avatarUrl ? (
                  <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initialLetter
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {sellerProfile?.name || "Vendedor"}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {sellerProfile?.email || "vendedor@webgran.online"}
                  </p>
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
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 ml-1" 
                title="Sair da conta"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-blue-500/25 overflow-x-hidden max-w-full">
      
      {/* Mobile Top Header (Sticky / Fixed) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0D0D0F] border-b border-white/[0.08] z-40 px-4 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-1.5 text-zinc-300 hover:text-white bg-[#151619] hover:bg-zinc-800 rounded-lg border border-white/10 transition-all cursor-pointer"
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

        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center border border-white/15 shrink-0 font-bold text-[11px] text-white overflow-hidden shadow-xs">
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
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[280px] bg-[#0D0D0F] border-r border-white/[0.08] shadow-2xl flex flex-col transition-all duration-200 ease-in-out md:hidden ${
          mobileDrawerOpen ? "translate-x-0 opacity-100 pointer-events-auto visible" : "-translate-x-full opacity-0 pointer-events-none invisible"
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.08]">
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
            className="p-1.5 text-zinc-400 hover:text-white bg-[#151619] rounded-lg border border-white/10 cursor-pointer"
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
          className={`bg-[#0D0D0F] border-r border-white/[0.08] flex-shrink-0 hidden md:flex flex-col relative z-30 transition-all duration-200 ease-in-out shadow-xs ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          {/* Desktop Sidebar Header: Logo Area & Collapse Toggle */}
          <div className="h-14 px-3.5 flex items-center justify-between border-b border-white/[0.08]">
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
                  className="p-1.5 text-zinc-400 hover:text-white bg-[#151619] hover:bg-zinc-800 rounded-lg border border-white/10 transition-all cursor-pointer shrink-0 ml-1"
                >
                  <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
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
