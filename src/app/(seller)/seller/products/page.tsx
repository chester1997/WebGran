import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Package, Plus, Search, MoreHorizontal, Filter, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SellerProductsPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  // Load products with their categories
  const allProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    with: {
      category: true
    }
  });

  return (
    <div className="space-y-8 fade-in max-w-7xl">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Produtos</h2>
          <p className="text-zinc-400 text-sm mt-1">Gerencie o seu catálogo e controle preços e entregas.</p>
        </div>
        <Link href="/seller/products/new">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-violet-600/20 w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" /> Novo Produto
          </Button>
        </Link>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#121212] p-4 border border-white/5 rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Pesquisar por título ou slug..." 
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button variant="outline" className="bg-[#0A0A0A] border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl h-10 shrink-0">
            <Filter className="w-4 h-4 mr-2" /> Filtros
          </Button>
          <select className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 h-10 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none min-w-[140px] shrink-0">
            <option>Todas Categorias</option>
          </select>
          <select className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 h-10 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none min-w-[120px] shrink-0">
            <option>Todos Status</option>
            <option>Ativos</option>
            <option>Inativos</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs font-medium uppercase tracking-wider bg-white/[0.01]">
                <th className="py-4 pl-6">Produto</th>
                <th className="py-4">Categoria</th>
                <th className="py-4">Preço</th>
                <th className="py-4">Status</th>
                <th className="py-4">Vendas</th>
                <th className="py-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {allProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <Package className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-300 font-medium text-base mb-1">Seu catálogo está vazio</p>
                      <p className="text-zinc-600 text-sm max-w-sm mb-6">Cadastre seu primeiro produto para começar a vender na sua loja digital.</p>
                      <Link href="/seller/products/new">
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-600/20">
                          <Plus className="w-4 h-4 mr-2" /> Cadastrar Produto
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                /* Map Products */
                allProducts.map((prod) => (
                  <tr key={prod.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pl-6">
                      <div className="flex items-center gap-4">
                        {prod.coverUrl ? (
                          <img src={prod.coverUrl} alt={prod.title} className="w-12 h-16 rounded-lg object-cover border border-white/10 shadow-sm" />
                        ) : (
                          <div className="w-12 h-16 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5">
                            <ImageIcon className="w-5 h-5 text-zinc-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-zinc-200 font-medium line-clamp-1">{prod.title}</p>
                          <p className="text-zinc-500 font-mono text-xs mt-0.5 truncate max-w-[180px]">/{prod.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      {prod.category ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/5 text-zinc-300 text-xs font-medium border border-white/10">
                          {prod.category.name}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs italic">Sem Categoria</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">R$ {Number(prod.price).toFixed(2).replace('.', ',')}</span>
                        {prod.compareAtPrice && (
                          <span className="text-zinc-500 text-xs line-through">R$ {Number(prod.compareAtPrice).toFixed(2).replace('.', ',')}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      {prod.status === 'active' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-emerald-400 text-xs font-medium">Ativo</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                          <span className="text-zinc-500 text-xs font-medium">Rascunho</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-zinc-400 font-medium">
                      0 <span className="text-zinc-600 text-xs font-normal">vendas</span>
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
        
        {/* Footer Pagination mock */}
        {allProducts.length > 0 && (
          <div className="border-t border-white/5 p-4 flex items-center justify-between text-xs text-zinc-500 bg-white/[0.01]">
            <span>Mostrando {allProducts.length} produtos</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent border-white/10 rounded-md" disabled>Anterior</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent border-white/10 rounded-md" disabled>Próxima</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
