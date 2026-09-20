"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  LogOut,
  ShieldAlert,
  ArrowLeft
} from "lucide-react";

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-items for "Bot Telegram" group
  const botTelegramSubItems = [
    { name: "Configuração", href: "/seller/store", icon: Settings2 },
    { name: "Boas-vindas", href: "/seller/boas-vindas", icon: Sparkles },
    { name: "Banners", href: "/seller/banners", icon: ImageIcon },
    { name: "Produtos", href: "/seller/products", icon: Package },
    { name: "Carrosséis", href: "/seller/carousels", icon: Layers },
    { name: "Categorias", href: "/seller/categories", icon: Tags },
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

  // Reset manual toggle override when navigating to a new route
  useEffect(() => {
    setUserManuallyToggled(null);
  }, [pathname]);

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

    loadProfile();

    window.addEventListener("seller-profile-updated", loadProfile);
    return () => {
      window.removeEventListener("seller-profile-updated", loadProfile);
    };
  }, [pathname]);

  // Search filter logic
  const queryLower = searchQuery.toLowerCase().trim();

  const isChildSearchMatch =
    queryLower !== "" &&
    botTelegramSubItems.some((item) =>
      item.name.toLowerCase().includes(queryLower)
    );

  const effectiveBotGroupOpen = botGroupOpen || isChildSearchMatch;

  const isBotGroupMatch =
    queryLower === "" ||
    "bot telegram".includes(queryLower) ||
    botTelegramSubItems.some((item) =>
      item.name.toLowerCase().includes(queryLower)
    );

  const filteredBotSubItems = botTelegramSubItems.filter((item) =>
    queryLower === "" ? true : item.name.toLowerCase().includes(queryLower)
  );

  const isDashboardMatch =
    queryLower === "" || dashboardItem.name.toLowerCase().includes(queryLower);

  const filteredBottomRootItems = bottomRootItems.filter((item) =>
    queryLower === "" ? true : item.name.toLowerCase().includes(queryLower)
  );

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-red-500/30">
      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside 
          className={`bg-[#0F0F12] border-r border-white/5 flex-shrink-0 hidden md:flex flex-col relative z-30 transition-all duration-300 ease-in-out shadow-[10px_0_30px_rgba(0,0,0,0.8)] ${
            collapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Logo Area & Collapse Toggle */}
          <div className={`pt-6 pb-4 px-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed ? (
              <div className="flex items-center gap-2 pl-2">
                <img src="/logo.png" alt="WebGran Logo" className="w-36 h-auto object-contain drop-shadow-md" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-red-600/30 text-base">
                W
              </div>
            )}
          </div>

          {/* Search bar & collapse toggle button */}
          <div className="px-3 py-2 space-y-3">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" strokeWidth={1.8} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar" 
                    className="w-full bg-[#18181C] border border-white/5 rounded-xl py-2 pl-8 pr-7 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500/50 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                    /
                  </span>
                </div>
                <button 
                  onClick={() => setCollapsed(!collapsed)}
                  title="Recolher menu"
                  className="p-2 text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-xl border border-white/5 transition-all shrink-0 cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setCollapsed(!collapsed)}
                title="Expandir menu"
                className="w-full py-2 flex items-center justify-center text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" strokeWidth={1.8} />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar px-3 space-y-1">
            {/* 1. Dashboard */}
            {isDashboardMatch && (
              <Link 
                href={dashboardItem.href}
                title={collapsed ? dashboardItem.name : undefined}
                className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden ${
                  pathname === dashboardItem.href 
                    ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]" 
                    : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {pathname === dashboardItem.href && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]" />
                )}
                <LayoutDashboard className={`w-5 h-5 shrink-0 transition-colors ${pathname === dashboardItem.href ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                {!collapsed && <span className="truncate">{dashboardItem.name}</span>}
              </Link>
            )}

            {/* 2. Bot Telegram Group (Expandable Parent Menu) */}
            {isBotGroupMatch && (
              <div className="space-y-1">
                {!collapsed ? (
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
                      {effectiveBotGroupOpen ? (
                        <ChevronUp className="w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200" strokeWidth={1.8} />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200" strokeWidth={1.8} />
                      )}
                    </button>

                    {/* Submenus (Indented with connecting line) */}
                    {effectiveBotGroupOpen && (
                      <div className="ml-5 pl-3 border-l border-white/10 space-y-1 my-1 transition-all duration-200 ease-in-out">
                        {filteredBotSubItems.map((subItem) => {
                          const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                          const SubIcon = subItem.icon;

                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
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
                  /* Collapsed mode icons */
                  filteredBotSubItems.map((subItem) => {
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
            )}

            {/* 3. Bottom Root Level Items (Pedidos, Recebimento, Clientes, Configurações) */}
            {filteredBottomRootItems.map((item) => {
              const isActive = pathname === item.href;
              const ItemIcon = item.icon;

              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden ${
                    isActive 
                      ? "bg-red-500/10 text-white font-semibold border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]" 
                      : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]" />
                  )}

                  <ItemIcon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-red-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                  
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              );
            })}

            {/* Back to Admin Button for Platform Owners */}
            {(sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin") && (
              <div className="pt-3 border-t border-white/5 mt-3">
                <Link
                  href="/admin"
                  title={collapsed ? "Voltar ao Admin" : undefined}
                  className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all shadow-md shadow-red-950/30 group`}
                >
                  <ArrowLeft className="w-4 h-4 text-red-400 group-hover:-translate-x-0.5 transition-transform shrink-0" strokeWidth={2} />
                  {!collapsed && <span className="truncate">⚙️ Voltar ao Admin</span>}
                </Link>
              </div>
            )}
          </nav>

          {/* User Footer with real seller profile avatar and data */}
          <div className="border-t border-white/5 p-3">
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-2.5 rounded-xl bg-[#16161C] border border-white/5`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0 font-bold text-xs text-white overflow-hidden">
                  {sellerProfile?.avatarUrl ? (
                    <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    initialLetter
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{sellerProfile?.name || "Vendedor"}</p>
                    <p className="text-[11px] text-zinc-500 truncate">Vendedor</p>
                  </div>
                )}
              </div>
              
              {!collapsed && (
                <Link href="/api/auth/signout" className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors" title="Sair">
                  <LogOut className="w-4 h-4" strokeWidth={1.8} />
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070709]">
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
