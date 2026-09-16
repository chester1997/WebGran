import { db } from "@/db";
import { stores, users, telegramBots, products, orders, telegramCustomers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export default async function AdminDashboard() {
  await requireAdmin();

  // Buscar contagens
  const [
    totalStoresRes,
    totalSellersRes,
    totalBotsRes,
    totalProductsRes,
    totalOrdersRes,
    totalCustomersRes,
    totalRevenueRes
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(stores),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'seller')),
    db.select({ count: sql<number>`count(*)` }).from(telegramBots),
    db.select({ count: sql<number>`count(*)` }).from(products),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'paid')),
    db.select({ count: sql<number>`count(*)` }).from(telegramCustomers),
    db.select({ sum: sql<number>`sum(CAST(total AS NUMERIC))` }).from(orders).where(eq(orders.status, 'paid'))
  ]);

  const totalStores = totalStoresRes[0].count;
  const totalSellers = totalSellersRes[0].count;
  const totalBots = totalBotsRes[0].count;
  const totalProducts = totalProductsRes[0].count;
  const totalOrders = totalOrdersRes[0].count;
  const totalCustomers = totalCustomersRes[0].count;
  const totalRevenue = totalRevenueRes[0].sum || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <MetricCard title="Lojas Ativas" value={totalStores.toString()} />
        <MetricCard title="Vendedores" value={totalSellers.toString()} />
        <MetricCard title="Bots Conectados" value={totalBots.toString()} />
        <MetricCard title="Produtos Cadastrados" value={totalProducts.toString()} />
        <MetricCard title="Pedidos Pagos" value={totalOrders.toString()} />
        <MetricCard title="Faturamento Total" value={`R$ ${Number(totalRevenue).toFixed(2)}`} />
        <MetricCard title="Clientes Telegram" value={totalCustomers.toString()} />
        
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-card border text-card-foreground p-6 rounded-lg shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
