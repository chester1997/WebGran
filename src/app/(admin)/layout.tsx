import { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card flex-shrink-0 hidden md:flex flex-col">
          <div className="h-16 flex items-center px-6 border-b font-bold text-lg">
            WebGran Admin
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              <li><a href="/admin" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Dashboard</a></li>
              <li><a href="/admin/stores" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Lojas</a></li>
              <li><a href="/admin/sellers" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Vendedores</a></li>
              <li><a href="/admin/bots" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Bots</a></li>
              <li><a href="/admin/products" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Produtos</a></li>
              <li><a href="/admin/orders" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Pedidos</a></li>
              <li><a href="/admin/customers" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Clientes</a></li>
              <li><a href="/admin/themes" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Temas</a></li>
              <li><a href="/admin/settings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground">Configurações</a></li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b bg-card flex items-center justify-between px-6">
            <h1 className="font-semibold text-lg">Painel Administrativo</h1>
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
