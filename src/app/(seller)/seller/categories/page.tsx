import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { Tags, Plus, Search, MoreHorizontal, GripVertical, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SellerCategoriesPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.storeId, store.id),
    orderBy: [asc(categories.position)]
  });

  return (
    <div className="space-y-8 fade-in max-w-6xl">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Categorias</h2>
          <p className="text-zinc-400 text-sm mt-1">Organize seus produtos e facilite a navegação no Mini App.</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-violet-600/20 w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" /> Nova Categoria
        </Button>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#121212] p-4 border border-white/5 rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Pesquisar categoria..." 
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Future select components for Status */}
          <select className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none min-w-[120px]">
            <option>Todos Status</option>
            <option>Ativos</option>
            <option>Inativos</option>
          </select>
        </div>
      </div>

      {/* Categories Table / List */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs font-medium uppercase tracking-wider bg-white/[0.01]">
                <th className="w-12 py-4 pl-4 text-center">Pos</th>
                <th className="py-4 pl-4">Categoria</th>
                <th className="py-4">URL (Slug)</th>
                <th className="py-4">Status</th>
                <th className="py-4">Produtos</th>
                <th className="py-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {allCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <Tags className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-300 font-medium text-base mb-1">Nenhuma categoria criada</p>
                      <p className="text-zinc-600 text-sm max-w-sm mb-6">Você precisa de categorias para organizar seus produtos na vitrine da loja.</p>
                      <Button variant="outline" className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 rounded-xl">
                        <Plus className="w-4 h-4 mr-2" /> Criar Primeira Categoria
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                /* Map Categories */
                allCategories.map((cat) => (
                  <tr key={cat.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pl-4 text-center">
                      <button className="text-zinc-600 hover:text-white cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-white/5">
                        <GripVertical className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5">
                            <ImageIcon className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-zinc-200 font-medium">{cat.name}</p>
                          <p className="text-zinc-500 text-xs truncate max-w-[200px]">{cat.description || "Sem descrição"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-zinc-500 font-mono text-xs">/{cat.slug}</td>
                    <td className="py-4">
                      {cat.status === 'active' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-emerald-400 text-xs font-medium">Ativa</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                          <span className="text-zinc-500 text-xs font-medium">Inativa</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-zinc-400 font-medium">
                      0
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
