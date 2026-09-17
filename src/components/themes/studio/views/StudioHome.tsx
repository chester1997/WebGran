import React from "react";
import { db } from "@/db";
import { stores, products, categories, banners, telegramBots } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { HeroBanner } from "../components/HeroBanner";
import { ProductCarousel } from "../components/ProductCarousel";
import { TopTenCarousel } from "../components/TopTenCarousel";
import { RankingService } from "@/lib/catalog/ranking-service";
import Link from "next/link";
import { Search, UserCircle } from "lucide-react";

export async function StudioHome({ storeSlug }: { storeSlug: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug),
    with: {
      categories: {
        where: eq(categories.status, 'active')
      }
    }
  });

  if (!store) return null;

  const allProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    limit: 20
  });

  const storeBanners = await db.query.banners.findMany({
    where: and(eq(banners.storeId, store.id), eq(banners.status, 'active')),
    orderBy: [desc(banners.position), desc(banners.createdAt)],
    limit: 5
  });

  // Fetch first bot's photo for the header logo
  const firstBot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id),
    columns: { photoUrl: true }
  });
  const headerLogoUrl = firstBot?.photoUrl || store.logoUrl || null;

  // Fallbacks if no data
  const heroProduct = allProducts[0];
  
  let topTen: typeof allProducts = [];
  try {
    topTen = await RankingService.getTopProducts(store.id, 'week');
  } catch {
    topTen = [];
  }
  
  const recents = allProducts.slice(0, 8);
  const bestSellers = topTen.length > 0 ? topTen : allProducts.slice(0, 5);

  return (
    <div className="w-full h-full pb-8">
      {/* Absolute Transparent Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          {headerLogoUrl ? (
            <img src={headerLogoUrl} alt={store.name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-white text-xs">
              {store.name.charAt(0)}
            </div>
          )}
          <span className="text-white font-bold tracking-wider text-sm">{store.name}</span>
        </div>
        <div className="flex items-center gap-4 text-white">
          <Link href={`/miniapp/${storeSlug}/search`}>
            <Search className="w-5 h-5" />
          </Link>
          <Link href={`/miniapp/${storeSlug}/profile`}>
            <UserCircle className="w-6 h-6" />
          </Link>
        </div>
      </header>

      {storeBanners.length > 0 ? (
        <HeroBanner storeSlug={storeSlug} banner={storeBanners[0]} />
      ) : heroProduct ? (
        <HeroBanner storeSlug={storeSlug} product={heroProduct} />
      ) : (
        <div className="pt-24 px-4 text-center text-zinc-500">Nenhum produto cadastrado.</div>
      )}

      <div className="relative z-20 -mt-10 space-y-2">
        <TopTenCarousel storeSlug={storeSlug} products={topTen} />
        
        {/* Categories Pills */}
        {store.categories && store.categories.length > 0 && (
          <section className="px-4 py-4">
            <div className="flex overflow-x-auto gap-2 scrollbar-hide">
              {store.categories.map(cat => (
                <Link key={cat.id} href={`/miniapp/${storeSlug}/category/${cat.slug}`} className="shrink-0 px-4 py-1.5 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-300 text-sm font-medium hover:bg-white hover:text-black transition-colors">
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <ProductCarousel title="Mais Recentes" storeSlug={storeSlug} products={recents} />
        <ProductCarousel title="Mais Vendidos" storeSlug={storeSlug} products={bestSellers} />
      </div>
    </div>
  );
}
