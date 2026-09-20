import React from "react";
import Link from "next/link";
import { HorizontalCarousel } from "./HorizontalCarousel";
import { CarouselIconRenderer } from "@/lib/carousel-icons";

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
  // Top 5 (indices 0..4 -> Positions 1..5) receive warm subtle glowing colors
  // Positions 6..15 (indices 5..14) receive neutral gray
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
        return { stroke: "#71717A", glow: "transparent" };
    }
  };

  return (
    <HorizontalCarousel
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
            <div className="w-1 h-4 bg-violet-600 rounded-full shrink-0"></div>
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

        return (
          <div key={product.id} className="snap-start shrink-0 relative flex items-end group">
            <Link
              href={`/miniapp/${storeSlug}/product/${product.slug}`}
              className={`relative flex items-end ${
                isDoubleDigit 
                  ? "pl-9 sm:pl-10 md:pl-12" 
                  : "pl-6 sm:pl-7 md:pl-8"
              }`}
            >
              {/* Crisp outline position number overlapping bottom-left edge */}
              <span
                className="absolute left-0 bottom-1 text-6xl sm:text-7xl md:text-[80px] font-extrabold text-transparent select-none pointer-events-none z-20 leading-none transition-all duration-300"
                style={{
                  WebkitTextStroke: `2.5px ${style.stroke}`,
                  filter: style.glow !== "transparent" ? `drop-shadow(0 0 6px ${style.glow})` : "none",
                  fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
                  letterSpacing: "-0.03em"
                }}
              >
                {displayPosition}
              </span>

              {/* Poster Card */}
              <div className="relative z-10 w-32 sm:w-36 md:w-40 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-xl transition-transform duration-300 group-hover:scale-105 shrink-0">
                {product.coverUrl ? (
                  <img
                    src={product.coverUrl}
                    alt={product.title}
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
          </div>
        );
      })}
    </HorizontalCarousel>
  );
}
