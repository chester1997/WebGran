import React from "react";
import { db } from "@/db";
import { stores, products, categories, banners, telegramBots, productCarousels } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { HeroBanner } from "../components/HeroBanner";
import { ProductCarousel } from "../components/ProductCarousel";
import { TopTenCarousel } from "../components/TopTenCarousel";
import Link from "next/link";
import { StudioHeader } from "../components/StudioHeader";
import { CarouselIconRenderer } from "@/lib/carousel-icons";

import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

import { Category3DPopoutCard } from "../components/Category3DPopoutCard";
import { CategoryIconCard } from "../components/CategoryIconCard";

import { getStoreBySlug } from "@/lib/store-cache";

export async function StudioHome({ storeSlug }: { storeSlug: string }) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) return null;

  const [
    allProducts,
    storeBanners,
    rankingCarousel,
    standardCarousels,
    firstBot
  ] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.storeId, store.id),
      orderBy: [desc(products.createdAt)],
      limit: 20
    }),
    db.query.banners.findMany({
      where: and(eq(banners.storeId, store.id), eq(banners.status, 'active')),
      orderBy: [asc(banners.position), desc(banners.createdAt)],
      limit: 5
    }),
    db.query.productCarousels.findFirst({
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
    }),
    db.query.productCarousels.findMany({
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
    }),
    db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id),
    })
  ]);

  const rankingProducts = rankingCarousel?.items?.map(i => i.product).filter(p => p && p.status === 'active') || [];

  let headerLogoUrl = firstBot?.photoUrl || store.logoUrl || null;

  if (!headerLogoUrl && firstBot?.tokenEncrypted) {
    try {
      const token = decrypt(firstBot.tokenEncrypted);
      const botService = new TelegramBotService(token);
      const fetchedPhoto = await botService.getProfilePhotoUrl();
      if (fetchedPhoto) {
        headerLogoUrl = fetchedPhoto;
        // Asynchronously update DB so future requests hit cache
        db.update(telegramBots)
          .set({ photoUrl: fetchedPhoto, updatedAt: new Date() })
          .where(eq(telegramBots.id, firstBot.id))
          .then(() => {})
          .catch(() => {});
      }
    } catch (e) {
      console.error("[StudioHome] Failed to auto-fetch bot photo:", e);
    }
  }

  // Fallbacks for default sections if no custom carousels created
  const recents = allProducts.slice(0, 8);
  const bestSellers = allProducts.slice(0, 5);

  return (
    <div className="w-full">
      {/* Search Header */}
      <StudioHeader 
        storeSlug={storeSlug} 
        storeName={store.name} 
        headerLogoUrl={headerLogoUrl} 
      />

      {/* Main Hero Banners */}
      {storeBanners.length > 0 && (
        <HeroBanner 
          storeSlug={storeSlug} 
          banners={storeBanners} 
          intervalSeconds={store.bannerInterval || 5} 
        />
      )}

      <div className="relative z-20 mt-2 space-y-4">
        {/* Categories Section */}
        {store.categories && store.categories.length > 0 && (
          <section className="w-full overflow-hidden py-2.5">
            {store.categoryDisplayStyle === 'ICON' ? (
              /* ── ICON MODE: compact 56px cards, name below ── */
              <div
                className="flex overflow-x-auto scrollbar-hide w-full select-none px-4 py-1 gap-3"
                style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
              >
                {store.categories.map((cat) => (
                  <CategoryIconCard
                    key={cat.id}
                    category={cat}
                    storeSlug={storeSlug}
                  />
                ))}
              </div>
            ) : (
              /* ── IMAGE MODE: 3D Popout cards (existing) ── */
              <div
                className="flex overflow-x-auto scrollbar-hide w-full select-none px-4 py-1 gap-2.5 sm:gap-3"
                style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
              >
                {store.categories.map((cat) => (
                  <Category3DPopoutCard
                    key={cat.id}
                    category={cat}
                    storeSlug={storeSlug}
                  />
                ))}
              </div>
            )}
          </section>
        )}

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
