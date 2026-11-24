"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BadgePercent, Check, Crown, ImagePlus, GalleryHorizontal, Loader2, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { SectionConfig, SectionKind } from "@/lib/webstore/sections";
import { BTN_PRI, BTN_SEC, Callout, INPUT, useToast } from "../fluxos/_components/flow-ui";
import { Modal } from "./LojaModal";
import { saveHeroImageAction, saveSectionsAction } from "./actions";
import type { WebProductView } from "./WebProductsPane";

const SURFACE =
  "relative rounded-[16px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";

const KIND_INFO: Record<SectionKind, { label: string; icon: typeof Crown; max: number; autoLabel: string }> = {
  hero: { label: "Destaques do topo", icon: Sparkles, max: 5, autoLabel: "Automático: os 3 primeiros do Top 15" },
  top15: { label: "Top 15", icon: Crown, max: 15, autoLabel: "Automático: mais vendidos dos últimos 7 dias" },
  continue: { label: "Continuar assistindo", icon: Play, max: 0, autoLabel: "Automático: o que o cliente começou a ver" },
  combos: { label: "Ofertas e combos", icon: BadgePercent, max: 0, autoLabel: "Faixa da oferta progressiva + fileira de combos. Edite o conteúdo em Ofertas e combos." },
  carousel: { label: "Carrossel", icon: GalleryHorizontal, max: 40, autoLabel: "Automático: os mais recentes" },
};

