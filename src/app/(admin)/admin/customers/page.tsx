import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export default async function AdminCustomersPage() {
  await requireAdmin();
  const allCustomers = await db.query.telegramCustomers.findMany({
    with: { store: true },
    orderBy: [desc(telegramCustomers.createdAt)],
    limit: 100
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Clientes Telegram (Globais)</h2>
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Telegram ID</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Loja Vínculo</th>
            </tr>
          </thead>
          <tbody>
            {allCustomers.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-xs font-mono">{c.telegramUserId}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.username ? `@${c.username}` : '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.store?.name}</td>
              </tr>
            ))}
            {allCustomers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum cliente</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
