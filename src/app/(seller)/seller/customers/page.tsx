import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Search, Users, MoreHorizontal, User, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function CustomersPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  const items = await db.query.telegramCustomers.findMany({
    where: eq(telegramCustomers.storeId, store.id),
    orderBy: [desc(telegramCustomers.createdAt)]
  });

  return (
    <div className="space-y-8 fade-in w-full">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Clientes</h2>
          <p className="text-zinc-400 text-sm mt-1">Gerencie a base de usuários do seu Mini App.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-11 px-4 rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#121212] p-4 border border-white/5 rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, @username ou ID..." 
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs font-semibold uppercase tracking-wider bg-white/[0.01]">
                <th className="py-4 pl-6">Cliente</th>
                <th className="py-4">Username</th>
                <th className="py-4">Telegram ID</th>
                <th className="py-4">Cadastro</th>
                <th className="py-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <Users className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-300 font-medium text-base mb-1">Nenhum cliente ainda</p>
                      <p className="text-zinc-600 text-sm max-w-sm mb-6">Quando os usuários interagirem com seu Mini App, eles aparecerão aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt={c.firstName || "User"} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20 font-bold">
                            {(c.firstName?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-zinc-200 font-medium">{c.firstName} {c.lastName}</p>
                          <p className="text-zinc-500 text-xs">{(c.languageCode || 'pt-br').toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      {c.username ? (
                        <a href={`https://t.me/${c.username}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
                          @{c.username}
                        </a>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="py-4 text-zinc-400 font-mono text-xs">{c.telegramUserId}</td>
                    <td className="py-4 text-zinc-400">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 text-right pr-6">
                      <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
