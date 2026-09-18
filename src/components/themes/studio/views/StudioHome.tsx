import React from "react";
import { db } from "@/db";
import { stores, products, categories, banners, telegramBots, productCarousels } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { HeroBanner } from "../components/HeroBanner";
import { ProductCarousel } from "../components/ProductCarousel";
import { TopTenCarousel } from "../components/TopTenCarousel";
import { RankingService } from "@/lib/catalog/ranking-service";
import Link from "next/link";
import { Search, UserCircle } from "lucide-react";
import { StudioHeader } from "../components/StudioHeader";


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

  // Fetch custom carousels configured by the seller
  const customCarousels = await db.query.productCarousels.findMany({
    where: and(eq(productCarousels.storeId, store.id), eq(productCarousels.status, 'active')),
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

  // Fetch first bot's photo for the header logo
  const firstBot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id),
    columns: { photoUrl: true }
  });
  const headerLogoUrl = firstBot?.photoUrl || store.logoUrl || null;

  // Fallbacks for top 10 and default sections
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
    <div className="w-full">


      <StudioHeader 
        storeSlug={storeSlug} 
        storeName={store.name} 
        headerLogoUrl={headerLogoUrl} 
      />


      {storeBanners.length > 0 ? (
        <HeroBanner storeSlug={storeSlug} banner={storeBanners[0]} />
      ) : heroProduct ? (
        <HeroBanner storeSlug={storeSlug} product={heroProduct} />
      ) : (
        <div className="pt-24 px-4 text-center text-zinc-500">Nenhum produto cadastrado.</div>
      )}

      <div className="relative z-20 mt-4 space-y-4">

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

        {/* Custom Carousels configured by seller */}
        {customCarousels.length > 0 ? (
          customCarousels.map(carousel => {
            const carouselProductsList = carousel.items
              .map(i => i.product)
              .filter(p => p && p.status === 'active');
            
            if (carouselProductsList.length === 0) return null;

            return (
              <ProductCarousel 
                key={carousel.id} 
                title={carousel.name} 
                storeSlug={storeSlug} 
                products={carouselProductsList} 
              />
            );
          })
        ) : (
          /* Default Fallback Carousels if no custom carousel created */
          <>
            <ProductCarousel title="Mais Recentes" storeSlug={storeSlug} products={recents} />
            <ProductCarousel title="Mais Vendidos" storeSlug={storeSlug} products={bestSellers} />
          </>
        )}
      </div>
    </div>
  );
}
