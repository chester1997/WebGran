import React from "react";
import Link from "next/link";
import { ProductCard } from "./ProductCard";

interface Product {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
}

interface TopTenCarouselProps {
  storeSlug: string;
  products: Product[];
}

export function TopTenCarousel({ storeSlug, products }: TopTenCarouselProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-4">
      <h2 className="text-white text-lg font-bold px-4 mb-3 tracking-tight">Top 10 Hoje</h2>
      <div className="flex overflow-x-auto gap-2 px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
        {products.map((product, index) => (
          <div key={product.id} className="snap-start shrink-0 flex items-center relative pl-8">
            <span className="absolute left-0 -translate-x-2 text-7xl font-bold text-zinc-900 drop-shadow-[0_0_1px_rgba(255,255,255,0.5)] tracking-tighter z-0" style={{ WebkitTextStroke: '1px #52525b' }}>
              {index + 1}
            </span>
            <div className="relative z-10">
              <ProductCard storeSlug={storeSlug} product={product} isLarge={true} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
