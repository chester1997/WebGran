"use client";

import { useState } from "react";
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
  Store
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

  const menuItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Vendedores", href: "/admin/sellers", icon: Users },
    { label: "Bots", href: "/admin/bots", icon: Bot },
    { label: "Pedidos", href: "/admin/orders", icon: ShoppingCart },
    { label: "Clientes", href: "/admin/customers", icon: UserCheck },
    { label: "Temas", href: "/admin/themes", icon: Palette },
    { label: "Configurações", href: "/admin/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#141416] border-b border-[#27272A] text-white z-40 sticky top-0">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
          <span className="text-white">WebGran</span>
          <span className="text-xs bg-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded border border-red-500/30">ADMIN</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-[#18181B] text-gray-300 hover:text-white border border-[#27272A]"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-[#0B0B0D] border-r border-[#27272A] flex-shrink-0 flex flex-col
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand Header */}
        <div className="pt-6 pb-4 px-4 flex flex-col items-center justify-center border-b border-[#27272A] bg-[#141416]/50">
          <Link href="/admin" className="flex flex-col items-center justify-center w-full">
            <img src="/logo.png" alt="WebGran Logo" className="w-40 h-auto object-contain drop-shadow-md mx-auto" />
            <span className="mt-2 px-2.5 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full tracking-wider uppercase">
              ADMIN PANEL
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold text-gray-400 tracking-wider uppercase">
            Navegação Principal
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                  ${isActive 
                    ? "bg-[#18181B] text-white border border-[#27272A] shadow-sm" 
                    : "text-gray-400 hover:text-white hover:bg-[#141416]"
                  }
                `}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-red-600 shadow-sm shadow-red-600/50" />
                )}
                
                <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-red-500" : "text-gray-400 group-hover:text-gray-200"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* Store Access Button for Platform Owner */}
          <div className="pt-4 mt-4 border-t border-[#27272A]">
            <div className="px-3 pb-2 text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
              Minha Loja
            </div>
            <Link
              href="/seller"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all shadow-md shadow-emerald-950/30 group"
            >
              <Store className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="truncate">🏪 Meu Painel de Vendedor</span>
            </Link>
          </div>
        </nav>

        {/* User Footer Card */}
        <div className="p-3 border-t border-[#27272A] bg-[#141416]/40">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#141416] border border-[#27272A]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-red-950/80 border border-red-700/50 flex items-center justify-center text-red-200 font-bold text-xs flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Administrador"}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email || "admin@webgran.online"}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sair"
              className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-[#18181B] transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
