"use client";

import { getProductBadge } from "@/lib/product-badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Info, Play, Sparkles } from "lucide-react";
import { SolarCartLarge2BoldDuotone } from "@/components/icons/solar/seller-icons";
import { useCart } from "./cart";
import { brl, DURATION_LABEL } from "./ui";

export interface ComboCard {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  normalPrice: number;
  savingsPercentage: number;
  items: { title: string; coverUrl: string | null }[];
}

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
  /** Badge do produto (mesma do Mini App): novo, dublado, legendado... */
  badge?: string | null;
  /** Imagem horizontal definida na Vitrine para os Destaques do topo. */
  heroUrl?: string | null;
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
  promoImage = null,
  topId = null,
  combos = [],
}: {
  combos?: ComboCard[];
  topId?: string | null;
  promoImage?: string | null;
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
  const covers = Array.from(new Map([...hero, ...rows.flatMap((r) => r.items)].filter((x) => x.coverUrl).map((x) => [x.id, x.coverUrl as string])).values()).slice(0, 5);
  return (
    <div className="overflow-x-clip">
      {hero.length > 0 && <Hero slug={slug} items={hero} topId={topId} />}
      <div className={`relative z-10 space-y-9 sm:space-y-11 pb-10 ${hero.length ? "-mt-14 sm:-mt-24" : "pt-24"}`}>
        {rows.map((r) =>
          r.kind === "combos" ? (
            promo || combos.length ? (
              <div key={r.key}>
                {promo && <PromoBanner slug={slug} promo={promo} image={promoImage} covers={covers} />}
                {combos.length > 0 && <ComboRow title={r.title} combos={combos} spaced={Boolean(promo)} />}
              </div>
            ) : null
          ) : (
            <div key={r.key}>{r.kind === "top15" ? <TopRow slug={slug} row={r} /> : r.kind === "continue" ? <ContinueRow slug={slug} row={r} /> : <PosterRow slug={slug} row={r} />}</div>
          )
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Banner ------------------------------ */

function Hero({ slug, items, topId }: { slug: string; items: CardItem[]; topId: string | null }) {
  const [i, setI] = useState(0);
  const { add, lines } = useCart();
  const router = useRouter();
  const p = items[i];
  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => window.clearInterval(t);
  }, [items.length]);

  return (
    <section className="relative h-[86svh] min-h-[540px] max-h-[820px] overflow-hidden" aria-roledescription="carrossel" aria-label="Destaques">
      {items.map((it, k) => {
        const wide = it.heroUrl || it.bannerUrl;
        return (
          <div key={it.id} aria-hidden={k !== i} className={`absolute inset-0 transition-opacity duration-1000 ${k === i ? "opacity-100" : "opacity-0"}`}>
            {wide ? (
              // Imagem horizontal: ocupa a área toda, presa à direita
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wide} alt="" className="absolute inset-0 w-full h-full object-cover object-[70%_center] md:object-right" />
            ) : it.coverUrl ? (
              // Sem imagem horizontal: a capa nítida do lado direito, sem borrão e sem card
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.coverUrl} alt="" className="absolute inset-y-0 right-0 h-full w-full md:w-[58%] object-cover object-top" />
            ) : null}
          </div>
        );
      })}
      {/* Preto só atrás do texto, depois a imagem aparece limpa; fundo funde com as fileiras */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#07080a_0%,rgba(7,8,10,0.85)_18%,rgba(7,8,10,0)_55%)] md:bg-[linear-gradient(90deg,#07080a_0%,#07080a_22%,rgba(7,8,10,0.78)_34%,rgba(7,8,10,0.25)_46%,rgba(7,8,10,0)_56%),linear-gradient(0deg,#07080a_0%,rgba(7,8,10,0)_26%),linear-gradient(180deg,rgba(7,8,10,0.45)_0%,rgba(7,8,10,0)_16%)]" />

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
          {p.id === topId && <span className="font-bold text-[#7fb0ff]">Top 1 da semana</span>}
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
            className="inline-flex items-center gap-2.5 h-12 sm:h-[52px] px-6 sm:px-7 rounded-[6px] bg-white text-black text-[15px] sm:text-[16px] font-bold hover:bg-zinc-200 transition-colors"
          >
            <Play className="w-5 h-5 fill-black" /> Comprar · {brl(p.price)}
          </button>
          <Link href={`/loja/${slug}/produto/${p.slug}`} className="inline-flex items-center gap-2.5 h-12 sm:h-[52px] px-6 rounded-[6px] bg-zinc-500/40 hover:bg-zinc-500/55 backdrop-blur text-[15px] sm:text-[16px] font-bold transition-colors">
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
        <div ref={ref} className="flex gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-4 sm:px-8 lg:px-10 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x scroll-px-4 sm:scroll-px-8 lg:scroll-px-10">
          {children}
        </div>
        <button type="button" aria-label="Avançar" onClick={() => scroll(1)} className="hidden lg:flex absolute right-0 top-3 bottom-6 z-20 w-14 items-center justify-center bg-gradient-to-l from-[#07080a] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </section>
  );
}

const BADGE_STYLE: Record<string, string> = {
  novo: "bg-white text-black",
  dublado: "bg-[#3b82f6] text-white",
  legendado: "bg-red-600 text-white",
  br: "bg-gradient-to-r from-emerald-600 via-green-500 to-amber-400 text-zinc-950",
  em_alta: "bg-amber-400 text-zinc-950",
  lancamento: "bg-purple-600 text-white",
  "1_temporada": "bg-sky-600 text-white",
};

function webBadge(v?: string | null) {
  const b = getProductBadge(v);
  return b ? { label: b.label, cls: BADGE_STYLE[b.value] || "bg-white text-black" } : null;
}

function Poster({ slug, p, className = "w-[118px] sm:w-[160px] lg:w-[176px]" }: { slug: string; p: CardItem; className?: string }) {
  const { add } = useCart();
  const [hit, setHit] = useState(0);
  const [done, setDone] = useState(false);
  const badge = webBadge(p.badge);
  useEffect(() => {
    if (!hit) return;
    const t = window.setTimeout(() => setDone(false), 1500);
    return () => window.clearTimeout(t);
  }, [hit]);
  return (
    <div className={`group/card relative shrink-0 snap-start aspect-[2/3] rounded-[6px] bg-[#15161a] ring-1 ring-white/[0.06] transition-shadow duration-200 hover:ring-2 hover:ring-[#3b82f6] ${done ? "ring-2 ring-[#3b82f6]" : ""} ${className}`}>
      <Link href={`/loja/${slug}/produto/${p.slug}`} aria-label={p.title} className="absolute inset-0 rounded-[6px] overflow-hidden">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-[12px] font-semibold text-zinc-400">{p.title}</span>
        )}
        {badge && <span className={`absolute top-2 right-2 h-5 px-1.5 rounded-[3px] text-[10px] font-black uppercase tracking-wide flex items-center ${badge.cls}`}>{badge.label}</span>}
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="absolute top-2 left-2 h-5 px-1.5 rounded-[3px] bg-[#3b82f6] text-[10px] font-bold flex items-center">-{Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-16 pl-2.5 pr-12 pb-3 flex items-end bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <span className="block text-[13px] font-bold tabular-nums">{brl(p.price)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          add(p.id);
          setDone(true);
          setHit((h) => h + 1);
        }}
        aria-label={`Adicionar ${p.title} ao carrinho`}
        className={`absolute right-2 bottom-2 w-9 h-9 rounded-[7px] flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(0,0,0,0.8)] transition-[opacity,background-color,color,transform] duration-200 active:scale-90 ${
          done ? "bg-white text-[#3b82f6]" : "bg-[#3b82f6] text-white hover:bg-[#2f74ea]"
        }`}
      >
        {done && <span key={`r${hit}`} aria-hidden="true" className="absolute inset-0 rounded-[7px] bg-[#3b82f6] animate-[wg-ring_.7s_ease-out_forwards]" />}
        {done ? <Check key={`c${hit}`} className="relative w-[18px] h-[18px] animate-[wg-pop_.45s_ease-out]" strokeWidth={3} /> : <SolarCartLarge2BoldDuotone size={18} />}
        {done && (
          <span key={`f${hit}`} aria-hidden="true" className="absolute inset-x-0 -top-1 text-center text-[11px] font-black text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] animate-[wg-fly_.9s_ease-out_forwards]">
            +1
          </span>
        )}
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
            className={`absolute bottom-0 select-none font-black leading-[0.78] tracking-[-0.08em] text-[#07080a] [-webkit-text-stroke:3px_#3f4654] sm:[-webkit-text-stroke:4px_#3f4654] group-hover/top:[-webkit-text-stroke-color:#3b82f6] transition-[-webkit-text-stroke-color] text-[150px] sm:text-[200px] lg:text-[220px] ${i >= 9 ? "-left-5 sm:-left-7" : "-left-1"}`}
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
            className="group/c relative shrink-0 snap-start w-[250px] sm:w-[320px] aspect-video rounded-[6px] overflow-hidden bg-[#15161a] ring-1 ring-white/[0.07] hover:ring-2 hover:ring-[#3b82f6] transition-shadow"
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

function PromoBanner({
  slug,
  promo,
  image,
  covers,
}: {
  slug: string;
  promo: { title: string; tiers: { minQuantity: number; price: number }[] };
  image: string | null;
  covers: string[];
}) {
  const best = promo.tiers.reduce<number>((b, t, k) => (t.price / t.minQuantity < promo.tiers[b].price / promo.tiers[b].minQuantity ? k : b), 0);
  return (
    <section className="px-4 sm:px-8 lg:px-10" aria-label={promo.title}>
      <div className="relative overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#0b0d12] sm:min-h-[300px]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover object-right" />
        ) : (
          <span aria-hidden="true" className="hidden sm:flex absolute right-6 lg:right-12 top-1/2 -translate-y-1/2 items-center">
            {covers.map((c, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c} src={c} alt="" loading="lazy" className="w-[96px] lg:w-[112px] aspect-[2/3] object-cover rounded-[4px] -ml-6 first:ml-0 ring-1 ring-black/70 shadow-[0_18px_30px_-12px_rgba(0,0,0,0.9)]" style={{ zIndex: 10 - k }} />
            ))}
          </span>
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,#0b0d12_0%,rgba(11,13,18,0.95)_40%,rgba(11,13,18,0.6)_68%,rgba(11,13,18,0.2)_100%)]" />

        <div className="relative z-10 px-5 py-6 sm:px-9 sm:py-8 max-w-[660px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#7fb0ff]">Oferta progressiva</p>
          <h2 className="mt-2 text-[24px] sm:text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] [text-wrap:balance]">{promo.title}</h2>
          <p className="mt-1.5 text-[14px] text-zinc-400">Quanto mais títulos no carrinho, menor o preço de cada um. O desconto entra sozinho.</p>

          {/* Celular: uma faixa por linha. Do tablet pra cima: colunas lado a lado */}
          <div
            className="mt-5 w-full sm:w-auto flex flex-col sm:inline-grid sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))] rounded-[8px] border border-white/[0.12] bg-black/55 backdrop-blur-sm overflow-hidden"
            style={{ ["--n" as string]: promo.tiers.length }}
          >
            {promo.tiers.map((t, k) => (
              <div
                key={t.minQuantity}
                className={`relative flex sm:block items-center gap-3 px-4 sm:px-5 py-3 sm:pt-3.5 sm:pb-3 sm:min-w-[132px] ${k > 0 ? "border-t sm:border-t-0 sm:border-l border-white/[0.1]" : ""} ${k === best ? "bg-[#3b82f6]/[0.14]" : ""}`}
              >
                {k === best && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] sm:w-auto sm:bottom-auto sm:right-0 sm:h-[2px] bg-[#3b82f6]" />}
                <span className="min-w-0 flex-1 sm:block">
                  <span className="flex items-center gap-2 text-[13px] sm:text-[12px] text-zinc-300 sm:text-zinc-400">
                    {t.minQuantity} títulos
                    {k === best && <span className="h-[18px] px-1.5 rounded-[4px] bg-[#3b82f6] text-white text-[10px] font-bold uppercase tracking-wide inline-flex items-center">Melhor preço</span>}
                  </span>
                  <span className="hidden sm:block mt-0.5 text-[20px] font-bold tabular-nums leading-tight text-white">{brl(t.price)}</span>
                  <span className="block mt-0.5 sm:mt-0 text-[12px] text-zinc-500 tabular-nums">{brl(t.price / t.minQuantity)} cada</span>
                </span>
                <b className="sm:hidden text-[19px] font-bold tabular-nums leading-none shrink-0">{brl(t.price)}</b>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link href={`/loja/${slug}/buscar`} className="inline-flex items-center gap-2 h-10 px-4 rounded-[6px] bg-white text-black text-[14px] font-semibold hover:bg-zinc-200 transition-colors">
              Escolher títulos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComboRow({ title, combos, spaced }: { title: string; combos: ComboCard[]; spaced: boolean }) {
  return (
    <div className={spaced ? "mt-9 sm:mt-11" : ""}>
      <Track title={title || "Combos"}>
        {combos.map((c) => (
          <ComboTile key={c.id} c={c} />
        ))}
      </Track>
    </div>
  );
}

function ComboTile({ c }: { c: ComboCard }) {
  const { add } = useCart();
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(0), 1500);
    return () => window.clearTimeout(t);
  }, [done]);
  const covers = (c.coverUrl ? [c.coverUrl] : c.items.map((i) => i.coverUrl).filter(Boolean)).slice(0, 3) as string[];
  return (
    <article className="shrink-0 snap-start w-[300px] sm:w-[360px] rounded-[8px] border border-white/[0.08] bg-[#111216] hover:border-[#3b82f6]/60 transition-colors p-3 flex gap-3.5">
      <span className="relative w-[92px] h-[132px] shrink-0">
        {covers.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + k} src={src} alt="" loading="lazy" className="absolute top-0 w-[76px] h-[114px] object-cover rounded-[4px] ring-1 ring-black/70" style={{ left: k * 8, top: k * 6, zIndex: 3 - k }} />
        ))}
      </span>
      <div className="min-w-0 flex-1 flex flex-col">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[#7fb0ff]">{c.items.length} títulos</p>
        <h3 className="mt-1 text-[15px] font-bold leading-snug line-clamp-2">{c.title}</h3>
        <p className="mt-1 text-[12px] text-zinc-500 line-clamp-2">{c.description || c.items.map((i) => i.title).join(" · ")}</p>
        <div className="mt-auto pt-2 flex items-end gap-2">
          <div className="mr-auto">
            {c.normalPrice > c.price && <span className="block text-[11.5px] text-zinc-500 line-through tabular-nums">{brl(c.normalPrice)}</span>}
            <b className="text-[17px] tabular-nums">{brl(c.price)}</b>
            {c.savingsPercentage > 0 && <span className="ml-1.5 text-[11.5px] font-semibold text-[#7fb0ff]">-{c.savingsPercentage}%</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              add(c.id, true);
              setDone((d) => d + 1);
            }}
            aria-label={`Adicionar o combo ${c.title} ao carrinho`}
            className={`relative h-9 w-9 rounded-[6px] flex items-center justify-center transition-colors ${done ? "bg-white text-[#3b82f6]" : "bg-[#3b82f6] text-white hover:bg-[#2f74ea]"}`}
          >
            {done ? <Check key={done} className="w-[18px] h-[18px] animate-[wg-pop_.45s_ease-out]" strokeWidth={3} /> : <SolarCartLarge2BoldDuotone size={18} />}
          </button>
        </div>
      </div>
    </article>
  );
}
