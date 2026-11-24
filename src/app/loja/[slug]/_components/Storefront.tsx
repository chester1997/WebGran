"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Play, Plus, Sparkles } from "lucide-react";
import { useCart } from "./cart";
import { brl, DURATION_LABEL } from "./ui";

export interface CardItem {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  bannerUrl: string | null;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  duration: string | null;
  videoCount: number;
  isNew: boolean;
}

interface Row {
  key: string;
  kind: string;
  title: string;
  items: CardItem[];
  progress?: Record<string, { percent: number; label: string }>;
}

export function Storefront({
  slug,
  storeName,
  notReady,
  hero,
  rows,
  promo,
}: {
  slug: string;
  storeName: string;
  notReady: boolean;
  hero: CardItem[];
  rows: Row[];
  promo: { title: string; tiers: { minQuantity: number; price: number }[] } | null;
}) {
  if (!hero.length && !rows.length) {
    return (
      <div className="pt-32 pb-24 px-6 text-center">
        <h1 className="text-[30px] font-black tracking-tight">{storeName}</h1>
        <p className="mt-2 text-[15px] text-zinc-400">{notReady ? "A loja está sendo preparada." : "Em breve, novos títulos por aqui."}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-clip">
      {hero.length > 0 && <Hero slug={slug} items={hero} />}
      <div className={`relative z-10 space-y-9 sm:space-y-11 pb-10 ${hero.length ? "-mt-14 sm:-mt-24" : "pt-24"}`}>
        {rows.map((r, i) => (
          <div key={r.key}>
            {r.kind === "top15" ? <TopRow slug={slug} row={r} /> : r.kind === "continue" ? <ContinueRow slug={slug} row={r} /> : <PosterRow slug={slug} row={r} />}
            {promo && i === Math.min(1, rows.length - 1) && <PromoStrip promo={promo} />}
          </div>
        ))}
        {promo && rows.length === 0 && <PromoStrip promo={promo} />}
      </div>
    </div>
  );
}

/* ------------------------------ Banner ------------------------------ */

function Hero({ slug, items }: { slug: string; items: CardItem[] }) {
  const [i, setI] = useState(0);
  const { add, lines } = useCart();
  const router = useRouter();
  const p = items[i];
  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => window.clearInterval(t);
  }, [items.length]);

  const wide = p.bannerUrl;
  return (
    <section className="relative h-[86svh] min-h-[540px] max-h-[820px] overflow-hidden" aria-roledescription="carrossel" aria-label="Destaques">
      {items.map((it, k) => (
        <div key={it.id} aria-hidden={k !== i} className={`absolute inset-0 transition-opacity duration-1000 ${k === i ? "opacity-100" : "opacity-0"}`}>
          {it.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_25%]" />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.coverUrl && <img src={it.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-top brightness-[0.8] md:object-center md:scale-125 md:blur-[32px] md:brightness-[0.5]" />}
              {it.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.coverUrl} alt="" className="hidden md:block absolute right-[7%] top-1/2 -translate-y-[54%] h-[70%] aspect-[2/3] object-cover rounded-[18px] shadow-[0_40px_90px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/10" />
              )}
            </>
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#07080a_3%,rgba(7,8,10,0.82)_34%,rgba(7,8,10,0.08)_72%),linear-gradient(0deg,#07080a_2%,rgba(7,8,10,0)_42%)]" />

      <div className="absolute z-10 left-4 right-4 sm:left-8 lg:left-10 bottom-28 sm:bottom-44 max-w-[600px]">
        <p className="flex items-center gap-2 text-[11.5px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-300">
          <span className="w-[22px] h-[22px] rounded-[6px] bg-[#3b82f6] text-white flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </span>
          Destaque
        </p>
        <h1 key={p.id} className="mt-3 mb-4 text-[34px] sm:text-[52px] lg:text-[60px] leading-[0.98] font-black tracking-[-0.035em] [text-wrap:balance] drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {p.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-zinc-200 mb-3">
          {i === 0 && <span className="font-bold text-[#7fb0ff]">Top 1 da semana</span>}
          {p.videoCount > 0 && <span>{p.videoCount} {p.videoCount === 1 ? "vídeo" : "episódios"}</span>}
          <span className="h-[22px] px-2 rounded-[6px] border border-white/25 text-[11.5px] inline-flex items-center">{DURATION_LABEL[p.duration || "lifetime"] || "Vitalício"}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && <span className="text-zinc-400 line-through">{brl(p.compareAtPrice)}</span>}
        </div>
        {p.shortDescription && <p className="text-[14.5px] sm:text-[16px] leading-relaxed text-zinc-300 mb-6 line-clamp-3 max-w-[520px]">{p.shortDescription}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (!lines.some((l) => l.id === p.id)) add(p.id);
              router.push(`/loja/${slug}/carrinho`);
            }}
            className="inline-flex items-center gap-2.5 h-12 sm:h-[52px] px-6 sm:px-7 rounded-[12px] bg-white text-black text-[15px] sm:text-[16px] font-bold hover:bg-zinc-200 transition-colors"
          >
            <Play className="w-5 h-5 fill-black" /> Comprar · {brl(p.price)}
          </button>
          <Link href={`/loja/${slug}/produto/${p.slug}`} className="inline-flex items-center gap-2.5 h-12 sm:h-[52px] px-6 rounded-[12px] bg-zinc-500/40 hover:bg-zinc-500/55 backdrop-blur text-[15px] sm:text-[16px] font-bold transition-colors">
            <Info className="w-5 h-5" /> Mais detalhes
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute z-10 left-4 sm:left-8 lg:left-10 bottom-[84px] sm:bottom-[136px] flex gap-1.5" role="tablist">
          {items.map((it, k) => (
            <button key={it.id} type="button" role="tab" aria-selected={k === i} aria-label={`Destaque ${k + 1}`} onClick={() => setI(k)} className={`h-1 rounded-full transition-all ${k === i ? "w-9 bg-white" : "w-5 bg-white/30 hover:bg-white/60"}`} />
          ))}
        </div>
      )}
      {!wide && <span className="sr-only">{p.title}</span>}
    </section>
  );
}

