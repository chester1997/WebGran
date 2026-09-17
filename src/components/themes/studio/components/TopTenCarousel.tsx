import React from "react";
import Link from "next/link";

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
    <section className="py-2">
      <h2 className="text-white text-lg font-bold px-4 mb-3 tracking-tight">Top 10 Hoje</h2>
      <div className="flex overflow-x-auto gap-4 px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
        {products.map((product, index) => (
          <Link key={product.id} href={`/miniapp/${storeSlug}/product/${product.slug}`} className="snap-start shrink-0 flex items-center relative pl-8 md:pl-10 group">
            {/* Outline Number */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 text-7xl md:text-8xl font-black text-black tracking-tighter z-0 pointer-events-none" style={{ WebkitTextStroke: '2px #3f3f46', lineHeight: 1 }}>
              {index + 1}
            </span>
            {/* Poster */}
            <div className="relative z-10 w-32 md:w-40 aspect-[2/3] rounded-md overflow-hidden bg-zinc-900 border border-white/10 shadow-xl transition-transform duration-300 group-hover:scale-105">
              {product.coverUrl ? (
                <img src={product.coverUrl} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-zinc-500 bg-zinc-800">Sem capa</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
