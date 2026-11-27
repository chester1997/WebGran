"use client";

import { Check, Clock, Globe, Palette } from "lucide-react";

const SURFACE =
  "relative rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";

/**
 * Temas da Loja Web. Por enquanto só existe o Padrão (o visual atual da loja);
 * Tema V1 e Tema V2 aparecem como "Em breve" e ainda não mudam nada na loja.
 */
export default function ThemesPane({ storeSlug }: { storeSlug: string }) {
  return (
    <section className={`${SURFACE} p-5`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="mr-auto max-w-[640px]">
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#3b82f6]" /> Temas
          </h3>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">O tema define o visual da sua Loja Web. Sua loja usa o tema Padrão. Novos temas chegam em breve.</p>
        </div>
        <a
          href={`/loja/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[9px] border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] text-[13px] font-medium text-zinc-200"
        >
          <Globe className="w-4 h-4" /> Ver minha loja
        </a>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Tema em uso */}
        <article className="rounded-[12px] border border-[#3b82f6]/60 bg-[#3b82f6]/[0.06] overflow-hidden">
          <div className="relative aspect-[16/10] bg-[#0b0d12] border-b border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/webstore-themes/padrao.webp" alt="Prévia do tema Padrão da Loja Web" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-top" />
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 h-6 px-2 rounded-[6px] bg-[#3b82f6] text-white text-[11px] font-bold">
              <Check className="w-3.5 h-3.5" /> Em uso
            </span>
          </div>
          <div className="p-3.5">
            <p className="text-[14px] font-semibold">Padrão</p>
            <p className="text-[12px] text-zinc-500 mt-0.5">Escuro, com destaque grande no topo, Top 15 e fileiras de títulos.</p>
          </div>
        </article>

        {["Tema V1", "Tema V2"].map((name) => (
          <article key={name} className="rounded-[12px] border border-white/[0.07] bg-black/20 overflow-hidden">
            <div className="relative aspect-[16/10] bg-[#0b0d12] border-b border-white/[0.06] flex items-center justify-center overflow-hidden">
              {/* Esqueleto de loja: só sugere o layout, sem conteúdo real */}
              <span aria-hidden="true" className="absolute inset-0 p-4 flex flex-col gap-2.5 opacity-40">
                <span className="h-3 w-24 rounded bg-white/[0.08]" />
                <span className="flex-1 rounded-[8px] bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(255,255,255,0.03))]" />
                <span className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="aspect-[2/3] rounded-[4px] bg-white/[0.06]" />
                  ))}
                </span>
              </span>
              <span className="relative inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-white/[0.12] bg-black/70 backdrop-blur-sm text-[12px] font-semibold text-zinc-200">
                <Clock className="w-3.5 h-3.5 text-[#3b82f6]" /> Em breve
              </span>
            </div>
            <div className="p-3.5 flex items-center gap-2">
              <div className="mr-auto min-w-0">
                <p className="text-[14px] font-semibold text-zinc-300">{name}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">Novo visual para a sua loja.</p>
              </div>
              <button type="button" disabled className="h-8 px-3 rounded-[8px] border border-white/[0.08] text-[12px] text-zinc-500 cursor-not-allowed">
                Em breve
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
