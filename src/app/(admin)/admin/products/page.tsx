import { db } from "@/db";
import { products } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export default async function AdminProductsPage() {
  await requireAdmin();
  const allProducts = await db.query.products.findMany({
    with: { store: true },
    orderBy: [desc(products.createdAt)],
    limit: 100
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Produtos Globais</h2>
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Loja</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {allProducts.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.store?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">R$ {Number(p.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.status}</td>
              </tr>
            ))}
            {allProducts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
