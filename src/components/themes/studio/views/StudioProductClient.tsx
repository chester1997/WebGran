"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, Share2, Sparkles, Zap, Clock, PlayCircle, Play, Loader2 } from "lucide-react";
import { AddToCartButton } from "../components/AddToCartButton";
import { HorizontalCarousel } from "../components/HorizontalCarousel";
import { ProductCard } from "../components/ProductCard";
import { getProductBadge } from "@/lib/product-badge";
import { createCheckoutSession } from "@/app/miniapp/[slug]/cart/actions";
import { PixPaymentCard } from "@/components/payments/PixPaymentCard";

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
  accessId?: string | null;
  botUsername: string | null;
  recommendedProducts: Product[];
}

export function StudioProductClient({
  storeSlug,
  product,
  hasAccess,
  accessId,
  botUsername,
  recommendedProducts,
}: StudioProductClientProps) {
  const router = useRouter();
  const [isInMyList, setIsInMyList] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Product Videos state & client access state
  const [productVideos, setProductVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [clientHasAccess, setClientHasAccess] = useState(hasAccess);
  const [currentAccessId, setCurrentAccessId] = useState<string | null>(accessId || null);

  // Telegram Direct Access state
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Direct Checkout & Pix states
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pixState, setPixState] = useState<{
    orderId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
    amount: number;
  } | null>(null);
  const [isPaid, setIsPaid] = useState(false);

  // Storage key for Favorites
  const favoritesKey = `webgran_favorites_${storeSlug}`;

  useEffect(() => {
    setClientHasAccess(hasAccess);
  }, [hasAccess]);

  useEffect(() => {
    setCurrentAccessId(accessId || null);
  }, [accessId]);

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

  const fetchVideos = useCallback(() => {
    if (!clientHasAccess) return;
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
        }
      })
      .catch((err) => {
        console.warn("[StudioProductClient] Failed to load product videos:", err);
      })
      .finally(() => {
        setLoadingVideos(false);
      });
  }, [clientHasAccess, product.id, storeSlug]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Poll Order Status when PIX is active for direct purchase
  useEffect(() => {
    if (!pixState?.orderId || clientHasAccess) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${pixState.orderId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid") {
            setClientHasAccess(true);
            setIsPaid(true);
            setPixState(null);
            if (data.accesses?.[0]?.id) {
              setCurrentAccessId(data.accesses[0].id);
            }
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Error polling order status:", err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pixState?.orderId, clientHasAccess, storeSlug]);

  const handleOpenTelegramAccess = async () => {
    if (!currentAccessId) {
      router.push(`/miniapp/${storeSlug}/accesses`);
      return;
    }

    try {
      setTelegramLoading(true);
      setTelegramError(null);

      const res = await fetch("/api/telegram/access/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessId: currentAccessId, storeSlug }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setTelegramError(data.error || data.message || "Não foi possível abrir o acesso no momento.");
        return;
      }

      if (data.destinationUrl) {
        openLink(data.destinationUrl);
      } else {
        setTelegramError("Link de acesso indisponível.");
      }
    } catch (err) {
      console.error("[StudioProductClient] Open Telegram Access error:", err);
      setTelegramError("Erro de conexão ao abrir o Telegram.");
    } finally {
      setTelegramLoading(false);
    }
  };

  const openLink = (url: string) => {
    if (typeof window !== "undefined") {
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp && typeof tgWebApp.openTelegramLink === "function" && url.includes("t.me")) {
        tgWebApp.openTelegramLink(url);
      } else if (tgWebApp && typeof tgWebApp.openLink === "function") {
        tgWebApp.openLink(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleDirectBuy = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await createCheckoutSession(
        storeSlug,
        [{ id: product.id, quantity: 1 }]
      );

      if (result.success) {
        if (result.pix) {
          setPixState({
            orderId: result.orderId,
            qrCode: result.pix.qrCode,
            qrCodeBase64: result.pix.qrCodeBase64,
            expiresAt: result.pix.expiresAt,
            amount: Number(product.price),
          });
        } else if (result.isDemoPaid) {
          setClientHasAccess(true);
          setIsPaid(true);
        } else {
          router.push(`/miniapp/${storeSlug}/accesses`);
        }
      } else {
        setErrorMessage(result.error || "Não foi possível gerar o pagamento no momento.");
      }
    } catch (err: any) {
      console.error("[StudioProductClient] Checkout error:", err);
      setErrorMessage("Erro de conexão. Tente novamente em alguns instantes.");
    } finally {
      setIsProcessing(false);
    }
  };

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

        {/* PRIMARY ACTION AREA (BUY / PIX / ACCESS) */}
        <div className="pt-1 space-y-3">
          {clientHasAccess ? (
            <Link
              href={`/miniapp/${storeSlug}/accesses`}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all text-sm active:scale-95"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Acesso Liberado</span>
            </Link>
          ) : pixState ? (
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl space-y-4">
              <PixPaymentCard
                pixCode={pixState.qrCode}
                qrCodeBase64={pixState.qrCodeBase64}
                amount={pixState.amount}
                orderId={pixState.orderId}
                status="pending"
                onBack={() => setPixState(null)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                  {errorMessage}
                </div>
              )}
              <button
                type="button"
                onClick={handleDirectBuy}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-red-600/30 transition-all text-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Gerando pagamento...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" />
                    <span>Comprar agora por R$ {Number(product.price || 0).toFixed(2).replace('.', ',')}</span>
                  </>
                )}
              </button>
            </div>
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

        {/* VÍDEOS / ENTREGA DA COMPRA SECTION */}
        {clientHasAccess ? (
          <div className="pt-4 border-t border-zinc-300/60 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-red-500 fill-red-500/20" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                {product.deliveryType === "product_video" ? "VÍDEOS DA SUA COMPRA" : "SUA ENTREGA"}
              </h3>
            </div>

            {product.deliveryType === "product_video" ? (
              loadingVideos ? (
                <div className="p-4 flex items-center justify-center text-xs text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Carregando vídeos...
                </div>
              ) : productVideos.length > 0 ? (
                /* ESTADO C — COMPROU / CONTEÚDO DISPONÍVEL */
                <div className="space-y-2.5">
                  {productVideos.map((vid, idx) => {
                    const isCompleted = vid.progress?.completed;
                    const posSecs = vid.progress?.positionSeconds || 0;
                    const hasStarted = posSecs > 0;

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
                /* ESTADO B — COMPROU / CONTEÚDO EM PREPARAÇÃO */
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5">
                  <div className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span>⚡</span>
                    <span>Conteúdo em preparação</span>
                  </div>
                  <p className="text-[12px] text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
                    Os vídeos desta entrega estão sendo preparados pelo vendedor e estarão disponíveis em breve.
                  </p>
                </div>
              )
            ) : (
              /* COMPROU - OUTROS TIPOS DE ENTREGA (Telegram / External) */
              <div className="p-4 rounded-2xl bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/10 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Acesso Confirmado</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                    ● Ativo
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Seu acesso foi liberado com sucesso. Clique no botão abaixo para entrar diretamente no seu conteúdo.
                </p>

                {telegramError && (
                  <p className="text-xs text-red-400 font-medium bg-red-950/60 p-2.5 rounded-lg border border-red-800/40">
                    {telegramError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleOpenTelegramAccess}
                  disabled={telegramLoading}
                  className="w-full bg-[#229ED9] hover:bg-[#1a8bc0] active:scale-95 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  {telegramLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Obtendo acesso...</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.09 13.843l-2.963-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.832.916h.029z"/>
                      </svg>
                      <span>
                        {product.deliveryType === "external" ? "Acessar Conteúdo" : "Entrar no Grupo Telegram"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ESTADO A — NÃO COMPROU (INFORMAÇÃO SOBRE A ENTREGA REAL DO PRODUTO) */
          <div className="pt-4 border-t border-zinc-300/60 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-red-500 fill-red-500/20" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                ENTREGA DO PRODUTO
              </h3>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-center space-y-1.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {product.deliveryType === "product_video"
                  ? "🎬 Após a confirmação do pagamento, os vídeos deste produto serão liberados para você assistir diretamente nesta Mini App."
                  : product.deliveryType === "telegram" || product.deliveryType === "TELEGRAM_CHAT"
                  ? "📲 Após a confirmação do pagamento, seu convite de acesso ao canal/grupo será enviado diretamente pelo Telegram."
                  : product.deliveryType === "external"
                  ? "🔗 Após a confirmação do pagamento, o link de acesso ao conteúdo será liberado pelo Telegram."
                  : "⚡ Após a confirmação do pagamento, seu acesso será liberado automaticamente."}
              </p>
            </div>
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
          <div className="pt-4 border-t border-zinc-300/60 dark:border-white/10 space-y-3 pb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                Recomendados para você
              </h3>
            </div>

            <HorizontalCarousel
              indicatorType="NONE"
              trackClassName="pt-1 pb-2"
            >
              {recommendedProducts.map((recProd) => (
                <div key={recProd.id} className="snap-start shrink-0 flex">
                  <ProductCard
                    storeSlug={storeSlug}
                    product={recProd}
                    showButtons={false}
                    className="w-[135px] sm:w-[155px] md:w-[175px]"
                  />
                </div>
              ))}
            </HorizontalCarousel>
          </div>
        )}
      </div>
    </div>
  );
}


