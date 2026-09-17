import React from "react";
import Link from "next/link";
import { ProductCard } from "./ProductCard";

interface Product {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  price: string | number;
}

interface ProductCarouselProps {
  title: string;
  storeSlug: string;
  products: Product[];
}

export function ProductCarousel({ title, storeSlug, products }: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-2">
      <div className="flex items-center gap-2 px-4 mb-3">
        <div className="w-1 h-4 bg-violet-600 rounded-full"></div>
        <h2 className="text-white text-base font-bold tracking-tight uppercase flex items-center gap-2">
          {title}
          <span className="text-zinc-600 text-[10px] lowercase font-normal">{products.length} planos</span>
        </h2>
      </div>
      <div className="flex overflow-x-auto gap-3 px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
        {products.map(product => (
          <div key={product.id} className="snap-start shrink-0">
            <ProductCard storeSlug={storeSlug} product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
