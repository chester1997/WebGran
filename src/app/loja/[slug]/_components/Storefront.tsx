"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Layers, Plus, Search, Sparkles, Tag } from "lucide-react";
import type { WebCombo, WebProduct } from "@/lib/webstore/catalog";
import { useCart } from "./cart";
import { brl, DELIVERY_LABEL } from "./ui";

interface Catalog {
  products: WebProduct[];
  categories: { id: string; name: string; slug: string }[];
  banners: { id: string; title: string; imageUrl: string }[];
  combos: WebCombo[];
  promotion: { title: string; tiers: { minQuantity: number; price: number }[]; allProducts: boolean; productIds: string[] } | null;
}

export function Storefront({ slug, storeName, description, catalog }: { slug: string; storeName: string; description: string | null; catalog: Catalog }) {
  const { add } = useCart();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog.products.filter((p) => (cat === "all" || p.categoryId === cat) && (!term || p.title.toLowerCase().includes(term)));
  }, [catalog.products, cat, q]);

  const banner = catalog.banners[0];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Topo */}
      <section className="pt-8 sm:pt-12 pb-6 sm:pb-8">
        {banner && (
          <div className="relative overflow-hidden rounded-[20px] border border-white/[0.07] aspect-[21/8] bg-[#111113] mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        <h1 className="text-[26px] sm:text-[34px] font-semibold tracking-tight">{storeName}</h1>
        {description && <p className="mt-1.5 text-[14.5px] text-zinc-400 max-w-2xl line-clamp-3">{description}</p>}
      </section>

      {catalog.promotion && (
        <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-[#3b82f6]/25 bg-[#3b82f6]/[0.06] px-4 py-3">
          <Sparkles className="w-[18px] h-[18px] text-[#7fb0ff] shrink-0 mt-0.5" />
          <p className="text-[13.5px] text-zinc-300">
            <b className="text-white">{catalog.promotion.title}</b>
            {" · "}
            {catalog.promotion.tiers
              .map((t) => `${t.minQuantity} itens por ${brl(t.price)}`)
              .join(" · ")}
            <span className="text-zinc-500"> — o desconto entra sozinho no carrinho.</span>
          </p>
        </div>
      )}

      {/* Combos */}
      {catalog.combos.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold mb-4">
            <Layers className="w-[18px] h-[18px] text-[#7fb0ff]" /> Combos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.combos.map((c) => (
              <article key={c.id} className="rounded-[16px] border border-white/[0.07] bg-[#111113] p-4 flex flex-col gap-3">
                <div className="flex -space-x-3">
                  {c.products.slice(0, 4).map((p) => (
                    <span key={p.id} className="w-12 h-12 rounded-[10px] overflow-hidden ring-2 ring-[#111113] bg-[#1a1a1d]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.coverUrl && <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />}
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] truncate">{c.title}</h3>
                  <p className="text-[12.5px] text-zinc-500 line-clamp-2">{c.products.map((p) => p.title).join(" + ")}</p>
                </div>
                <div className="mt-auto flex items-end justify-between gap-3">
                  <div>
                    {c.normalPrice > c.price && <span className="block text-[12px] text-zinc-500 line-through">{brl(c.normalPrice)}</span>}
                    <span className="text-[18px] font-bold tabular-nums">{brl(c.price)}</span>
                    {c.savingsPercentage > 0 && <span className="ml-2 text-[12px] font-semibold text-[#7fb0ff]">-{c.savingsPercentage}%</span>}
                  </div>
                  <button type="button" onClick={() => add(c.id, true)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] bg-[#3b82f6] hover:bg-[#2f74ea] text-[13px] font-semibold transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Produtos */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <h2 className="text-[17px] font-semibold mr-auto">Produtos</h2>
          <label className="relative sm:w-[280px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produto"
              className="w-full h-10 pl-9 pr-3 rounded-[10px] bg-[#121214] border border-white/[0.08] text-[13.5px] outline-none focus:border-[#3b82f6]/70"
            />
          </label>
        </div>

        {catalog.categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
            {[{ id: "all", name: "Todos" }, ...catalog.categories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                aria-pressed={cat === c.id}
                className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-medium border transition-colors ${
                  cat === c.id ? "bg-white text-black border-white" : "border-white/[0.09] text-zinc-400 hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-zinc-500">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {list.map((p) => (
              <article key={p.id} className="group rounded-[16px] border border-white/[0.07] bg-[#111113] overflow-hidden flex flex-col hover:border-white/[0.14] transition-colors">
                <Link href={`/loja/${slug}/produto/${p.slug}`} className="block relative aspect-[4/5] bg-[#18181b] overflow-hidden">
                  {p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  )}
                  {p.compareAtPrice && p.compareAtPrice > p.price && (
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 h-6 px-2 rounded-[7px] bg-[#3b82f6] text-[11px] font-bold">
                      <Tag className="w-3 h-3" /> -{Math.round((1 - p.price / p.compareAtPrice) * 100)}%
                    </span>
                  )}
                </Link>
                <div className="p-3 sm:p-3.5 flex flex-col gap-2 flex-1">
                  <Link href={`/loja/${slug}/produto/${p.slug}`} className="text-[13.5px] sm:text-[14px] font-semibold leading-snug line-clamp-2 hover:text-[#9cc2ff]">
                    {p.title}
                  </Link>
                  <span className="text-[11.5px] text-zinc-500">{DELIVERY_LABEL[p.deliveryType] || "Acesso digital"}</span>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="text-[15px] font-bold tabular-nums">{brl(p.price)}</span>
                    <button
                      type="button"
                      onClick={() => add(p.id)}
                      aria-label={`Adicionar ${p.title} ao carrinho`}
                      className="w-9 h-9 rounded-[10px] bg-[#3b82f6]/15 text-[#9cc2ff] hover:bg-[#3b82f6] hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
