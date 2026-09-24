import React from "react";
import Link from "next/link";
import { HorizontalCarousel } from "./HorizontalCarousel";
import { CarouselIconRenderer } from "@/lib/carousel-icons";
import { AddToCartButton } from "./AddToCartButton";
import { getProductBadge } from "@/lib/product-badge";

interface Product {
  id: string;
  slug: string;
  title: string;
  price?: string | number;
  coverUrl: string | null;
  bannerUrl?: string | null;
  badge?: string | null;
  storeId?: string;
}

interface TopTenCarouselProps {
  storeSlug: string;
  products: Product[];
  title?: string;
  indicatorType?: "BAR" | "ICON" | "NONE";
  iconName?: string | null;
  iconColor?: string | null;
}

export function TopTenCarousel({
  storeSlug,
  products,
  title = "Top 15 Hoje",
  indicatorType = "ICON",
  iconName = "Trophy",
  iconColor = "#FFD700",
}: TopTenCarouselProps) {
  // Top 15 max limit
  const displayProducts = products.slice(0, 15);
  if (displayProducts.length === 0) return null;

  // Position-based deterministic color styling for Top 5 vs 6-15
  const getPositionStyle = (index: number) => {
    switch (index) {
      case 0: // 1º Lugar - Red
        return { stroke: "#EF4444", glow: "rgba(239, 68, 68, 0.4)" };
      case 1: // 2º Lugar - Red-Orange
        return { stroke: "#F97316", glow: "rgba(249, 115, 22, 0.4)" };
      case 2: // 3º Lugar - Orange
        return { stroke: "#FB923C", glow: "rgba(251, 146, 60, 0.4)" };
      case 3: // 4º Lugar - Amber
        return { stroke: "#FBBF24", glow: "rgba(251, 191, 36, 0.4)" };
      case 4: // 5º Lugar - Gold / Amarelo
        return { stroke: "#FACC15", glow: "rgba(250, 204, 21, 0.4)" };
      default: // 6º ao 15º - Neutro Cinza
        return { stroke: "#9CA3AF", glow: "rgba(156, 163, 175, 0.25)" };
    }
  };

  return (
    <HorizontalCarousel
      trackClassName="pt-2 pb-8 sm:pb-10"
      title={
        <div className="flex items-center gap-2">
          {indicatorType === "ICON" && (
            <CarouselIconRenderer
              iconName={iconName || "Trophy"}
              color={iconColor || "#FFD700"}
              className="w-5 h-5 shrink-0"
              size={20}
            />
          )}
          {indicatorType === "BAR" && (
            <div className="w-1 h-4 bg-red-600 rounded-full shrink-0"></div>
          )}
          <h2 className="text-white text-base font-bold tracking-tight uppercase">
            {title}
          </h2>
        </div>
      }
    >
      {displayProducts.map((product, index) => {
        const style = getPositionStyle(index);
        const displayPosition = String(index + 1); // 1-15 (NO leading zero)
        const isDoubleDigit = index >= 9; // Positions 10-15
        const badgeConfig = getProductBadge(product.badge);

        return (
          <div key={product.id} className="snap-start shrink-0 relative flex flex-col justify-end group">
            {/* Crisp outline position number with soft subtle glow */}
            <span
              className="absolute left-0 -bottom-3 sm:-bottom-4 md:-bottom-5 text-[104px] sm:text-[118px] md:text-[128px] font-black text-transparent select-none pointer-events-none z-20 leading-none transition-all duration-300"
              style={{
                WebkitTextStroke: `3.5px ${style.stroke}`,
                filter: `drop-shadow(0 0 4px ${style.glow})`,
                fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
                letterSpacing: "-0.04em"
              }}
            >
              {displayPosition}
            </span>

            {/* Vertical 2:3 Image Card Container */}
            <div
              className={`relative flex flex-col items-end ${
                isDoubleDigit 
                  ? "pl-12 sm:pl-14 md:pl-16" 
                  : "pl-8 sm:pl-9 md:pl-10"
              }`}
            >
              <div className="relative z-10 w-32 sm:w-36 md:w-40 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-md transition-transform duration-300 group-hover:scale-105 shrink-0">
                <Link
                  href={`/miniapp/${storeSlug}/product/${product.slug}`}
                  className="block w-full h-full"
                >
                  {badgeConfig && (
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <span className={badgeConfig.className}>
                        {badgeConfig.label}
                      </span>
                    </div>
                  )}

                  {product.coverUrl || product.bannerUrl ? (
                    <img
                      src={product.coverUrl || product.bannerUrl!}
                      alt={product.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-zinc-500 bg-zinc-800">
                      {product.title}
                    </div>
                  )}
                </Link>

                {/* Red Cart Button OVER BOTTOM-RIGHT of image */}
                <div className="absolute bottom-2 right-2 z-30">
                  <AddToCartButton product={product} storeSlug={storeSlug} variant="icon" />
                </div>
              </div>
            </div>

            {/* Price Row below image card aligned to the right */}
            <div className={`relative z-20 w-32 sm:w-36 md:w-40 flex items-center justify-end pt-2 px-0.5 ${
              isDoubleDigit 
                ? "ml-12 sm:ml-14 md:ml-16" 
                : "ml-8 sm:ml-9 md:ml-10"
            }`}>
              {product.price !== undefined && (
                <span className="text-emerald-400 font-bold text-xs sm:text-sm tracking-tight">
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </HorizontalCarousel>
  );
}
