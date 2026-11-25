"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { brl } from "../_components/ui";

import { thumb } from "@/lib/webstore/img";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SearchClient({ slug, items }: { slug: string; items: { id: string; slug: string; title: string; coverUrl: string | null; price: number }[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = norm(q.trim());
    return t ? items.filter((p) => norm(p.title).includes(t)) : items;
  }, [items, q]);
  return (
    <div className="pt-24 px-4 sm:px-8 lg:px-10 pb-10">
      <label className="relative block max-w-[720px]">
        <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar títulos"
          className="w-full h-14 pl-12 pr-12 rounded-[8px] bg-[#121316] border border-white/[0.09] text-[16px] outline-none focus:border-[#3b82f6]/70 focus:ring-4 focus:ring-[#3b82f6]/15"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Limpar" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      <p className="mt-5 mb-4 text-[13px] text-zinc-500">{q ? `${shown.length} ${shown.length === 1 ? "resultado" : "resultados"}` : "Todos os títulos"}</p>
      {shown.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-zinc-500">Nada encontrado para “{q}”.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-3">
          {shown.map((p) => (
            <Link key={p.id} href={`/loja/${slug}/produto/${p.slug}`} className="group relative aspect-[2/3] rounded-[6px] overflow-hidden bg-[#15161a] ring-1 ring-white/[0.06] hover:ring-2 hover:ring-[#3b82f6] transition-shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.coverUrl && <img src={thumb(p.coverUrl, 360)} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/95 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="block text-[11.5px] font-semibold leading-tight line-clamp-2">{p.title}</span>
                <span className="block text-[12px] font-bold mt-1">{brl(p.price)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
