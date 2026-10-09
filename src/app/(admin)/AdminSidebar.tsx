"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Bot, 
  Package, 
  ShoppingCart, 
  UserCheck, 
  Palette, 
  Settings,
  Menu,
  X,
  ShieldAlert,
  LogOut,
  Store,
  CreditCard,
  Sliders,
  Film,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Layers
} from "lucide-react";
import { signOut } from "next-auth/react";

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Group 1: Gestão Comercial
  const commercialItems = [
    { label: "Assinaturas WebGran", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Planos WebGran", href: "/admin/plans", icon: Package },
    { label: "Recursos & Features", href: "/admin/features", icon: Sliders },
    { label: "Vendedores", href: "/admin/sellers", icon: Users },
  ];

  // Group 2: Biblioteca de Vídeos
  const videoLibraryItems = [
    { label: "Visão Geral", href: "/admin/video-library", icon: Film },
    { label: "Planos de Armazenamento", href: "/admin/video-library/plans", icon: HardDrive },
  ];

  // Group 3: Operação & Conteúdo
  const operationItems = [
    { label: "Bots", href: "/admin/bots", icon: Bot },
    { label: "Pedidos", href: "/admin/orders", icon: ShoppingCart },
    { label: "Clientes", href: "/admin/customers", icon: UserCheck },
    { label: "Temas", href: "/admin/themes", icon: Palette },
  ];

  // Active checks
  const isCommercialActive = commercialItems.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const isVideoActive = videoLibraryItems.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const isOperationActive = operationItems.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  // Manual toggle state vs default route state
  const [userCommercialToggled, setUserCommercialToggled] = useState<boolean | null>(null);
  const [userVideoToggled, setUserVideoToggled] = useState<boolean | null>(null);
  const [userOperationToggled, setUserOperationToggled] = useState<boolean | null>(null);

  useEffect(() => {
    setUserCommercialToggled(null);
    setUserVideoToggled(null);
    setUserOperationToggled(null);
    setMobileOpen(false);
  }, [pathname]);

  const commercialOpen = userCommercialToggled !== null ? userCommercialToggled : isCommercialActive;
  const videoOpen = userVideoToggled !== null ? userVideoToggled : isVideoActive;
  const operationOpen = userOperationToggled !== null ? userOperationToggled : isOperationActive;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0E0E11] border-b border-white/[0.07] text-white z-30 w-full flex-shrink-0 shadow-md">
        <div className="flex items-center gap-2 font-bold text-base tracking-tight">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-white">WebGran</span>
          <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded border border-rose-500/20 tracking-wider">ADMIN</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Abrir menu de navegação"
          className="p-1.5 rounded-lg bg-[#141418] text-zinc-300 hover:text-white border border-white/[0.06] active:scale-95 transition-all"
        >
          {mobileOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-60 bg-[#0E0E11] border-r border-white/[0.06] flex-shrink-0 flex flex-col
        transition-transform duration-200 ease-in-out shadow-2xl md:shadow-none
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06]">
          <Link href="/admin" className="flex items-center" onClick={() => setMobileOpen(false)}>
            <img 
              src="/logo-expanded.png" 
              alt="WebGran Logo" 
              className="h-8 w-auto max-w-[150px] object-contain" 
            />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md tracking-wider uppercase">
              ADMIN
            </span>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 custom-scrollbar">
          {/* Dashboard (Root Item) */}
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
              ${pathname === "/admin" 
                ? "bg-[#1A1A22] text-white border border-white/10 shadow-md font-bold" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }
            `}
          >
            {pathname === "/admin" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[18px] rounded-r-md bg-rose-500 shadow-sm shadow-rose-500/50" />
            )}
            <LayoutDashboard className={`w-4 h-4 transition-colors ${pathname === "/admin" ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            <span className="truncate">Dashboard</span>
          </Link>

          {/* Group 1: Gestão Comercial */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setUserCommercialToggled(!commercialOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isCommercialActive ? "text-white font-bold bg-[#14141A]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className={`w-4 h-4 shrink-0 transition-colors ${isCommercialActive ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                <span className="truncate">Gestão Comercial</span>
              </div>
              {commercialOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
              )}
            </button>

            {commercialOpen && (
              <div className="relative pl-6 space-y-1 my-1">
                {commercialItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const isLast = index === commercialItems.length - 1;

                  return (
                    <div key={item.href} className="relative flex items-center">
                      <svg className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none" overflow="visible">
                        <line x1="0" y1="0" x2="0" y2={isLast ? "14" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                        <path d="M 0 0 V 8 Q 0 14 6 14 H 12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>

                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#1A1A22] text-white font-bold border border-white/10 shadow-md"
                            : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-rose-500 rounded-r-md shadow-sm shadow-rose-500/50" />
                        )}
                        <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                        <span className="truncate flex-1">{item.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 2: Biblioteca de Vídeos */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setUserVideoToggled(!videoOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isVideoActive ? "text-white font-bold bg-[#14141A]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Film className={`w-4 h-4 shrink-0 transition-colors ${isVideoActive ? "text-violet-400" : "text-zinc-400"}`} strokeWidth={1.8} />
                <span className="truncate">Biblioteca de Vídeos</span>
              </div>
              {videoOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
              )}
            </button>

            {videoOpen && (
              <div className="relative pl-6 space-y-1 my-1">
                {videoLibraryItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/admin/video-library" && pathname.startsWith(item.href));
                  const isLast = index === videoLibraryItems.length - 1;

                  return (
                    <div key={item.href} className="relative flex items-center">
                      <svg className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none" overflow="visible">
                        <line x1="0" y1="0" x2="0" y2={isLast ? "14" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                        <path d="M 0 0 V 8 Q 0 14 6 14 H 12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>

                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#1A1A22] text-white font-bold border border-white/10 shadow-md"
                            : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-violet-500 rounded-r-md shadow-sm shadow-violet-500/50" />
                        )}
                        <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-violet-400" : "text-zinc-400"}`} strokeWidth={1.8} />
                        <span className="truncate flex-1">{item.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 3: Operação & Conteúdo */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setUserOperationToggled(!operationOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isOperationActive ? "text-white font-bold bg-[#14141A]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layers className={`w-4 h-4 shrink-0 transition-colors ${isOperationActive ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                <span className="truncate">Operação & Conteúdo</span>
              </div>
              {operationOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
              )}
            </button>

            {operationOpen && (
              <div className="relative pl-6 space-y-1 my-1">
                {operationItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const isLast = index === operationItems.length - 1;

                  return (
                    <div key={item.href} className="relative flex items-center">
                      <svg className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none" overflow="visible">
                        <line x1="0" y1="0" x2="0" y2={isLast ? "14" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                        <path d="M 0 0 V 8 Q 0 14 6 14 H 12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>

                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#1A1A22] text-white font-bold border border-white/10 shadow-md"
                            : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-rose-500 rounded-r-md shadow-sm shadow-rose-500/50" />
                        )}
                        <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                        <span className="truncate flex-1">{item.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configurações (Root Item) */}
          <Link
            href="/admin/settings"
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
              ${pathname === "/admin/settings" 
                ? "bg-[#1A1A22] text-white border border-white/10 shadow-md font-bold" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }
            `}
          >
            {pathname === "/admin/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[18px] rounded-r-md bg-rose-500 shadow-sm shadow-rose-500/50" />
            )}
            <Settings className={`w-4 h-4 transition-colors ${pathname === "/admin/settings" ? "text-rose-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            <span className="truncate">Configurações</span>
          </Link>

          {/* Store Access Button for Platform Owner */}
          <div className="pt-2 border-t border-white/[0.06] mt-2">
            <Link
              href="/seller"
              onClick={() => setMobileOpen(false)}
              className="
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium 
                text-emerald-400 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.15] hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/35 
                transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 group
              "
            >
              <Store className="w-4 h-4 text-emerald-400 group-hover:scale-105 transition-all shrink-0" strokeWidth={1.8} />
              <span className="truncate">Painel do Vendedor</span>
            </Link>
          </div>
        </nav>

        {/* User Footer Card */}
        <div className="p-2.5 border-t border-white/[0.06]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#141418] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-rose-700 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0 border border-white/20">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.name || "Administrador"}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user?.email || "admin@webgran.online"}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sair"
              className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors ml-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
