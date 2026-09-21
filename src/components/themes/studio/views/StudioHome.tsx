import React from "react";
import { db } from "@/db";
import { stores, products, categories, banners, telegramBots, productCarousels } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { HeroBanner } from "../components/HeroBanner";
import { ProductCarousel } from "../components/ProductCarousel";
import { TopTenCarousel } from "../components/TopTenCarousel";
import Link from "next/link";
import { StudioHeader } from "../components/StudioHeader";

import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

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

      <div className="relative z-20 mt-3 space-y-5">
        {/* Categories Cards (MOVED ABOVE TOP 15 DA SEMANA) */}
        {store.categories && store.categories.length > 0 && (
          <section className="w-full overflow-hidden pt-1 pb-2">
            <div 
              className="flex overflow-x-auto scrollbar-hide w-full"
              style={{
                paddingInlineStart: "var(--miniapp-content-padding-x)",
                paddingInlineEnd: "var(--miniapp-content-padding-x)",
                gap: "0.75rem",
              }}
            >
              {store.categories.map(cat => (
                <Link 
                  key={cat.id} 
                  href={`/miniapp/${storeSlug}/category/${cat.slug}`} 
                  className="shrink-0 relative min-w-[130px] sm:min-w-[150px] h-[54px] rounded-2xl overflow-hidden border border-red-500/30 bg-gradient-to-r from-[#B91C1C] via-[#991B1B] to-[#450A0A] shadow-lg shadow-red-950/40 flex items-center justify-center px-4 transition-transform active:scale-95 group"
                >
                  {/* Optional Background Image with Red Gradient Overlay */}
                  {cat.imageUrl && (
                    <img 
                      src={cat.imageUrl} 
                      alt={cat.name} 
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity" 
                    />
                  )}
                  {/* Subtle Red Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-950/80 via-red-900/60 to-black/70 pointer-events-none" />
                  
                  {/* Category Title Centered */}
                  <span className="relative z-10 text-xs sm:text-sm font-black tracking-wider text-white uppercase text-center drop-shadow-md truncate">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
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
