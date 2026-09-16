import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function AdminBotsPage() {
  await requireAdmin();

  const bots = await db.query.telegramBots.findMany({
    with: {
      store: true
    },
    orderBy: [desc(telegramBots.createdAt)]
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Bots Conectados</h2>
      
      <div className="bg-card border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Bot</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Loja Vinculada</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {bots.map(bot => (
              <tr key={bot.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{bot.displayName || "Sem Nome"}</td>
                <td className="px-4 py-3 text-muted-foreground">@{bot.username}</td>
                <td className="px-4 py-3 text-muted-foreground">{bot.store?.name}</td>
                <td className="px-4 py-3">
                  <Badge variant={bot.status === 'active' ? 'default' : 'secondary'}>
                    {bot.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {bots.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum bot conectado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
