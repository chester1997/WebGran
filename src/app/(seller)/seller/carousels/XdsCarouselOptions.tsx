"use client";

import React, { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

export type CarouselDisplayStyle = "small" | "large" | "featured" | "collection";

export interface XdsCarouselValues {
  displayStyle: CarouselDisplayStyle;
  autoplaySeconds: number;
  coverImageUrl: string;
  subtitle: string;
}

export const xdsDefaults = (c?: {
  displayStyle?: string | null;
  autoplaySeconds?: number | null;
  coverImageUrl?: string | null;
  subtitle?: string | null;
} | null): XdsCarouselValues => ({
  displayStyle: (["small", "large", "featured", "collection"].includes(String(c?.displayStyle)) ? c?.displayStyle : "small") as CarouselDisplayStyle,
  autoplaySeconds: c?.autoplaySeconds || 5,
  coverImageUrl: c?.coverImageUrl || "",
  subtitle: c?.subtitle || "",
});

const STYLES: { id: CarouselDisplayStyle; label: string; hint: string }[] = [
  { id: "small", label: "Cards pequenos", hint: "Fileira de capas menores (ex.: Minha lista)." },
  { id: "large", label: "Cards grandes", hint: "Fileira de capas maiores (ex.: Adicionados recentemente)." },
  { id: "featured", label: "Destaque", hint: "Cards grandes no topo, passando sozinhos." },
  { id: "collection", label: "Coleção", hint: "Imagem de fundo com título e os produtos abaixo." },
];

/** Mini desenho de cada estilo */
function StyleIcon({ id }: { id: CarouselDisplayStyle }) {
  if (id === "featured")
    return (
      <span className="flex gap-0.5 h-7 w-10 items-stretch">
        <span className="w-1 rounded-[2px] bg-white/20" />
        <span className="flex-1 rounded-[3px] bg-[#3b82f6]/80" />
        <span className="w-1 rounded-[2px] bg-white/20" />
      </span>
    );
  if (id === "collection")
    return (
      <span className="relative h-7 w-10 rounded-[3px] bg-[#3b82f6]/40 overflow-hidden">
        <span className="absolute left-1 right-1 bottom-0.5 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex-1 h-3 rounded-[2px] bg-white/60" />
          ))}
        </span>
      </span>
    );
  const big = id === "large";
  return (
    <span className="flex gap-0.5 h-7 w-10 items-end">
      {(big ? [0, 1] : [0, 1, 2]).map((i) => (
        <span key={i} className={`flex-1 rounded-[2px] bg-white/50 ${big ? "h-7" : "h-5"}`} />
      ))}
    </span>
  );
}

/**
 * Opções do carrossel para o Tema XDs do Mini App.
 * No tema Padrão todos os carrosséis continuam aparecendo como fileiras normais.
 */
export function XdsCarouselOptions({ value, onChange }: { value: XdsCarouselValues; onChange: (v: XdsCarouselValues) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (patch: Partial<XdsCarouselValues>) => onChange({ ...value, ...patch });

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "banners", { maxWidth: 1080, maxHeight: 1080, quality: 0.85 });
      set({ coverImageUrl: res.url });
    } catch (e) {
      setUploadError((e as Error).message || "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t border-white/5">
      <div>
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Visual no Tema XDs</label>
        <p className="text-[11px] text-zinc-500 mt-0.5">Só muda o Mini App dos bots que usam o Tema XDs. No tema Padrão, o carrossel continua como uma fileira normal.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STYLES.map((s) => {
          const active = value.displayStyle === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => set({ displayStyle: s.id })}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                active ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-white/10 bg-[#181820] hover:border-white/20"
              }`}
            >
              <StyleIcon id={s.id} />
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${active ? "text-white" : "text-zinc-300"}`}>{s.label}</span>
                <span className="block text-[10.5px] text-zinc-500 leading-snug">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {value.displayStyle === "featured" && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#181820] border border-white/5">
          <label className="text-xs text-zinc-300 shrink-0">Trocar de card a cada</label>
          <input
            type="range"
            min={2}
            max={15}
            step={1}
            value={value.autoplaySeconds}
            onChange={(e) => set({ autoplaySeconds: Number(e.target.value) })}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="text-xs font-semibold text-white tabular-nums w-10 text-right">{value.autoplaySeconds} s</span>
        </div>
      )}

      {value.displayStyle === "collection" && (
        <div className="space-y-3 p-3 rounded-xl bg-[#181820] border border-white/5">
          <div className="flex items-start gap-3">
            <div className="relative w-28 aspect-[4/3] rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
              {value.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.coverImageUrl} alt="Imagem de fundo da coleção" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-5 h-5 text-zinc-600" />
              )}
              {uploading && (
                <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-200">Imagem de fundo</p>
              <p className="text-[11px] text-zinc-500 leading-snug">Aparece atrás do nome da coleção. Use uma imagem horizontal ou quadrada.</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[11px] font-semibold cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" /> {value.coverImageUrl ? "Trocar" : "Enviar imagem"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                {value.coverImageUrl && (
                  <button type="button" onClick={() => set({ coverImageUrl: "" })} className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] text-zinc-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                )}
              </div>
              {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-zinc-400">Texto abaixo do nome</label>
            <input
              type="text"
              value={value.subtitle}
              maxLength={40}
              onChange={(e) => set({ subtitle: e.target.value })}
              placeholder="Coleção"
              className="w-full bg-[#121216] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3b82f6] placeholder:text-zinc-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}

const BADGE_COLORS = ["#3B82F6", "#0EA5E9", "#14B8A6", "#22C55E", "#EAB308", "#F97316", "#EF4444", "#EC4899", "#8B5CF6"];

/** Cor do emblema com o número no Top 15 do Tema XDs */
export function XdsBadgeColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2 pt-2 border-t border-white/5">
      <div>
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Cor do emblema no Tema XDs</label>
        <p className="text-[11px] text-zinc-500 mt-0.5">O número de cada posição aparece num emblema no canto da capa.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {BADGE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            onClick={() => onChange(c)}
            className={`w-8 h-8 rounded-lg border-2 transition-transform ${value.toUpperCase() === c ? "border-white scale-105" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
        <label className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-white/10 bg-[#181820] text-[11px] text-zinc-300 cursor-pointer">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-5 h-5 bg-transparent border-0 p-0 cursor-pointer" />
          Outra
        </label>
      </div>
    </div>
  );
}