/* ------------------------------ Fileiras ------------------------------ */

function Track({ title, children, link }: { title: string; children: React.ReactNode; link?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="group/row">
      <h2 className="flex items-baseline gap-3 px-4 sm:px-8 lg:px-10 mb-1 text-[17px] sm:text-[20px] font-bold tracking-tight">
        {title}
        {link && <span className="text-[12.5px] font-semibold text-[#7fb0ff] opacity-0 group-hover/row:opacity-100 transition-opacity">{link}</span>}
      </h2>
      <div className="relative">
        <button type="button" aria-label="Voltar" onClick={() => scroll(-1)} className="hidden lg:flex absolute left-0 top-3 bottom-6 z-20 w-12 items-center justify-center bg-gradient-to-r from-[#07080a] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <div ref={ref} className="flex gap-2.5 overflow-x-auto scroll-smooth px-4 sm:px-8 lg:px-10 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x scroll-px-4 sm:scroll-px-8 lg:scroll-px-10">
          {children}
        </div>
        <button type="button" aria-label="Avançar" onClick={() => scroll(1)} className="hidden lg:flex absolute right-0 top-3 bottom-6 z-20 w-14 items-center justify-center bg-gradient-to-l from-[#07080a] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </section>
  );
}

function Poster({ slug, p, className = "w-[118px] sm:w-[160px] lg:w-[176px]" }: { slug: string; p: CardItem; className?: string }) {
  const { add } = useCart();
  return (
    <div className={`group/card relative shrink-0 snap-start aspect-[2/3] rounded-[10px] bg-[#15161a] ring-1 ring-white/[0.06] transition-[transform,box-shadow] duration-300 hover:scale-[1.07] hover:z-10 hover:shadow-[0_22px_40px_-12px_rgba(0,0,0,0.95)] hover:ring-2 hover:ring-[#3b82f6] ${className}`}>
      <Link href={`/loja/${slug}/produto/${p.slug}`} aria-label={p.title} className="absolute inset-0 rounded-[10px] overflow-hidden">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-[12px] font-semibold text-zinc-400">{p.title}</span>
        )}
        {p.isNew && <span className="absolute top-2 right-2 h-5 px-1.5 rounded-[5px] bg-white text-black text-[10px] font-black flex items-center">NOVO</span>}
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="absolute top-2 left-2 h-5 px-1.5 rounded-[5px] bg-[#3b82f6] text-[10px] font-bold flex items-center">-{Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>
        )}
        <span className="absolute inset-x-0 bottom-0 pt-10 px-2.5 pb-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity">
          <span className="block text-[12px] font-semibold leading-tight line-clamp-2 mb-1.5">{p.title}</span>
          <span className="block text-[12.5px] font-bold">{brl(p.price)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => add(p.id)}
        aria-label={`Adicionar ${p.title} ao carrinho`}
        className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function PosterRow({ slug, row }: { slug: string; row: Row }) {
  return (
    <Track title={row.title}>
      {row.items.map((p) => (
        <Poster key={p.id} slug={slug} p={p} />
      ))}
    </Track>
  );
}

