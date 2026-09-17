import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, products } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { Layers, Package, Plus } from "lucide-react";
import { CarouselModal } from "./CarouselModal";
import { DeleteCarouselButton } from "./DeleteCarouselButton";

export default async function SellerCarouselsPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  // Load all carousels with items
  const carouselsList = await db.query.productCarousels.findMany({
    where: eq(productCarousels.storeId, store.id),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
    with: {
      items: {
        with: {
          product: true
        }
      }
    }
  });

  // Load all products for the store
  const storeProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    columns: { id: true, title: true, price: true }
  });

  return (
    <div className="space-y-6 fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Carrosséis da Loja</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Crie e personalize as seções de produtos exibidas na tela inicial do seu Mini App.
          </p>
        </div>
        <CarouselModal products={storeProducts} />
      </div>

      {/* Carousels List */}
      {carouselsList.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center bg-[#121214] rounded-2xl border border-white/5 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1E] flex items-center justify-center mb-4 border border-white/5 shadow-inner">
            <Layers className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-zinc-300 font-medium text-base mb-1">Nenhum carrossel personalizado criado</p>
          <p className="text-zinc-600 text-sm max-w-sm mb-6">
            Por padrão, a loja exibe "Mais Recentes" e "Mais Vendidos". Crie seções com o nome que quiser!
          </p>
          <CarouselModal products={storeProducts} triggerText="Criar meu primeiro carrossel" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {carouselsList.map(c => {
            const activeProducts = c.items.map(i => i.product).filter(Boolean);
            const selectedProductIds = c.items.map(i => i.productId);

            return (
              <div
                key={c.id}
                className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-4 bg-violet-600 rounded-full"></div>
                      <h3 className="font-bold text-white text-base uppercase tracking-tight">{c.name}</h3>
                    </div>
                    <span className="bg-white/5 text-zinc-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-white/5">
                      {activeProducts.length} produto{activeProducts.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* List of included products */}
                  <div className="bg-[#1A1A1E] rounded-xl p-3 space-y-1.5 border border-white/5">
                    {activeProducts.length === 0 ? (
                      <p className="text-zinc-600 text-xs py-2 text-center">Nenhum produto vinculado</p>
                    ) : (
                      activeProducts.slice(0, 5).map(prod => (
                        <div key={prod.id} className="flex items-center justify-between text-xs py-1 px-1">
                          <span className="text-zinc-300 truncate max-w-[200px]">{prod.title}</span>
                          <span className="text-emerald-400 font-medium shrink-0 ml-2">
                            R$ {Number(prod.price).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ))
                    )}
                    {activeProducts.length > 5 && (
                      <p className="text-[10px] text-zinc-500 text-center pt-1 font-medium">
                        + {activeProducts.length - 5} outros produtos
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  <CarouselModal
                    products={storeProducts}
                    carousel={{
                      id: c.id,
                      name: c.name,
                      selectedProductIds
                    }}
                  />
                  <DeleteCarouselButton carouselId={c.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
