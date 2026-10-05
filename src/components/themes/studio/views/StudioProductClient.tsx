"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, Share2, Sparkles, Zap, Clock, PlayCircle, Play, Loader2 } from "lucide-react";
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

function formatSeconds(secs: number): string {
  if (!secs || isNaN(secs) || secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  // Product Videos state for buyers with access
  const [productVideos, setProductVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [clientHasAccess, setClientHasAccess] = useState(hasAccess);

  // Storage key for Favorites
  const favoritesKey = `webgran_favorites_${storeSlug}`;

  useEffect(() => {
    setClientHasAccess(hasAccess);
  }, [hasAccess]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(favoritesKey);
      if (stored) {
        const list: any[] = JSON.parse(stored);
        if (Array.isArray(list)) {
          setIsInMyList(list.some((item) => item.id === product.id));
        }
      }
    } catch {
      // localStorage unavailable or restricted
    }
  }, [favoritesKey, product.id]);

  useEffect(() => {
    setLoadingVideos(true);
    fetch(`/api/miniapp/products/${product.id}/videos?storeSlug=${encodeURIComponent(storeSlug)}`, {
      headers: {
        "x-store-slug": storeSlug,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.videos)) {
          setProductVideos(data.videos);
          setClientHasAccess(true);
        }
      })
      .catch((err) => {
        console.warn("[StudioProductClient] Failed to load product videos:", err);
      })
      .finally(() => {
        setLoadingVideos(false);
      });
  }, [product.id, storeSlug]);

  const toggleMyList = () => {
    try {
      const stored = localStorage.getItem(favoritesKey);
      let list: any[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];

      const exists = list.some((item) => item.id === product.id);

      if (exists) {
        list = list.filter((item) => item.id !== product.id);
        setIsInMyList(false);
      } else {
        list.push({
          id: product.id,
          slug: product.slug,
          title: product.title,
          price: product.price,
          coverUrl: product.coverUrl,
          badge: product.badge,
        });
        setIsInMyList(true);
      }
      localStorage.setItem(favoritesKey, JSON.stringify(list));
    } catch {
      // localStorage restricted
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();

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
    <div className="w-full min-h-screen bg-transparent text-zinc-900 dark:text-white pb-28">
      {/* 1. TOP BANNER / BACKDROP AREA */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[2.2/1] max-h-[360px] bg-zinc-950 overflow-hidden">
        <img
          src={heroImage}
          alt={product.title}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f4f5f7] via-[#f4f5f7]/40 to-black/30 dark:from-[#141416] dark:via-[#141416]/40 dark:to-black/50 pointer-events-none" />

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
        {/* POSTER THUMB & TITLE / METADATA HEADER */}
        <div className="-mt-14 sm:-mt-16 flex gap-4 items-end">
          <div className="w-24 sm:w-28 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-300/50 dark:border-white/15 shadow-2xl">
            <img
              src={posterImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-1.5 pb-1 min-w-0">
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
                <span className="px-2.5 py-1 rounded-md bg-zinc-200/90 dark:bg-white/10 text-zinc-800 dark:text-zinc-300 font-semibold border border-zinc-300/60 dark:border-white/5 uppercase tracking-wider">
                  {product.category.name}
                </span>
              )}
              {durationBadge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-200/90 dark:bg-white/10 text-zinc-800 dark:text-zinc-300 font-semibold border border-zinc-300/60 dark:border-white/5">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  {durationBadge}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-snug drop-shadow-sm">
              {product.title}
            </h1>
          </div>
        </div>

        {/* Delivery Type Badge if available */}
        {product.deliveryType && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            <span>{product.deliveryType === "product_video" ? "Vídeo do Produto" : "Entrega Telegram"}</span>
          </div>
        )}

        {/* PRIMARY ACTION BUTTON (BUY VS ACCESS) */}
        <div className="pt-1 space-y-3">
          {clientHasAccess ? (
            <Link
              href={`/miniapp/${storeSlug}/accesses`}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all text-sm active:scale-95"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>⚡ Acesso Liberado</span>
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

          {/* ACTIONS ROW (FAVORITOS & COMPARTILHAR) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={toggleMyList}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-xs font-semibold active:scale-95 cursor-pointer shadow-sm ${
                isInMyList
                  ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                  : "bg-zinc-200/90 hover:bg-zinc-300/90 dark:bg-[#222226] text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white border-zinc-300 dark:border-white/10"
              }`}
            >
              {isInMyList ? (
                <>
                  <Check className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span>Nos Favoritos</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <span>Favoritos</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-200/90 hover:bg-zinc-300/90 dark:bg-[#222226] text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-white/10 transition-all text-xs font-semibold active:scale-95 cursor-pointer shadow-sm"
            >
              <Share2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>{copied ? "Link Copiado!" : "Compartilhar"}</span>
            </button>
          </div>
        </div>

        {/* VÍDEOS DA ENTREGA SECTION */}
        {(clientHasAccess || product.deliveryType === "product_video" || productVideos.length > 0) && (
          <div className="pt-4 border-t border-zinc-300/60 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-red-500 fill-red-500/20" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                VÍDEOS DA SUA COMPRA
              </h3>
            </div>

            {loadingVideos ? (
              <div className="p-4 flex items-center justify-center text-xs text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Carregando vídeos...
              </div>
            ) : productVideos.length > 0 ? (
              <div className="space-y-2.5">
                {productVideos.map((vid, idx) => {
                  const isCompleted = vid.progress?.completed;
                  const posSecs = vid.progress?.positionSeconds || 0;
                  const hasStarted = posSecs > 0;
                  const progressPercent = vid.progress?.progressPercent || 0;

                  return (
                    <Link
                      key={vid.id}
                      href={`/miniapp/${storeSlug}/video/${vid.id}?productId=${product.id}`}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900/90 dark:hover:bg-zinc-800/90 border border-zinc-200 dark:border-white/10 transition-all group cursor-pointer"
                    >
                      {/* Thumbnail / Icon */}
                      <div className="relative w-16 aspect-video shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                        {vid.thumbnailUrl ? (
                          <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                        ) : (
                          <Play className="w-5 h-5 text-white/70" />
                        )}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white drop-shadow" />
                        </div>
                      </div>

                      {/* Title & Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Episódio {String(idx + 1).padStart(2, "0")}
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-red-500 transition-colors">
                          {vid.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {vid.durationSeconds > 0 && (
                            <span className="font-mono">{formatSeconds(vid.durationSeconds)}</span>
                          )}
                          {isCompleted ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Concluído
                            </span>
                          ) : hasStarted ? (
                            <span className="text-amber-500 font-semibold">
                              Progresso: {formatSeconds(posSecs)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Não iniciado</span>
                          )}
                        </div>
                      </div>

                      <span className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shrink-0 flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {hasStarted && !isCompleted ? "CONTINUAR" : "ASSISTIR"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5">
                <div className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <span>⚡</span>
                  <span>Conteúdo em preparação</span>
                </div>
                <p className="text-[12px] text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
                  Os vídeos desta entrega estão sendo preparados pelo vendedor e estarão disponíveis em breve.
                </p>
              </div>
            )}
          </div>
        )}

        {/* DESCRIPTION SECTION */}
        {rawDescription && (
          <div className="pt-3 border-t border-zinc-300/60 dark:border-white/10 space-y-2">
            <h3 className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">
              Descrição
            </h3>
            <p className="text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed break-words whitespace-pre-line">
              {isLongDescription && !isDescriptionExpanded
                ? `${rawDescription.slice(0, 200)}...`
                : rawDescription}
            </p>
            {isLongDescription && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer"
              >
                {isDescriptionExpanded ? "Mostrar menos" : "Ler mais"}
              </button>
            )}
          </div>
        )}

        {/* RECOMMENDED PRODUCTS CAROUSEL */}
        {recommendedProducts.length > 0 && (
          <div className="pt-4 border-t border-zinc-300/60 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
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

