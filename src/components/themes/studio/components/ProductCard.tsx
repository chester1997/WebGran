import React from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton"; // Assume we have or will create this

interface ProductCardProps {
  storeSlug: string;
  product: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
    price: string | number;
  };
  showButtons?: boolean;
}

export function ProductCard({ storeSlug, product, showButtons = true }: ProductCardProps) {
  const width = "w-36 md:w-44";
  
  return (
    <div className={`flex flex-col gap-2 ${width}`}>
      <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="block relative rounded-xl overflow-hidden bg-zinc-900 group shadow-lg aspect-[2/3]">
        {product.coverUrl ? (
          <img 
            src={product.coverUrl} 
            alt={product.title} 
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-zinc-500 bg-zinc-800">
            Sem capa
          </div>
        )}
        
        {/* Title overlay at the bottom of the image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end p-3">
          <span className="text-white text-sm font-bold leading-tight drop-shadow-md line-clamp-3 uppercase tracking-tight">
            {product.title}
          </span>
        </div>
      </Link>

      <div className="flex flex-col px-1">
        <span className="text-emerald-400 font-bold text-sm tracking-tight mb-2">
          R$ {Number(product.price).toFixed(2).replace('.', ',')}
        </span>
        
        {showButtons && (
          <div className="flex gap-1.5 w-full">
            <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold py-2 rounded-lg text-center transition-colors">
              Ver mais
            </Link>
            <AddToCartButton product={product} storeSlug={storeSlug} variant="card" />
          </div>
        )}
      </div>
    </div>
  );
}
