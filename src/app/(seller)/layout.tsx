import { ReactNode } from "react";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Store, 
  Bot, 
  Package, 
  Tags, 
  ShoppingCart, 
  Users, 
  Settings 
} from "lucide-react";

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const user = await requireSeller();
  const store = await getCurrentStore();

  const navItems = [
    { name: "Dashboard", href: "/seller", icon: LayoutDashboard },
    { name: "Minha Loja", href: "/seller/store", icon: Store },
    { name: "Meu Bot", href: "/seller/bot", icon: Bot },
    { name: "Produtos", href: "/seller/products", icon: Package },
    { name: "Categorias", href: "/seller/categories", icon: Tags },
    { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
    { name: "Clientes", href: "/seller/customers", icon: Users },
    { name: "Configurações", href: "/seller/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card flex-shrink-0 hidden md:flex flex-col">
          <div className="h-16 flex items-center px-6 border-b font-bold text-lg">
            {store?.name || "Minha Loja"}
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link 
                    href={item.href} 
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b bg-card flex items-center justify-between px-6">
            <h1 className="font-semibold text-lg">Painel do Vendedor</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
