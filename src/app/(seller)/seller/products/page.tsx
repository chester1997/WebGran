import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, categories, telegramBots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Package, Search, Image as ImageIcon, LayoutGrid, List, Edit3, Medal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProductModal } from "./NewProductModal";

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

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.storeId, store.id),
    columns: { id: true, name: true }
  });

  const storeBots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id),
    columns: { id: true, username: true, displayName: true }
  });

  const durationMap: Record<string, string> = {
    'lifetime': 'Vitalício',
    'daily': 'Diário',
    'weekly': 'Semanal',
    'monthly': 'Mensal',
    'quarterly': 'Trimestral',
    'semiannual': 'Semestral',
    'annual': 'Anual'
  };

  return (
    <div className="space-y-6 fade-in w-full">
      
      {/* Tab/Count Bar */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2 text-white border-b-2 border-blue-600 pb-4 -mb-[17px]">
          <Package className="w-4 h-4 text-blue-500" />
          <span className="font-bold text-sm">Produtos</span>
          <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allProducts.length}</span>
        </div>
        {/* We omitted "Cupons" as requested */}
        <div className="ml-auto">
          <NewProductModal categories={allCategories} />
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#121214] p-3 border border-white/5 rounded-xl shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder={`Buscar entre ${allProducts.length} produtos...`}
            className="w-full bg-[#1A1A1E] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
           <Button variant="outline" className="bg-[#1A1A1E] border-white/10 text-white h-10 w-10 p-0 rounded-lg shrink-0">
             <LayoutGrid className="w-4 h-4" />
           </Button>
           <Button variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 h-10 w-10 p-0 rounded-lg shrink-0">
             <List className="w-4 h-4" />
           </Button>
        </div>
      </div>

      {/* Grid */}
      {allProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center bg-[#121214] rounded-2xl border border-white/5 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A1E] flex items-center justify-center mb-4 border border-white/5 shadow-inner">
              <Package className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-zinc-300 font-medium text-base mb-1">Seu catálogo está vazio</p>
            <p className="text-zinc-600 text-sm max-w-sm mb-6">Cadastre seu primeiro produto para começar a vender na sua loja digital.</p>
            <NewProductModal categories={allCategories} />
          </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {allProducts.map((prod) => (
             <div key={prod.id} className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-xl group hover:border-white/10 transition-all">
                {/* Image Header */}
                <div className="w-full aspect-[16/9] bg-zinc-900 relative border-b border-white/5">
                  {prod.coverUrl ? (
                    <img src={prod.coverUrl} alt={prod.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                  {prod.status === 'active' && (
                    <div className="absolute top-3 right-3 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md border border-emerald-500/20">
                      Ativo
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-white font-bold text-sm uppercase leading-tight line-clamp-2 mb-1">{prod.title}</h3>
                  <span className="text-blue-400 text-[10px] font-bold tracking-wider uppercase mb-3">{store.name}</span>
                  
                  <p className="text-zinc-400 text-[11px] line-clamp-4 mb-4 flex-1 leading-relaxed">
                    {prod.shortDescription || prod.description || "Nenhuma descrição informada para este produto. O cliente não verá detalhes."}
                  </p>

                  <div className="flex items-end justify-between mt-auto mb-3">
                    <span className="text-emerald-400 font-bold text-lg leading-none">R$ {Number(prod.price).toFixed(2).replace('.', ',')}</span>
                    <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
                      {durationMap[prod.duration || 'lifetime'] || 'Vitalício'}
                    </span>
                  </div>

                  {prod.category ? (
                    <div className="flex">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-blue-400 text-[10px] font-medium border border-white/5">
                        <Package className="w-3 h-3" />
                        {prod.category.name}
                      </span>
                    </div>
                  ) : (
                    <div className="h-6"></div> /* placeholder to keep cards aligned */
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-white/5 flex gap-2 bg-[#1A1A1E]/50">
                  <Button variant="outline" className="flex-1 bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-8 text-xs font-medium rounded-lg">
                    <Edit3 className="w-3.5 h-3.5 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" size="icon" className="shrink-0 bg-transparent border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg">
                    <Medal className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="destructive" className="shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-transparent h-8 px-3 text-xs font-medium rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                  </Button>
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
