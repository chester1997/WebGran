import React from "react";
import { ProductCard } from "./ProductCard";
import { HorizontalCarousel } from "./HorizontalCarousel";

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
  indicatorType?: "BAR" | "ICON" | "NONE";
  iconName?: string | null;
  iconColor?: string | null;
}

export function ProductCarousel({
  title,
  storeSlug,
  products,
  indicatorType = "BAR",
  iconName,
  iconColor,
}: ProductCarouselProps) {
  if (products.length === 0) return null;

  const countBadge = `${products.length} produto${products.length !== 1 ? 's' : ''}`;

  return (
    <HorizontalCarousel
      title={title}
      subtitle={countBadge}
      indicatorType={indicatorType}
      iconName={iconName}
      iconColor={iconColor}
    >
      {products.map(product => (
        <div key={product.id} className="snap-start shrink-0">
          <ProductCard storeSlug={storeSlug} product={product} />
        </div>
      ))}
    </HorizontalCarousel>
  );
}
