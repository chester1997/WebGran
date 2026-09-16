import React from "react";
import Link from "next/link";
import Image from "next/image";

interface ProductCardProps {
  storeSlug: string;
  product: {
    slug: string;
    title: string;
    coverUrl: string | null;
  };
  isLarge?: boolean;
}

export function ProductCard({ storeSlug, product, isLarge = false }: ProductCardProps) {
  const width = isLarge ? "w-36 md:w-48" : "w-28 md:w-40";
  const height = isLarge ? "h-52 md:h-72" : "h-40 md:h-60";
  
  return (
    <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className={`block ${width} group relative`}>
      <div className={`relative ${width} ${height} rounded-md overflow-hidden bg-zinc-900 transition-transform duration-300 group-hover:scale-105 group-hover:ring-2 ring-white/50`}>
        {product.coverUrl ? (
          <img 
            src={product.coverUrl} 
            alt={product.title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-zinc-500 bg-zinc-800">
            {product.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
          <span className="text-white text-xs font-medium truncate w-full drop-shadow-md">
            {product.title}
          </span>
        </div>
      </div>
    </Link>
  );
}
