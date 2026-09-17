"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Store, 
  Bot, 
  Package, 
  Tags,
  Layers, 
  ShoppingCart, 
  Users, 
  Settings,
  Search,
  Bell,
  Calendar,
  LogOut,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SellerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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


  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-[#121212] border-r border-white/5 flex-shrink-0 hidden md:flex flex-col relative z-10 shadow-2xl shadow-black">
          {/* Logo Area */}
          <div className="pt-8 pb-4 px-6 flex justify-center">
            <img src="/logo.png" alt="WebGran Logo" className="w-44 h-auto object-contain drop-shadow-xl" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
            <div className="px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Menu Principal
            </div>
            <ul className="space-y-1.5 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link 
                      href={item.href} 
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/10" 
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-500"}`} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Upgrade Pro Card (Like reference) */}
          <div className="p-4 mt-auto">
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 p-4 rounded-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-600/20 blur-2xl rounded-full"></div>
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">WebGran Pro</h4>
              <p className="text-xs text-zinc-400 mb-4 line-clamp-2">
                Desbloqueie relatórios avançados e robôs ilimitados.
              </p>
              <Button variant="default" size="sm" className="w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-lg text-xs">
                Fazer Upgrade
              </Button>
            </div>
          </div>
          
          {/* User Footer */}
          <div className="border-t border-white/5 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0">
              <span className="text-xs font-bold text-zinc-300">LO</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Sua Loja</p>
              <p className="text-xs text-zinc-500 truncate">Vendedor</p>
            </div>
            <Link href="/api/auth/signout" className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0A0A0A]">
          {/* Main Content Scroll */}
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            {/* Ambient Glow */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