function TopRow({ slug, row }: { slug: string; row: Row }) {
  return (
    <Track title={row.title}>
      {row.items.map((p, i) => (
        <div key={p.id} className="group/top relative shrink-0 snap-start flex items-end w-[172px] sm:w-[226px] lg:w-[252px] h-[176px] sm:h-[224px] lg:h-[248px]">
          <span
            aria-hidden="true"
            className={`absolute bottom-[-6px] select-none font-black leading-[0.78] tracking-[-0.08em] text-[#07080a] [-webkit-text-stroke:3px_#3f4654] sm:[-webkit-text-stroke:4px_#3f4654] group-hover/top:[-webkit-text-stroke-color:#3b82f6] transition-[-webkit-text-stroke-color] text-[150px] sm:text-[200px] lg:text-[220px] ${i >= 9 ? "-left-5 sm:-left-7" : "-left-1"}`}
          >
            {i + 1}
          </span>
          <span className="sr-only">{`Top ${i + 1}: `}</span>
          <Poster slug={slug} p={p} className="ml-auto w-[104px] sm:w-[138px] lg:w-[152px]" />
        </div>
      ))}
    </Track>
  );
}

function ContinueRow({ slug, row }: { slug: string; row: Row }) {
  return (
    <Track title={row.title}>
      {row.items.map((p) => {
        const pr = row.progress?.[p.id];
        return (
          <Link
            key={p.id}
            href={`/loja/${slug}/conta/produto/${p.id}`}
            className="group/c relative shrink-0 snap-start w-[250px] sm:w-[320px] aspect-video rounded-[12px] overflow-hidden bg-[#15161a] ring-1 ring-white/[0.07] hover:ring-2 hover:ring-[#3b82f6] transition-[box-shadow,transform] hover:scale-[1.03]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {(p.bannerUrl || p.coverUrl) && <img src={p.bannerUrl || p.coverUrl || ""} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_30%]" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
            <span className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 border border-white/40 flex items-center justify-center opacity-0 group-hover/c:opacity-100 transition-opacity">
              <Play className="w-5 h-5 fill-white" />
            </span>
            <span className="absolute left-3 right-3 bottom-3">
              <span className="block text-[13.5px] font-semibold truncate">{p.title}</span>
              {pr && <span className="block text-[11.5px] text-zinc-400 truncate mb-1.5">{pr.label}</span>}
              <span className="block h-1 rounded-full bg-white/20 overflow-hidden">
                <span className="block h-full bg-[#3b82f6]" style={{ width: `${Math.max(3, pr?.percent || 0)}%` }} />
              </span>
            </span>
          </Link>
        );
      })}
    </Track>
  );
}

function PromoStrip({ promo }: { promo: { title: string; tiers: { minQuantity: number; price: number }[] } }) {
  return (
    <div className="mx-4 sm:mx-8 lg:mx-10 mt-9 sm:mt-11 flex flex-wrap items-center gap-4 rounded-[16px] border border-[#3b82f6]/35 bg-[linear-gradient(100deg,rgba(59,130,246,0.22),rgba(59,130,246,0.05)_60%)] px-5 py-4">
      <div className="mr-auto">
        <p className="text-[16px] font-bold">{promo.title}</p>
        <p className="text-[13px] text-zinc-300">O desconto entra sozinho no carrinho.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {promo.tiers.map((t) => (
          <div key={t.minQuantity} className="rounded-[10px] bg-black/35 px-3 py-2 text-center">
            <b className="block text-[14.5px]">
              {t.minQuantity} por {brl(t.price)}
            </b>
            <span className="text-[11.5px] text-zinc-400">{brl(t.price / t.minQuantity)} cada</span>
          </div>
        ))}
      </div>
    </div>
  );
}