export default function ShowcasePane({
  initial,
  ready,
  products,
  heroImages,
  heroImagesReady,
}: {
  initial: SectionConfig[];
  ready: boolean;
  products: WebProductView[];
  heroImages: Record<string, string>;
  heroImagesReady: boolean;
}) {
  const [list, setList] = useState<SectionConfig[]>(initial);
  const [picker, setPicker] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const byId = new Map(products.map((p) => [p.id, p]));
  const live = products.filter((p) => p.status === "web_active");

  const upd = (i: number, patch: Partial<SectionConfig>) => {
    setList((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  const move = (i: number, d: number) => {
    setList((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const addCarousel = () => {
    setList((l) => [...l, { kind: "carousel", title: "Novo carrossel", active: true, mode: "manual", productIds: [] }]);
    setDirty(true);
    setPicker(list.length);
  };
  const save = () =>
    start(async () => {
      const r = await saveSectionsAction(list);
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      setDirty(false);
      toast("Vitrine salva. A loja já mostra assim.");
      router.refresh();
    });

  // Destaques ficam sempre no topo da página; o resto segue a ordem da lista.
  const hero = list.findIndex((s) => s.kind === "hero");

  return (
    <div className="space-y-4">
      {!ready && (
        <Callout tone="warn">
          Rode a migration <b>0029_web_store_sections.sql</b> no Neon para salvar a vitrine. Até lá a loja usa a vitrine padrão.
        </Callout>
      )}
      {live.length === 0 && <Callout>Adicione produtos na aba Produtos para montar a vitrine.</Callout>}

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-zinc-400 mr-auto">O banner de destaques fica sempre no topo. As fileiras aparecem na ordem abaixo.</p>
        <button type="button" className={BTN_SEC} onClick={addCarousel}>
          <Plus className="w-4 h-4" /> Novo carrossel
        </button>
        <button type="button" className={BTN_PRI} onClick={save} disabled={pending || !dirty || !ready}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar vitrine
        </button>
      </div>

      <ol className="space-y-2.5">
        {list.map((s, i) => {
          const info = KIND_INFO[s.kind];
          const Icon = info.icon;
          const picked = s.productIds.map((id) => byId.get(id)).filter(Boolean) as WebProductView[];
          const canPick = info.max > 0;
          return (
            <li key={`${s.kind}-${i}`} className={`${SURFACE} p-4 ${s.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-[10px] bg-[#3b82f6]/12 text-[#7fb0ff] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  {s.kind === "hero" ? (
                    <p className="text-[14px] font-semibold text-white">{info.label}</p>
                  ) : (
                    <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} maxLength={60} aria-label="Título da fileira" className="w-full bg-transparent text-[14px] font-semibold text-white outline-none border-b border-transparent focus:border-[#3b82f6]/60" />
                  )}
                  <p className="text-[11.5px] text-zinc-500">
                    {s.kind === "continue" || s.kind === "combos"
                      ? info.autoLabel
                      : s.mode === "auto"
                        ? info.autoLabel
                        : `${picked.length} de até ${info.max} produtos escolhidos`}
                  </p>
                </div>
                {s.kind !== "hero" && (
                  <span className="flex">
                    <button type="button" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0 || i - 1 === hero} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-25">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-25">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </span>
                )}
                <button type="button" role="switch" aria-checked={s.active} aria-label="Mostrar na loja" onClick={() => upd(i, { active: !s.active })} className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${s.active ? "bg-[#3b82f6]" : "bg-zinc-700"}`}>
                  <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${s.active ? "left-[21px]" : "left-[3px]"}`} />
                </button>
                {s.kind === "carousel" && (
                  <button
                    type="button"
                    aria-label="Apagar carrossel"
                    onClick={() => {
                      setList((l) => l.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {canPick && (
                <div className="mt-3 pl-12 space-y-2.5">
                  <div className="inline-flex p-[3px] rounded-[10px] bg-black/30 border border-white/[0.07]">
                    {(["auto", "manual"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => upd(i, { mode: m })} aria-pressed={s.mode === m} className={`h-7 px-3 rounded-[8px] text-[12px] font-semibold ${s.mode === m ? "bg-[#25272e] text-white" : "text-zinc-500"}`}>
                        {m === "auto" ? "Automático" : "Escolher produtos"}
                      </button>
                    ))}
                  </div>
                  {s.kind === "hero" && s.mode === "manual" && picked.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-zinc-500">
                        Imagem horizontal de cada destaque: <b className="text-zinc-300">1920 × 820 px</b>. Deixe o rosto ou o assunto na <b className="text-zinc-300">parte da direita</b>; a esquerda fica escura atrás do título. Sem imagem, a loja usa a capa do lado direito.
                      </p>
                      {!heroImagesReady && <p className="text-[12px] text-amber-300">Rode a migration 0032_web_hero_images.sql no Neon para salvar as imagens.</p>}
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {picked.map((p) => (
                          <HeroImageSlot key={p.id} product={p} initial={heroImages[p.id] || null} />
                        ))}
                      </div>
                    </div>
                  )}
                  {s.mode === "manual" && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {picked.map((p, k) => (
                        <span key={p.id} className="relative w-[44px] aspect-[2/3] rounded-[6px] overflow-hidden bg-[#1a1b20]" title={p.title}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.coverUrl && <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />}
                          {s.kind === "top15" && <span className="absolute left-0 top-0 px-1 text-[10px] font-black bg-black/70">{k + 1}</span>}
                        </span>
                      ))}
                      <button type="button" onClick={() => setPicker(i)} className="h-[66px] px-3 rounded-[8px] border border-dashed border-white/[0.16] text-[12px] text-zinc-400 hover:text-white hover:border-[#3b82f6]/60">
                        {picked.length ? "Editar" : "+ Escolher"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {picker !== null && list[picker] && (
        <PickerModal
          title={list[picker].kind === "hero" ? "Destaques do topo" : list[picker].title}
          max={KIND_INFO[list[picker].kind].max}
          ordered={list[picker].kind === "top15" || list[picker].kind === "hero"}
          products={live}
          selected={list[picker].productIds}
          onClose={() => setPicker(null)}
          onSave={(ids) => {
            upd(picker, { productIds: ids, mode: "manual" });
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function HeroImageSlot({ product, initial }: { product: WebProductView; initial: string | null }) {
  const [url, setUrl] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const persist = async (next: string | null) => {
    const r = await saveHeroImageAction(product.id, next);
    if (!r.ok) {
      toast(r.error, "err");
      return false;
    }
    router.refresh();
    return true;
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "banners", { maxWidth: 2400, maxHeight: 1200, quality: 0.86 });
      if (await persist(res.url)) {
        setUrl(res.url);
        toast("Imagem do destaque salva.");
      }
    } catch (e) {
      toast((e as Error).message || "Não foi possível enviar a imagem.", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-w-0">
      <label className="relative block aspect-[1920/820] rounded-[8px] overflow-hidden border border-dashed border-white/[0.14] bg-[#0b0d12] hover:border-[#3b82f6]/60 cursor-pointer">
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover object-right" />
            <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,#07080a_0%,rgba(7,8,10,0.92)_26%,rgba(7,8,10,0)_50%)]" />
          </>
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11.5px] text-zinc-500">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            Enviar imagem horizontal
          </span>
        )}
        {busy && url && (
          <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
        <span className="absolute left-2.5 bottom-2 right-2.5 text-[11.5px] font-semibold text-white truncate drop-shadow">{product.title}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {url && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await persist(null)) setUrl("");
            setBusy(false);
          }}
          className="mt-1 text-[11.5px] text-zinc-500 hover:text-red-300"
        >
          Remover imagem
        </button>
      )}
    </div>
  );
}

function PickerModal({
  title,
  max,
  ordered,
  products,
  selected,
  onClose,
  onSave,
}: {
  title: string;
  max: number;
  ordered: boolean;
  products: WebProductView[];
  selected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>(selected.filter((id) => products.some((p) => p.id === id)));
  const [q, setQ] = useState("");
  const byId = new Map(products.map((p) => [p.id, p]));
  const shown = products.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= max ? l : [...l, id]));
  const move = (i: number, d: number) =>
    setIds((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Modal
      title={title}
      subtitle={`Escolha até ${max} produtos${ordered ? " e arrume a ordem" : ""}.`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-zinc-500 self-center">
            {ids.length}/{max}
          </span>
          <button type="button" className={BTN_SEC} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={BTN_PRI} onClick={() => onSave(ids)}>
            <Check className="w-4 h-4" /> Usar estes
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {ids.length > 0 && (
          <ol className="space-y-1">
            {ids.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-[9px] bg-[#3b82f6]/[0.07] border border-[#3b82f6]/25 px-2 py-1.5">
                  <span className="w-6 text-center text-[13px] font-black text-[#9cc2ff] tabular-nums">{i + 1}</span>
                  <span className="flex-1 min-w-0 text-[12.5px] text-zinc-100 truncate">{p.title}</span>
                  <button type="button" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === ids.length - 1} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Tirar" onClick={() => toggle(id)} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className={INPUT} />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto pr-1">
          {shown.map((p) => {
            const on = ids.includes(p.id);
            const n = ids.indexOf(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on} title={p.title} className={`relative aspect-[2/3] rounded-[9px] overflow-hidden bg-[#1a1b20] ring-2 transition ${on ? "ring-[#3b82f6]" : "ring-transparent hover:ring-white/20"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.coverUrl && <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />}
                <span className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent text-[10.5px] leading-tight text-left text-white line-clamp-2">{p.title}</span>
                {on && <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#3b82f6] text-[11px] font-bold flex items-center justify-center">{ordered ? n + 1 : <Check className="w-3.5 h-3.5" />}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
