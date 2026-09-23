"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, Share2, Sparkles, Zap, Clock } from "lucide-react";
import { AddToCartButton } from "../components/AddToCartButton";
import { HorizontalCarousel } from "../components/HorizontalCarousel";
import { ProductCard } from "../components/ProductCard";
import { getProductBadge } from "@/lib/product-badge";

interface Product {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  duration?: string | null;
  badge?: string | null;
  status: string;
  deliveryType?: string | null;
  category?: { id: string; name: string; slug: string } | null;
}

interface StudioProductClientProps {
  storeSlug: string;
  product: Product;
  hasAccess: boolean;
  botUsername: string | null;
  recommendedProducts: Product[];
}

export function StudioProductClient({
  storeSlug,
  product,
  hasAccess,
  botUsername,
  recommendedProducts,
}: StudioProductClientProps) {
  const router = useRouter();
  const [isInMyList, setIsInMyList] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Storage key for My List
  const myListKey = `webgran_mylist_${storeSlug}_${product.id}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(myListKey);
      if (saved === "true") {
        setIsInMyList(true);
      }
    } catch {
      // localStorage unavailable or restricted
    }
  }, [myListKey]);

  const toggleMyList = () => {
    const nextState = !isInMyList;
    setIsInMyList(nextState);
    try {
      if (nextState) {
        localStorage.setItem(myListKey, "true");
      } else {
        localStorage.removeItem(myListKey);
      }
    } catch {
      // localStorage restricted
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();

    // Construct Telegram deep link for product
    let shareUrl = "";
    if (botUsername) {
      shareUrl = `https://t.me/${botUsername}?startapp=p_${product.slug}`;
    } else {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      shareUrl = `${origin}/miniapp/${storeSlug}/product/${product.slug}`;
    }

    const shareText = `Confira ${product.title} na loja!`;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

    const tgWebApp = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;

    if (tgWebApp && typeof tgWebApp.openTelegramLink === "function") {
      tgWebApp.openTelegramLink(tgShareUrl);
    } else if (tgWebApp && typeof tgWebApp.openLink === "function") {
      tgWebApp.openLink(tgShareUrl);
    } else {
      // Fallback for web browsers
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }).catch(() => {});
      }
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/miniapp/${storeSlug}`);
    }
  };

  const heroImage = product.bannerUrl || product.coverUrl || "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop";
  const posterImage = product.coverUrl || product.bannerUrl || heroImage;
  const rawDescription = (product.description || product.shortDescription || "").trim();
  const isLongDescription = rawDescription.length > 200;

  // Format Duration string
  let durationBadge: string | null = null;
  if (product.duration) {
    const dur = product.duration.toLowerCase();
    if (dur === "lifetime") durationBadge = "Acesso Vitalício";
    else if (dur === "monthly") durationBadge = "30 dias";
    else if (dur === "weekly") durationBadge = "7 dias";
    else if (dur === "annual") durationBadge = "365 dias";
    else durationBadge = product.duration;
  }

  return (
    <div className="w-full min-h-screen bg-transparent text-white pb-28">
      {/* 1. TOP BANNER / BACKDROP AREA */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[2.2/1] max-h-[360px] bg-zinc-950 overflow-hidden">
        <img
          src={heroImage}
          alt={product.title}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
        />
        {/* Smooth Gradient Fade to Page Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-[#141416]/40 to-black/50 pointer-events-none" />

        {/* Back Button */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar"
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all border border-white/10 active:scale-95 cursor-pointer shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 2. MAIN PAGE CONTAINER */}
      <div className="px-4 max-w-lg mx-auto relative z-10 space-y-4">
        {/* POSTER THUMB & TITLE / METADATA HEADER (OVERLAPPING BANNER) */}
        <div className="-mt-14 sm:-mt-16 flex gap-4 items-end">
          {/* Small Vertical Poster Thumbnail */}
          <div className="w-24 sm:w-28 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden bg-zinc-900 border border-white/15 shadow-2xl">
            <img
              src={posterImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title & Metadata on the right */}
          <div className="flex-1 space-y-1.5 pb-1">
            {/* Category & Duration Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(() => {
                const badgeConfig = getProductBadge(product.badge);
                if (!badgeConfig) return null;
                return (
                  <span className={badgeConfig.className}>
                    {badgeConfig.label}
                  </span>
                );
              })()}
              {product.category?.name && (
                <span className="px-2.5 py-1 rounded-md bg-white/10 text-zinc-300 font-semibold border border-white/5 uppercase tracking-wider">
                  {product.category.name}
                </span>
              )}
              {durationBadge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/10 text-zinc-300 font-semibold border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  {durationBadge}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug drop-shadow-sm">
              {product.title}
            </h1>
          </div>
        </div>

        {/* Delivery Type Badge if available */}
        {product.deliveryType && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <span>Entrega Telegram</span>
          </div>
        )}

        {/* PRIMARY ACTION BUTTON (BUY VS ACCESS) */}
        <div className="pt-1 space-y-3">
          {hasAccess ? (
            <Link
              href={`/miniapp/${storeSlug}/accesses`}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all text-sm active:scale-95"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>⚡ Acessar conteúdo</span>
            </Link>
          ) : (
            <AddToCartButton 
              storeSlug={storeSlug}
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                price: Number(product.price),
                coverUrl: product.coverUrl,
                storeId: (product as any).storeId,
                compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined
              }}
              variant="full"
            />
          )}

          {/* ACTIONS ROW (MINHA LISTA & COMPARTILHAR) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={toggleMyList}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-xs font-semibold active:scale-95 cursor-pointer ${
                isInMyList
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-[#222226] text-zinc-300 hover:text-white border-white/10 hover:bg-white/10"
              }`}
            >
              {isInMyList ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>✓ Na Minha Lista</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-zinc-300" />
                  <span>+ Minha Lista</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#222226] text-zinc-300 hover:text-white border border-white/10 hover:bg-white/10 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-zinc-300" />
              <span>{copied ? "Link Copiado!" : "Compartilhar"}</span>
            </button>
          </div>
        </div>

        {/* DESCRIPTION SECTION */}
        {rawDescription && (
          <div className="pt-3 border-t border-white/10 space-y-2">
            <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
              Descrição
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-line">
              {isLongDescription && !isDescriptionExpanded
                ? `${rawDescription.slice(0, 200)}...`
                : rawDescription}
            </p>
            {isLongDescription && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer underline"
              >
                {isDescriptionExpanded ? "Mostrar menos" : "Ler mais"}
              </button>
            )}
          </div>
        )}

        {/* RECOMMENDED PRODUCTS CAROUSEL */}
        {recommendedProducts.length > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                Recomendados para você
              </h3>
            </div>

            <HorizontalCarousel
              indicatorType="NONE"
              trackClassName="pt-1 pb-4"
            >
              {recommendedProducts.map((recProd) => (
                <div key={recProd.id} className="snap-start shrink-0">
                  <ProductCard storeSlug={storeSlug} product={recProd} showButtons={false} />
                </div>
              ))}
            </HorizontalCarousel>
          </div>
        )}
      </div>
    </div>
  );
}
