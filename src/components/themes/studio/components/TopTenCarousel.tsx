import React from "react";
import Link from "next/link";
import { HorizontalCarousel } from "./HorizontalCarousel";

interface Product {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
}

interface TopTenCarouselProps {
  storeSlug: string;
  products: Product[];
  title?: string;
}

export function TopTenCarousel({ storeSlug, products, title = "Top 15 Hoje" }: TopTenCarouselProps) {
  // Top 15 max limit
  const displayProducts = products.slice(0, 15);
  if (displayProducts.length === 0) return null;

  // Position-based deterministic color styling
  // Top 5 (0..4) receive warm colors (Red -> Red-Orange -> Orange -> Amber -> Gold)
  // Positions 6..15 (5..14) receive neutral gray
  const getPositionStyle = (index: number) => {
    switch (index) {
      case 0: // 01 - Red Intenso
        return { stroke: "#EF4444", glow: "rgba(239, 68, 68, 0.4)" };
      case 1: // 02 - Vermelho-Alaranjado
        return { stroke: "#F97316", glow: "rgba(249, 115, 22, 0.4)" };
      case 2: // 03 - Laranja Quente
        return { stroke: "#FB923C", glow: "rgba(251, 146, 60, 0.4)" };
      case 3: // 04 - Âmbar
        return { stroke: "#FBBF24", glow: "rgba(251, 191, 36, 0.4)" };
      case 4: // 05 - Dourado / Amarelo
        return { stroke: "#FACC15", glow: "rgba(250, 204, 21, 0.4)" };
      default: // 06 - 15 - Neutro
        return { stroke: "#71717A", glow: "transparent" };
    }
  };

  return (
    <HorizontalCarousel
      title={
        <h2 className="text-white text-base font-bold tracking-tight">{title}</h2>
      }
    >
      {displayProducts.map((product, index) => {
        const style = getPositionStyle(index);
        const positionFormatted = String(index + 1).padStart(2, "0");

        return (
          <Link
            key={product.id}
            href={`/miniapp/${storeSlug}/product/${product.slug}`}
            className="snap-start shrink-0 relative flex items-end group pl-12"
          >
            {/* Outline number positioned to the left, partially behind card */}
            <span
              className="absolute left-0 bottom-0 text-[92px] font-black text-transparent select-none pointer-events-none z-0 leading-none transition-all duration-300"
              style={{
                WebkitTextStroke: `2.5px ${style.stroke}`,
                filter: style.glow !== "transparent" ? `drop-shadow(0 0 6px ${style.glow})` : "none",
                fontFamily: "Impact, 'Arial Black', sans-serif"
              }}
            >
              {positionFormatted}
            </span>

            {/* Poster Card */}
            <div className="relative z-10 w-32 md:w-40 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl transition-transform duration-300 group-hover:scale-105 shrink-0">
              {product.coverUrl ? (
                <img
                  src={product.coverUrl}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-zinc-500 bg-zinc-800">
                  {product.title}
                </div>
              )}

              {/* Title overlay at the bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-2.5">
                <span className="text-white text-xs font-bold leading-tight line-clamp-2 uppercase drop-shadow-md">
                  {product.title}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </HorizontalCarousel>
  );
}
