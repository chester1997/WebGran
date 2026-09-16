import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const allOrders = await db.query.orders.findMany({
    with: { store: true, customer: true },
    orderBy: [desc(orders.createdAt)],
    limit: 100
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Pedidos Globais</h2>
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido ID</th>
              <th className="px-4 py-3 font-medium">Loja</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {allOrders.map(o => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-xs font-mono">{o.id}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.store?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.customer?.firstName}</td>
                <td className="px-4 py-3 text-muted-foreground">R$ {Number(o.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.status}</td>
              </tr>
            ))}
            {allOrders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum pedido</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
