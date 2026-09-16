import { db } from "@/db";
import { stores, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function AdminStoresPage() {
  await requireAdmin();

  const allStores = await db.query.stores.findMany({
    with: {
      owner: true,
      bots: true,
    },
    orderBy: [desc(stores.createdAt)]
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Lojas</h2>
      
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Loja</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Bots</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {allStores.map(store => (
              <tr key={store.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{store.name}</div>
                  <div className="text-xs text-muted-foreground">{store.slug}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{store.owner?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{store.bots.length}</td>
                <td className="px-4 py-3">
                  <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                    {store.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {allStores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma loja encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
