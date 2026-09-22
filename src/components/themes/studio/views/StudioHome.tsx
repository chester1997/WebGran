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

  const rankingProducts = rankingCarousel
    ? rankingCarousel.items
        .map(i => i.product)
        .filter(p => p && p.status === 'active')
        .slice(0, 15)
    : [];

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

      <div className="relative z-20 mt-3 space-y-4">
        {/* Categories Section (Dual Display Mode: IMAGE vs ICON) */}
        {store.categories && store.categories.length > 0 && (() => {
          const displayStyle = store.categoryDisplayStyle || "IMAGE";
          const isIconMode = displayStyle === "ICON";

          return (
            <section className="w-full overflow-hidden pt-1 pb-1">
              <div 
                className={`flex overflow-x-auto scrollbar-hide w-full select-none px-4 ${
                  isIconMode ? "gap-2 sm:gap-2.5" : "gap-1.5 sm:gap-2"
                }`}
                style={{
                  msOverflowStyle: "none",
                  scrollbarWidth: "none",
                }}
              >
                {store.categories.map(cat => (
                  <Link 
                    key={cat.id} 
                    href={`/miniapp/${storeSlug}/category/${cat.slug}`} 
                    className={
                      isIconMode
                        ? "shrink-0 relative w-[76px] sm:w-[84px] h-[64px] sm:h-[70px] rounded-xl border border-white/10 bg-[#18181B]/80 hover:bg-zinc-800/90 flex flex-col items-center justify-center p-2 text-center transition-all duration-200 active:scale-95 group shadow-sm"
                        : cat.imageUrl 
                          ? "shrink-0 relative w-[115px] sm:w-[135px] aspect-square flex items-center justify-center bg-transparent border-0 shadow-none outline-none transition-transform duration-200 active:scale-95 group"
                          : "shrink-0 relative w-[115px] sm:w-[135px] aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#121216] shadow-lg shadow-black/40 flex items-center justify-center transition-all duration-200 active:scale-95 group"
                    }
                  >
                    {isIconMode ? (
                      <>
                        <CarouselIconRenderer 
                          iconName={cat.iconName || "Tv"} 
                          color="#E4E4E7" 
                          className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" 
                          size={20}
                        />
                        <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-200 truncate max-w-full leading-tight mt-1 group-hover:text-white">
                          {cat.name}
                        </span>
                      </>
                    ) : cat.imageUrl ? (
                      <img 
                        src={cat.imageUrl} 
                        alt={cat.name} 
                        className="w-full h-full object-contain bg-transparent pointer-events-none transition-transform duration-300 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="w-full h-full p-3 bg-gradient-to-br from-[#B91C1C] via-[#991B1B] to-[#450A0A] flex flex-col items-center justify-center text-center rounded-2xl">
                        <span className="text-xs sm:text-sm font-black tracking-wider text-white uppercase text-center drop-shadow-md truncate max-w-full">
                          {cat.name}
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

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
