"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ProductCoverImage } from "../studio/components/ProductCoverImage";

/** Produto mínimo usado pelas seções do Tema XDs */
export interface XdsProduct {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  bannerUrl?: string | null;
  price: string | number;
}

const money = (v: string | number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
const href = (storeSlug: string, p: XdsProduct) => `/miniapp/${storeSlug}/product/${p.slug}`;

export function XdsSectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-4 mb-2.5 text-[19px] font-semibold tracking-tight text-white">{children}</h2>;
}

/* ------------------------------------------------------------------ */
/* Fileira de capas: cards pequenos (Minha lista) ou grandes (Adicionados) */
/* ------------------------------------------------------------------ */
export function XdsPosterRow({ storeSlug, title, products, size = "small" }: { storeSlug: string; title: string; products: XdsProduct[]; size?: "small" | "large" }) {
  if (products.length === 0) return null;
  const big = size === "large";
  return (
    <section className="w-full max-w-[560px] mx-auto">
      <XdsSectionTitle>{title}</XdsSectionTitle>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 snap-x snap-mandatory scroll-px-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={href(storeSlug, p)}
            className={`snap-start shrink-0 block rounded-[8px] overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06] active:scale-[0.98] transition-transform ${
              big ? "w-[58%] max-w-[300px] aspect-[3/4]" : "w-[31%] max-w-[160px] aspect-[2/3]"
            }`}
          >
            <ProductCoverImage src={p.coverUrl} alt={p.title} aspectRatioClass="" className="w-full h-full object-cover" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Destaque: cards grandes que passam sozinhos, com os vizinhos aparecendo */
/* ------------------------------------------------------------------ */
export function XdsFeatured({ storeSlug, products, seconds = 5 }: { storeSlug: string; products: XdsProduct[]; seconds?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const goTo = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: "smooth" });
  }, []);

  // Acompanha qual card está no centro
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const card = c as HTMLElement;
        const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setIndex(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Troca automática
  useEffect(() => {
    if (products.length < 2) return;
    const ms = Math.min(30, Math.max(2, seconds)) * 1000;
    const t = setInterval(() => {
      if (paused.current || document.hidden) return;
      goTo((index + 1) % products.length);
    }, ms);
    return () => clearInterval(t);
  }, [index, products.length, seconds, goTo]);

  if (products.length === 0) return null;

  const pause = () => {
    paused.current = true;
  };
  const resume = () => {
    window.setTimeout(() => {
      paused.current = false;
    }, 2500);
  };

  return (
    <section className="w-full max-w-[560px] mx-auto">
      <div
        ref={ref}
        onTouchStart={pause}
        onTouchEnd={resume}
        onMouseEnter={pause}
        onMouseLeave={resume}
        className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory px-[28px] scroll-px-[28px]"
      >
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={href(storeSlug, p)}
            aria-label={p.title}
            className="relative snap-center shrink-0 w-[calc(100%-56px)] aspect-[4/5] rounded-[10px] overflow-hidden bg-zinc-900 ring-1 ring-white/[0.08]"
          >
            <ProductCoverImage src={p.coverUrl || p.bannerUrl} alt={p.title} aspectRatioClass="" priority={i === 0} className="w-full h-full object-cover" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4 text-center">
              <span className="block text-[19px] font-extrabold uppercase tracking-wide text-white leading-tight line-clamp-2 drop-shadow">{p.title}</span>
              <span className="block mt-1.5 text-[13px] text-zinc-200">{money(p.price)}</span>
            </span>
          </Link>
        ))}
      </div>
      {products.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5" aria-hidden="true">
          {products.map((p, i) => (
            <span key={p.id} className={`h-1 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1 bg-white/30"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Coleção: imagem de fundo, nome, subtítulo, "Detalhes" e os produtos     */
/* ------------------------------------------------------------------ */
export function XdsCollection({ storeSlug, title, subtitle, coverUrl, products }: { storeSlug: string; title: string; subtitle: string | null; coverUrl: string | null; products: XdsProduct[] }) {
  const [open, setOpen] = useState(false);
  if (products.length === 0) return null;
  const bg = coverUrl || products[0]?.bannerUrl || products[0]?.coverUrl || null;

  return (
    <section className="w-full max-w-[560px] mx-auto">
      <div className="relative">
        <div className="relative h-[250px] overflow-hidden">
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-[#0d0e10]" />
          <div className="relative h-full flex flex-col items-center justify-start pt-12 px-6 text-center">
            <p className="text-[26px] font-extrabold uppercase leading-[1.05] tracking-tight text-white drop-shadow-lg">{title}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-200">{subtitle || "Coleção"}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 h-10 px-6 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-[13px] font-semibold uppercase tracking-[0.15em] text-white"
            >
              Detalhes
            </button>
          </div>
        </div>
        <div className="relative -mt-16 flex gap-2.5 overflow-x-auto no-scrollbar px-4 snap-x snap-mandatory scroll-px-4">
          {products.map((p) => (
            <Link key={p.id} href={href(storeSlug, p)} className="snap-start shrink-0 w-[36%] max-w-[180px] aspect-[2/3] rounded-[8px] overflow-hidden bg-zinc-900 ring-1 ring-white/[0.08] shadow-xl">
              <ProductCoverImage src={p.coverUrl} alt={p.title} aspectRatioClass="" className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-[560px] max-h-[85dvh] overflow-y-auto rounded-t-[16px] bg-[#141518] border-t border-white/10 p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-start gap-3 mb-4">
              <div className="mr-auto min-w-0">
                <p className="text-[18px] font-bold text-white leading-tight">{title}</p>
                <p className="text-[12px] text-zinc-400 mt-0.5">
                  {subtitle || "Coleção"} · {products.length} {products.length === 1 ? "título" : "títulos"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {products.map((p) => (
                <Link key={p.id} href={href(storeSlug, p)} className="block">
                  <span className="block aspect-[2/3] rounded-[8px] overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06]">
                    <ProductCoverImage src={p.coverUrl} alt={p.title} aspectRatioClass="" className="w-full h-full object-cover" />
                  </span>
                  <span className="block mt-1.5 text-[11.5px] font-medium text-zinc-200 leading-tight line-clamp-2">{p.title}</span>
                  <span className="block text-[11px] text-zinc-500">{money(p.price)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top 15: cards maiores com o emblema do número no canto da capa         */
/* ------------------------------------------------------------------ */
export function XdsTop15({ storeSlug, title, products, badgeColor }: { storeSlug: string; title: string; products: XdsProduct[]; badgeColor: string }) {
  if (products.length === 0) return null;
  const color = /^#[0-9a-f]{6}$/i.test(badgeColor) ? badgeColor : "#3B82F6";
  return (
    <section className="w-full max-w-[560px] mx-auto">
      <XdsSectionTitle>{title}</XdsSectionTitle>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 snap-x snap-mandatory scroll-px-4">
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={href(storeSlug, p)}
            className="relative snap-start shrink-0 w-[62%] max-w-[300px] aspect-[2/3] rounded-[10px] overflow-hidden bg-zinc-900 ring-1 ring-white/[0.08]"
          >
            <ProductCoverImage src={p.coverUrl} alt={p.title} aspectRatioClass="" className="w-full h-full object-cover" />
            {/* Emblema: um quarto de círculo no canto, acompanhando o arredondamento da capa */}
            <span
              aria-hidden="true"
              className="absolute top-0 left-0 w-[30%] aspect-square rounded-br-full flex items-start justify-start pl-[9%] pt-[5%] shadow-[2px_2px_12px_rgba(0,0,0,0.35)]"
              style={{ background: `color-mix(in srgb, ${color} 82%, #000)` }}
            >
              <span className="text-[34px] font-black leading-none" style={{ color: `color-mix(in srgb, ${color} 35%, #fff)` }}>
                {i + 1}
              </span>
            </span>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3">
              <span className="block text-[14px] font-bold text-white leading-tight line-clamp-2">{p.title}</span>
              <span className="block mt-1 text-[12px] text-zinc-300">{money(p.price)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
