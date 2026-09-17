"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  Tags,
  Layers, 
  ShoppingCart, 
  Users, 
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ChevronUp,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navItems = [
    { name: "Dashboard", href: "/seller", icon: LayoutDashboard },
    { name: "Loja & Bot", href: "/seller/store", icon: Store },
    { name: "Produtos", href: "/seller/products", icon: Package },
    { name: "Carrosséis", href: "/seller/carousels", icon: Layers },
    { name: "Categorias", href: "/seller/categories", icon: Tags },
    { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
    { name: "Clientes", href: "/seller/customers", icon: Users },
    { name: "Configurações", href: "/seller/settings", icon: Settings },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar with depth shadow, gradient border, and collapsible behavior */}
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
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30 text-base">
                W
              </div>
            )}
          </div>

          {/* Search bar & collapse toggle button */}
          <div className="px-3 py-2 space-y-3">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar" 
                    className="w-full bg-[#18181C] border border-white/5 rounded-xl py-2 pl-8 pr-7 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                    /
                  </span>
                </div>
                <button 
                  onClick={() => setCollapsed(!collapsed)}
                  title="Recolher menu"
                  className="p-2 text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-xl border border-white/5 transition-all shrink-0"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setCollapsed(!collapsed)}
                title="Expandir menu"
                className="w-full py-2 flex items-center justify-center text-zinc-400 hover:text-white bg-[#18181C] hover:bg-white/10 rounded-xl border border-white/5 transition-all"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar px-3 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                    isActive 
                      ? "bg-[#1A1A22] text-white border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  {/* Left accent bar for active item */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  )}

                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-blue-400" : "text-zinc-400 group-hover:text-zinc-200"}`} />
                  
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Boost com IA / Pro Card */}
          <div className="p-3 mt-auto">
            {!collapsed ? (
              <div className="bg-gradient-to-br from-[#181820] to-[#121218] border border-white/5 p-4 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="absolute -top-8 -right-8 w-20 h-20 bg-blue-500/10 blur-xl rounded-full"></div>
                
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  <h4 className="text-sm font-bold text-white">Boost com IA</h4>
                </div>
                
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  Respostas geradas por IA, insights rápidos e ferramentas que poupam horas.
                </p>
                
                <Button variant="default" size="sm" className="w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs h-9 shadow-md">
                  Upgrade para Pro
                </Button>
              </div>
            ) : (
              <button 
                title="Boost com IA - Upgrade"
                className="w-full p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* User Footer with dropdown style */}
          <div className="border-t border-white/5 p-3">
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-2 rounded-xl bg-[#16161C] border border-white/5`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0 font-bold text-xs text-white">
                  W
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">Sua Loja</p>
                    <p className="text-[11px] text-zinc-500 truncate">Vendedor</p>
                  </div>
                )}
              </div>
              
              {!collapsed && (
                <Link href="/api/auth/signout" className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors" title="Sair">
                  <ChevronUp className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070709]">
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
