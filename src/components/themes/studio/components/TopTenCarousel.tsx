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
    <section className="py-4">
      <h2 className="text-white text-lg font-bold px-4 mb-4 tracking-tight">Top 10 Hoje</h2>

      <div className="flex overflow-x-auto gap-4 px-6 pb-6 pt-2 snap-x snap-mandatory scrollbar-hide">
        {products.map((product, index) => (
          <Link
            key={product.id}
            href={`/miniapp/${storeSlug}/product/${product.slug}`}
            className="snap-start shrink-0 relative flex items-end group pl-12"
          >
            {/* Outline number positioned to the left, partially behind card */}
            <span
              className="absolute left-0 bottom-0 text-[110px] font-black text-transparent select-none pointer-events-none z-0 leading-none"
              style={{
                WebkitTextStroke: "2.5px #ffffff",
                fontFamily: "Impact, 'Arial Black', sans-serif"
              }}
            >
              {index + 1}
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
        ))}
      </div>
    </section>
  );
}
