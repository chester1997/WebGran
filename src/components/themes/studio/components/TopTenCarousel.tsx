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
        return { stroke: "#EF4444", glow: "rgba(239, 68, 68, 0.18)" };
      case 1: // 2º Lugar - Red-Orange
        return { stroke: "#F97316", glow: "rgba(249, 115, 22, 0.18)" };
      case 2: // 3º Lugar - Orange
        return { stroke: "#FB923C", glow: "rgba(251, 146, 60, 0.18)" };
      case 3: // 4º Lugar - Amber
        return { stroke: "#FBBF24", glow: "rgba(251, 191, 36, 0.18)" };
      case 4: // 5º Lugar - Gold / Amarelo
        return { stroke: "#FACC15", glow: "rgba(250, 204, 21, 0.18)" };
      default: // 6º ao 15º - Neutro Cinza
        return { stroke: "#71717A", glow: "transparent" };
    }
  };

  return (
    <HorizontalCarousel
      trackClassName="pt-3 pb-12 sm:pb-14 md:pb-16"
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
            {/* Crisp outline position number overlapping bottom-left edge */}
            <span
              className="absolute left-0 -bottom-2 sm:-bottom-2.5 md:-bottom-3 text-[84px] sm:text-[96px] md:text-[108px] font-black text-transparent select-none pointer-events-none z-20 leading-none transition-all duration-300"
              style={{
                WebkitTextStroke: `3px ${style.stroke}`,
                filter: style.glow !== "transparent" ? `drop-shadow(0 0 4px ${style.glow})` : "none",
                fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
                letterSpacing: "-0.04em"
              }}
            >
              {displayPosition}
            </span>

            <Link
              href={`/miniapp/${storeSlug}/product/${product.slug}`}
              className={`relative flex flex-col items-end ${
                isDoubleDigit 
                  ? "pl-12 sm:pl-14 md:pl-16" 
                  : "pl-7 sm:pl-8 md:pl-9"
              }`}
            >
              {/* Horizontal 16:9 Image Card */}
              <div className="relative z-10 w-48 sm:w-56 md:w-64 aspect-[16/9] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-md transition-transform duration-300 group-hover:scale-105 shrink-0">
                {badgeConfig && (
                  <div className="absolute top-2 left-2 z-20 pointer-events-none">
                    <span className={badgeConfig.className}>
                      {badgeConfig.label}
                    </span>
                  </div>
                )}

                {product.bannerUrl || product.coverUrl ? (
                  <img
                    src={product.bannerUrl || product.coverUrl!}
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
              </div>
            </Link>

            {/* Price & Add to Cart Action Row below image card */}
            <div className={`relative z-20 w-48 sm:w-56 md:w-64 flex items-center justify-end gap-2 pt-2 px-0.5 ${
              isDoubleDigit 
                ? "ml-12 sm:ml-14 md:ml-16" 
                : "ml-7 sm:ml-8 md:ml-9"
            }`}>
              {product.price !== undefined && (
                <span className="text-emerald-400 font-bold text-xs sm:text-sm tracking-tight">
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </span>
              )}
              <AddToCartButton product={product} storeSlug={storeSlug} variant="icon" />
            </div>
          </div>
        );
      })}
    </HorizontalCarousel>
  );
}
