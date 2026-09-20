import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, products } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { Layers, Trophy, Eye, EyeOff } from "lucide-react";
import { CarouselModal } from "./CarouselModal";
import { DeleteCarouselButton } from "./DeleteCarouselButton";
import { RankingModal } from "./RankingModal";
import { getOrCreateRankingCarouselAction } from "./actions";
import { CarouselIconRenderer } from "@/lib/carousel-icons";

export default async function SellerCarouselsPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  // Get or initialize store's Ranking Editorial Carousel (Top 15)
  const rankingCarousel = await getOrCreateRankingCarouselAction();

  // Load all standard carousels with items
  const standardCarousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false)
    ),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.position)],
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

  const rankingSelectedIds = rankingCarousel.items
    ? rankingCarousel.items.map((i) => i.productId)
    : [];
  const rankingActiveProducts = rankingCarousel.items
    ? rankingCarousel.items.map((i) => i.product).filter(Boolean)
    : [];

  return (
    <div className="space-y-8 fade-in w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Carrosséis & Ranking da Loja</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Personalize a seção de Ranking (Top 15) e crie carrosséis de produtos exibidos no seu Mini App.
          </p>
        </div>
        <CarouselModal products={storeProducts} />
      </div>

      {/* 🏆 Section 1: Special Editorial Ranking Carousel (Top 15) */}
      <div className="bg-gradient-to-r from-[#171018] via-[#15121A] to-[#121216] border border-amber-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              {rankingCarousel.indicatorType === "ICON" ? (
                <CarouselIconRenderer 
                  iconName={rankingCarousel.iconName || "Trophy"} 
                  color={rankingCarousel.iconColor || "#FFD700"} 
                  size={24} 
                />
              ) : rankingCarousel.indicatorType === "NONE" ? (
                <span className="text-xs text-zinc-500 font-medium">—</span>
              ) : (
                <div className="w-1.5 h-6 bg-amber-400 rounded-full" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  Ranking Editorial
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                    rankingCarousel.status === "active"
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-400 border-white/10"
                  }`}
                >
                  {rankingCarousel.status === "active" ? (
                    <>
                      <Eye className="w-3 h-3 text-emerald-400" /> Ativo na Home
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 text-zinc-400" /> Oculto
                    </>
                  )}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {rankingCarousel.name || "Top 15 Hoje"}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-zinc-300">
              {rankingActiveProducts.length} de 15 produtos
            </span>

            <RankingModal
              rankingCarousel={{
                id: rankingCarousel.id,
                name: rankingCarousel.name,
                status: rankingCarousel.status,
                selectedProductIds: rankingSelectedIds,
                indicatorType: rankingCarousel.indicatorType as "BAR" | "ICON" | "NONE" || "ICON",
                iconName: rankingCarousel.iconName || "Trophy",
                iconColor: rankingCarousel.iconColor || "#FFD700",
              }}
              products={storeProducts}
            />
          </div>
        </div>

        {/* Selected Products Preview in Ranking */}
        <div className="bg-[#101014]/80 rounded-xl p-4 border border-white/5 space-y-2">
          {rankingActiveProducts.length === 0 ? (
            <p className="text-zinc-500 text-xs py-2 text-center">
              Nenhum produto selecionado no Ranking. Clique em "Gerenciar Top 15" para adicionar até 15 produtos.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {rankingActiveProducts.slice(0, 6).map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-[#181820] border border-white/5 text-xs"
                >
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                      idx === 0
                        ? "bg-red-600 text-white"
                        : idx === 1
                        ? "bg-orange-600 text-white"
                        : idx === 2
                        ? "bg-amber-600 text-white"
                        : idx < 5
                        ? "bg-yellow-600 text-white"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-zinc-200 font-medium truncate">{prod.title}</span>
                </div>
              ))}
              {rankingActiveProducts.length > 6 && (
                <div className="flex items-center justify-center p-2 rounded-lg bg-[#181820]/50 border border-white/5 text-xs text-amber-400 font-medium">
                  + {rankingActiveProducts.length - 6} outros produtos no ranking
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 📦 Section 2: Standard Custom Carousels */}
      <div className="space-y-4 pt-2">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-red-500" />
          <span>Outros Carrosséis da Loja</span>
        </h3>

        {standardCarousels.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center bg-[#121214] rounded-2xl border border-white/5 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-[#1A1A1E] flex items-center justify-center mb-3 border border-white/5 shadow-inner">
              <Layers className="w-7 h-7 text-zinc-500" />
            </div>
            <p className="text-zinc-300 font-medium text-sm mb-1">Nenhum carrossel padrão criado</p>
            <p className="text-zinc-500 text-xs max-w-sm mb-6">
              Crie carrosséis de produtos personalizados como "Lançamentos", "Mais Vendidos" ou "Doramas".
            </p>
            <CarouselModal products={storeProducts} triggerText="Criar Carrossel" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {standardCarousels.map((c) => {
              const activeProducts = c.items.map((i) => i.product).filter(Boolean);
              const selectedProductIds = c.items.map((i) => i.productId);

              return (
                <div
                  key={c.id}
                  className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {c.indicatorType === "ICON" ? (
                          <CarouselIconRenderer 
                            iconName={c.iconName} 
                            color={c.iconColor} 
                            size={18} 
                          />
                        ) : c.indicatorType === "NONE" ? null : (
                          <div className="w-1.5 h-4 bg-red-600 rounded-full shrink-0"></div>
                        )}
                        <h4 className="font-bold text-white text-base uppercase tracking-tight">{c.name}</h4>
                      </div>
                      <span className="bg-white/5 text-zinc-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-white/5">
                        {activeProducts.length} produto{activeProducts.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* List of included products */}
                    <div className="bg-[#1A1A1E] rounded-xl p-3 space-y-1.5 border border-white/5">
                      {activeProducts.length === 0 ? (
                        <p className="text-zinc-600 text-xs py-2 text-center">Nenhum produto vinculado</p>
                      ) : (
                        activeProducts.slice(0, 5).map((prod) => (
                          <div key={prod.id} className="flex items-center justify-between text-xs py-1 px-1">
                            <span className="text-zinc-300 truncate max-w-[200px]">{prod.title}</span>
                            <span className="text-emerald-400 font-medium shrink-0 ml-2">
                              R$ {Number(prod.price).toFixed(2).replace(".", ",")}
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
                        selectedProductIds,
                        indicatorType: c.indicatorType as "BAR" | "ICON" | "NONE" || "BAR",
                        iconName: c.iconName,
                        iconColor: c.iconColor,
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
    </div>
  );
}
