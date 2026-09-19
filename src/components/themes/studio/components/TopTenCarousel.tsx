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

  // Position-based deterministic color styling for Top 5 vs 6-15
  // Top 5 (indices 0..4 -> Positions 1..5) receive warm glowing colors
  // Positions 6..15 (indices 5..14) receive neutral gray
  const getPositionStyle = (index: number) => {
    switch (index) {
      case 0: // 1º Lugar - Red
        return { stroke: "#EF4444", glow: "rgba(239, 68, 68, 0.5)" };
      case 1: // 2º Lugar - Red-Orange
        return { stroke: "#F97316", glow: "rgba(249, 115, 22, 0.5)" };
      case 2: // 3º Lugar - Orange
        return { stroke: "#FB923C", glow: "rgba(251, 146, 60, 0.5)" };
      case 3: // 4º Lugar - Amber
        return { stroke: "#FBBF24", glow: "rgba(251, 191, 36, 0.5)" };
      case 4: // 5º Lugar - Gold / Amarelo
        return { stroke: "#FACC15", glow: "rgba(250, 204, 21, 0.5)" };
      default: // 6º ao 15º - Neutro Cinza
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
        const displayPosition = String(index + 1); // 1-15 (NO leading zero)
        const isDoubleDigit = index >= 9; // Positions 10-15

        return (
          <div key={product.id} className="snap-start shrink-0 relative flex items-end group">
            <Link
              href={`/miniapp/${storeSlug}/product/${product.slug}`}
              className={`relative flex items-end ${
                isDoubleDigit 
                  ? "pl-11 sm:pl-14 md:pl-16" 
                  : "pl-7 sm:pl-9 md:pl-11"
              }`}
            >
              {/* Giant Outline position number placed overlapping bottom-left edge */}
              <span
                className="absolute left-0 -bottom-1 text-6xl sm:text-7xl md:text-8xl font-black text-transparent select-none pointer-events-none z-20 leading-none transition-all duration-300"
                style={{
                  WebkitTextStroke: `2.5px ${style.stroke}`,
                  filter: style.glow !== "transparent" ? `drop-shadow(0 0 8px ${style.glow})` : "none",
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  letterSpacing: "-0.04em"
                }}
              >
                {displayPosition}
              </span>

              {/* Poster Card */}
              <div className="relative z-10 w-32 sm:w-36 md:w-40 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl transition-transform duration-300 group-hover:scale-105 shrink-0">
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

                {/* Gradient Title Overlay at bottom of poster */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-2 sm:p-2.5">
                  <span className="text-white text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 uppercase drop-shadow-md">
                    {product.title}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </HorizontalCarousel>
  );
}
