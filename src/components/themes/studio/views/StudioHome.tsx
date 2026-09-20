import React from "react";
import { db } from "@/db";
import { stores, products, categories, banners, telegramBots, productCarousels } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { HeroBanner } from "../components/HeroBanner";
import { ProductCarousel } from "../components/ProductCarousel";
import { TopTenCarousel } from "../components/TopTenCarousel";
import Link from "next/link";
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
    orderBy: [asc(banners.position), desc(banners.createdAt)],
    limit: 5
  });

  // Fetch Editorial Ranking Carousel (Top 15)
  const rankingCarousel = await db.query.productCarousels.findFirst({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, true),
      eq(productCarousels.status, 'active')
    ),
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.position)],
        with: {
          product: true
        }
      }
    }
  });

  const rankingProducts = rankingCarousel
    ? rankingCarousel.items
        .map(i => i.product)
        .filter(p => p && p.status === 'active')
        .slice(0, 15)
    : [];

  // Fetch Standard Carousels configured by the seller
  const standardCarousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false),
      eq(productCarousels.status, 'active')
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

  // Fetch first bot's photo for the header logo
  const firstBot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id),
    columns: { photoUrl: true }
  });
  const headerLogoUrl = firstBot?.photoUrl || store.logoUrl || null;

  // Fallbacks for default sections if no custom carousels created
  const recents = allProducts.slice(0, 8);
  const bestSellers = allProducts.slice(0, 5);

  return (
    <div className="w-full">
      <StudioHeader 
        storeSlug={storeSlug} 
        storeName={store.name} 
        headerLogoUrl={headerLogoUrl} 
      />

      {/* Premium Compact Banner Slider */}
      {storeBanners.length > 0 && (
        <HeroBanner 
          storeSlug={storeSlug} 
          banners={storeBanners} 
          intervalSeconds={store.bannerInterval || 5} 
        />
      )}

      <div className="relative z-20 mt-4 space-y-4">
        {/* Editorial Ranking Carousel (Top 15) */}
        {rankingProducts.length > 0 && (
          <TopTenCarousel 
            storeSlug={storeSlug} 
            title={rankingCarousel?.name || "Top 15 Hoje"} 
            products={rankingProducts} 
            indicatorType={rankingCarousel?.indicatorType as "BAR" | "ICON" | "NONE" || "ICON"}
            iconName={rankingCarousel?.iconName || "Trophy"}
            iconColor={rankingCarousel?.iconColor || "#FFD700"}
          />
        )}
        
        {/* Categories Pills */}
        {store.categories && store.categories.length > 0 && (
          <section className="py-2 w-full overflow-hidden">
            <div 
              className="flex overflow-x-auto scrollbar-hide w-full"
              style={{
                paddingInlineStart: "var(--miniapp-content-padding-x)",
                paddingInlineEnd: "var(--miniapp-content-padding-x)",
                gap: "0.5rem",
              }}
            >
              {store.categories.map(cat => (
                <Link key={cat.id} href={`/miniapp/${storeSlug}/category/${cat.slug}`} className="shrink-0 px-4 py-1.5 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-300 text-sm font-medium hover:bg-white hover:text-black transition-colors">
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Custom Standard Carousels configured by seller */}
        {standardCarousels.length > 0 ? (
          standardCarousels.map(carousel => {
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
                indicatorType={carousel.indicatorType as "BAR" | "ICON" | "NONE" || "BAR"}
                iconName={carousel.iconName}
                iconColor={carousel.iconColor}
              />
            );
          })
        ) : (
          /* Default Fallback Carousels if no custom carousel created */
          <>
            <ProductCarousel title="Mais Recentes" storeSlug={storeSlug} products={recents} indicatorType="BAR" />
            <ProductCarousel title="Mais Vendidos" storeSlug={storeSlug} products={bestSellers} indicatorType="BAR" />
          </>
        )}
      </div>
    </div>
  );
}
