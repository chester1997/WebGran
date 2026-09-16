import React from "react";
import Link from "next/link";
import { ProductCard } from "./ProductCard";

interface Product {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
}

interface ProductCarouselProps {
  title: string;
  storeSlug: string;
  products: Product[];
}

export function ProductCarousel({ title, storeSlug, products }: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-4">
      <h2 className="text-white text-lg font-bold px-4 mb-3 tracking-tight">{title}</h2>
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
