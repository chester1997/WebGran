import React from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";
import { getProductBadge } from "@/lib/product-badge";

interface ProductCardProps {
  storeSlug: string;
  product: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
    price: string | number;
    badge?: string | null;
  };
  showButtons?: boolean;
  buttonVariant?: "two-buttons" | "details";
}

export function ProductCard({ 
  storeSlug, 
  product, 
  showButtons = true,
  buttonVariant = "two-buttons"
}: ProductCardProps) {
  const width = "w-36 md:w-44";
  const badgeConfig = getProductBadge(product.badge);
  
  return (
    <div className={`flex flex-col gap-1.5 ${width}`}>
      <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="block relative rounded-xl overflow-hidden bg-zinc-900 group shadow-lg aspect-[2/3]">
        {badgeConfig && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none">
            <span className={badgeConfig.className}>
              {badgeConfig.label}
            </span>
          </div>
        )}

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
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end p-2.5">
          <span className="text-white text-xs font-semibold leading-tight drop-shadow-md line-clamp-2 uppercase tracking-tight">
            {product.title}
          </span>
        </div>
      </Link>

      <div className="flex flex-col px-1">
        <span className="text-emerald-400 font-bold text-xs tracking-tight mb-1.5">
          R$ {Number(product.price).toFixed(2).replace('.', ',')}
        </span>
        
        {showButtons && (
          buttonVariant === "details" ? (
            <div className="w-full">
              <Link
                href={`/miniapp/${storeSlug}/product/${product.slug}`}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-1 px-2 rounded-md text-center transition-colors flex items-center justify-center gap-0.5 shadow-sm"
              >
                + Detalhes
              </Link>
            </div>
          ) : (
            <div className="flex gap-1.5 w-full">
              <Link
                href={`/miniapp/${storeSlug}/product/${product.slug}`}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold py-1.5 rounded-md text-center transition-colors flex items-center justify-center"
              >
                Ver mais
              </Link>
              <AddToCartButton product={product} storeSlug={storeSlug} variant="card" />
            </div>
          )
        )}
      </div>
    </div>
  );
}
