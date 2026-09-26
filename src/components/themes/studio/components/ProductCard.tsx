import React from "react";
import Link from "next/link";
import { Eye, Flame } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";
import { getProductBadge } from "@/lib/product-badge";

function formatViewsCount(count: number | string | null | undefined): string {
  if (count === null || count === undefined) return "0";
  const num = typeof count === "string" ? parseFloat(count) : count;
  if (isNaN(num) || num <= 0) return "0";
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

interface ProductCardProps {
  storeSlug: string;
  product: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
    price: string | number;
    badge?: string | null;
    storeId?: string;
    views?: number | string | null;
    viewsCount?: number | string | null;
    showViews?: boolean;
    isHot?: boolean;
    showFire?: boolean | null;
  };
  showButtons?: boolean;
  buttonVariant?: "two-buttons" | "details";
  isTopTen?: boolean;
  showViews?: boolean;
  viewsCount?: number | string;
  showFire?: boolean | null;
}

function ProductCardBase({ 
  storeSlug, 
  product, 
  showButtons = true,
  buttonVariant = "two-buttons",
  isTopTen = false,
  showViews: propShowViews,
  viewsCount: propViewsCount,
  showFire: propShowFire,
}: ProductCardProps) {
  const width = "w-36 md:w-44";
  const badgeConfig = getProductBadge(product.badge);

  const rawViews = propViewsCount ?? product.viewsCount ?? product.views;
  const hasViews = !isTopTen && (propShowViews || product.showViews || (rawViews !== undefined && rawViews !== null && Number(rawViews) > 0));
  const hasFire = !isTopTen && (propShowFire || product.showFire || product.isHot || product.badge === 'em_alta' || product.badge === 'hot' || product.badge === 'destaque');

  const displayViews = rawViews ?? 0;

  return (
    <div className={`flex flex-col gap-1.5 ${width}`}>
      <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="block relative rounded-xl overflow-hidden bg-zinc-900 group shadow-lg aspect-[2/3]">
        {badgeConfig && (
          <div className="absolute top-1 left-1 z-20 pointer-events-none">
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
        {/* Single Row: Price on LEFT, Indicators (Eye + Flame) on RIGHT */}
        <div className="flex items-center justify-between gap-1 w-full min-w-0 mb-1.5">
          <span className="text-emerald-400 font-bold text-xs tracking-tight shrink-0">
            R$ {Number(product.price).toFixed(2).replace('.', ',')}
          </span>

          {!isTopTen && (hasViews || hasFire) && (
            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] sm:text-xs shrink-0 select-none">
              {hasViews && (
                <span className="flex items-center gap-0.5 leading-none">
                  <Eye className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span>{formatViewsCount(displayViews)}</span>
                </span>
              )}
              {hasFire && (
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
              )}
            </div>
          )}
        </div>
        
        {showButtons && (
          buttonVariant === "details" ? (
            <div className="w-full">
              <Link
                href={`/miniapp/${storeSlug}/product/${product.slug}`}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] sm:text-[11px] font-bold py-1 px-2.5 rounded-lg text-center transition-all flex items-center justify-center gap-0.5 shadow-sm active:scale-95"
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

export const ProductCard = React.memo(ProductCardBase);
