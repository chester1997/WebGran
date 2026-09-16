import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function AdminSellersPage() {
  await requireAdmin();

  const sellers = await db.query.users.findMany({
    where: eq(users.role, 'seller'),
    with: {
      stores: true
    },
    orderBy: [desc(users.createdAt)]
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Vendedores</h2>
      
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Lojas</th>
              <th className="px-4 py-3 font-medium">Data de Registro</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map(seller => (
              <tr key={seller.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{seller.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{seller.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{seller.stores.length} loja(s)</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(seller.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum vendedor encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
