"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImagePlus, Layers, Loader2, Pencil, Plus, Save, Trash2, TrendingDown } from "lucide-react";
import { BTN_PRI, BTN_SEC, Callout, INPUT, Modal, useToast } from "../fluxos/_components/flow-ui";
import { archiveWebComboAction, saveWebComboAction, saveWebProgressiveAction } from "./actions";
import type { WebComboView } from "@/lib/webstore/combos";

const SURFACE =
  "relative rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const money = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

export interface ComboProductOption {
  id: string;
  title: string;
  coverUrl: string | null;
  price: number;
  status: string;
}

export default function CombosPane({
  combos,
  products,
  miniApp,
}: {
  combos: WebComboView[];
  products: ComboProductOption[];
  miniApp: { title: string; tiers: { minQuantity: number; price: number }[] } | null;
}) {
  const progressive = combos.find((c) => c.type === "progressive" && c.active) || combos.find((c) => c.type === "progressive") || null;
  const curated = combos.filter((c) => c.type === "curated");
  const [edit, setEdit] = useState<WebComboView | "new" | null>(null);
  const usable = products.filter((p) => p.status !== "web_archived");

  return (
    <div className="space-y-5">
      <Callout>
        Combos e ofertas daqui valem <b>só na Loja Web</b>. Os do Mini App e dos bots continuam como estão.
      </Callout>

      <ProgressiveEditor key={progressive?.id || "novo"} current={progressive} products={usable} miniApp={miniApp} />

      <section className={`${SURFACE} p-5`}>
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="mr-auto">
            <h3 className="text-[15px] font-semibold">Combos</h3>
            <p className="text-[12.5px] text-zinc-500 mt-0.5">Um pacote fechado de títulos por um preço só. Aparece numa fileira própria na loja.</p>
          </div>
          <button type="button" className={BTN_PRI} onClick={() => setEdit("new")} disabled={usable.length < 2}>
            <Plus className="w-4 h-4" /> Novo combo
          </button>
        </div>
        {curated.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-white/[0.1] py-10 text-center">
            <Layers className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
            <p className="text-[13px] text-zinc-500">{usable.length < 2 ? "Cadastre pelo menos 2 títulos na Loja Web para montar um combo." : "Nenhum combo ainda."}</p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {curated.map((c) => {
              const items = c.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ComboProductOption[];
              const normal = items.reduce((a, p) => a + p.price, 0);
              return (
                <li key={c.id} className="rounded-[10px] border border-white/[0.07] bg-white/[0.015] p-3 flex gap-3 min-w-0">
                  <Stack covers={(c.coverUrl ? [c.coverUrl] : items.map((p) => p.coverUrl)).filter(Boolean) as string[]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-semibold truncate mr-auto">{c.title}</p>
                      <span className={`shrink-0 h-5 px-1.5 rounded-[5px] text-[10.5px] font-semibold flex items-center ${c.active ? "bg-[#3b82f6]/15 text-[#9cc2ff]" : "bg-white/[0.06] text-zinc-400"}`}>{c.active ? "Na loja" : "Rascunho"}</span>
                    </div>
                    <p className="text-[12px] text-zinc-500 truncate">{items.length} títulos</p>
                    <p className="mt-1 text-[13px]">
                      <b className="tabular-nums">{brl(c.price)}</b>
                      {normal > c.price && <span className="ml-1.5 text-[11.5px] text-zinc-500 line-through tabular-nums">{brl(normal)}</span>}
                    </p>
                    <button type="button" onClick={() => setEdit(c)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-[#7fb0ff] hover:underline">
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {edit && <ComboEditor key={edit === "new" ? "new" : edit.id} combo={edit === "new" ? null : edit} products={usable} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Stack({ covers }: { covers: string[] }) {
  const list = covers.slice(0, 3);
  return (
    <span className="relative w-[64px] h-[84px] shrink-0">
      {list.length === 0 && <span className="absolute inset-0 rounded-[6px] bg-[#1a1b20]" />}
      {list.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c + i}
          src={c}
          alt=""
          className="absolute top-0 w-[52px] h-[78px] object-cover rounded-[6px] ring-1 ring-black/60"
          style={{ left: i * 6, top: i * 3, zIndex: 3 - i, opacity: 1 - i * 0.15 }}
        />
      ))}
    </span>
  );
}

/* ------------------------------ Oferta progressiva ------------------------------ */

function ProgressiveEditor({
  current,
  products,
  miniApp,
}: {
  current: WebComboView | null;
  products: ComboProductOption[];
  miniApp: { title: string; tiers: { minQuantity: number; price: number }[] } | null;
}) {
  const [title, setTitle] = useState(current?.title || "Leve mais, pague menos");
  const [active, setActive] = useState(current ? current.active : true);
  const [mode, setMode] = useState<"all_products" | "specific_products">(current?.eligibilityMode || "all_products");
  const [picked, setPicked] = useState<string[]>(current?.productIds || []);
  const [tiers, setTiers] = useState<{ q: string; p: string }[]>(
    current?.tiers.length ? current.tiers.map((t) => ({ q: String(t.minQuantity), p: money(t.price) })) : [{ q: "3", p: "" }]
  );
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const save = () =>
    start(async () => {
      const r = await saveWebProgressiveAction({
        id: current?.id || null,
        title,
        active,
        eligibilityMode: mode,
        productIds: picked,
        tiers: tiers.map((t) => ({ minQuantity: Number(t.q) || 0, price: num(t.p) })),
      });
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast(active ? "Oferta progressiva salva e ativa na loja." : "Oferta salva como rascunho.");
      router.refresh();
    });

  return (
    <section className={`${SURFACE} p-5`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="mr-auto">
          <h3 className="text-[15px] font-semibold">Oferta progressiva</h3>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">Quanto mais títulos o cliente leva, menor o preço de cada um. O desconto entra sozinho no carrinho.</p>
        </div>
        <label className="inline-flex items-center gap-2.5 text-[13px] text-zinc-300 cursor-pointer select-none">
          Ativa na loja
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((a) => !a)}
            className={`relative w-10 h-6 rounded-full transition-colors ${active ? "bg-[#3b82f6]" : "bg-white/[0.12]"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-[left] ${active ? "left-5" : "left-1"}`} />
          </button>
        </label>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">Nome da oferta</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={`${INPUT} w-full`} />
          </label>
          <div>
            <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">Vale para</span>
            <div className="grid grid-cols-2 p-1 rounded-[9px] bg-black/30 border border-white/[0.07]">
              {(
                [
                  ["all_products", "Todos os títulos"],
                  ["specific_products", "Só alguns títulos"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)} className={`h-8 rounded-[7px] text-[12.5px] font-medium transition-colors ${mode === k ? "bg-[#26282f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-zinc-400 hover:text-zinc-200"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {mode === "specific_products" && (
            <ul className="max-h-[240px] overflow-y-auto overflow-x-hidden grid gap-1 pr-1">
              {products.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <li key={p.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                      className={`w-full min-w-0 flex items-center gap-2.5 h-11 px-2.5 rounded-[8px] border text-left ${on ? "border-[#3b82f6]/70 bg-[#3b82f6]/[0.07]" : "border-white/[0.06] hover:border-white/[0.14]"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.coverUrl ? <img src={p.coverUrl} alt="" className="w-6 h-9 rounded-[3px] object-cover shrink-0" /> : <span className="w-6 h-9 rounded-[3px] bg-[#1a1b20] shrink-0" />}
                      <span className="text-[12.5px] truncate flex-1">{p.title}</span>
                      <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${on ? "bg-[#3b82f6] border-[#3b82f6]" : "border-zinc-600"}`}>{on && <Check className="w-3 h-3 text-white" />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium text-zinc-400">Faixas</span>
            {miniApp && miniApp.tiers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTiers(miniApp.tiers.map((t) => ({ q: String(t.minQuantity), p: money(t.price) })));
                  if (!current) setTitle(miniApp.title);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] text-[#7fb0ff] hover:underline"
              >
                <Copy className="w-3.5 h-3.5" /> Usar as faixas do Mini App
              </button>
            )}
          </div>
          <div className="rounded-[10px] border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-[1fr_1.2fr_1fr_36px] gap-2 px-3 h-9 items-center text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 bg-white/[0.02] border-b border-white/[0.06]">
              <span>Leve</span>
              <span>Por (total)</span>
              <span>Cada sai</span>
              <span />
            </div>
            {tiers.map((t, i) => {
              const q = Number(t.q) || 0;
              const p = num(t.p);
              return (
                <div key={i} className="grid grid-cols-[1fr_1.2fr_1fr_36px] gap-2 px-3 py-2 items-center border-b border-white/[0.05] last:border-0">
                  <div className="relative">
                    <input inputMode="numeric" value={t.q} onChange={(e) => setTiers((s) => s.map((x, k) => (k === i ? { ...x, q: e.target.value.replace(/\D/g, "").slice(0, 3) } : x)))} className={`${INPUT} w-full pr-14 tabular-nums`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-zinc-500 pointer-events-none">títulos</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500 pointer-events-none">R$</span>
                    <input inputMode="decimal" value={t.p} placeholder="0,00" onChange={(e) => setTiers((s) => s.map((x, k) => (k === i ? { ...x, p: e.target.value.replace(/[^\d,.]/g, "").slice(0, 9) } : x)))} className={`${INPUT} w-full pl-9 tabular-nums`} />
                  </div>
                  <span className="text-[13px] tabular-nums text-zinc-300">{q > 0 && p > 0 ? brl(p / q) : "—"}</span>
                  <button type="button" aria-label="Remover faixa" onClick={() => setTiers((s) => s.filter((_, k) => k !== i))} disabled={tiers.length === 1} className="w-8 h-8 rounded-[7px] flex items-center justify-center text-zinc-500 hover:text-red-300 hover:bg-white/[0.05] disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setTiers((s) => [...s, { q: String((Number(s[s.length - 1]?.q) || 1) + 2), p: "" }])} disabled={tiers.length >= 8} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-zinc-300 hover:text-white disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> Adicionar faixa
          </button>
          <p className="mt-2 text-[11.5px] text-zinc-500 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Cada faixa maior precisa sair mais barata por título que a anterior.
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">
        <button type="button" className={BTN_PRI} onClick={save} disabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar oferta
        </button>
      </div>
    </section>
  );
}

/* ------------------------------ Combo fechado ------------------------------ */

function ComboEditor({ combo, products, onClose }: { combo: WebComboView | null; products: ComboProductOption[]; onClose: () => void }) {
  const [f, setF] = useState({
    title: combo?.title || "",
    description: combo?.description || "",
    coverUrl: combo?.coverUrl || "",
    price: combo ? money(combo.price) : "",
    active: combo ? combo.active : true,
  });
  const [picked, setPicked] = useState<string[]>(combo?.productIds || []);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const normal = useMemo(() => picked.reduce((a, id) => a + (products.find((p) => p.id === id)?.price || 0), 0), [picked, products]);
  const price = num(f.price);
  const off = normal > 0 && price > 0 && price < normal ? Math.round((1 - price / normal) * 100) : 0;
  const shown = products.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "products");
      setF((s) => ({ ...s, coverUrl: res.url }));
    } catch (e) {
      toast((e as Error).message || "Não foi possível enviar a imagem.", "err");
    } finally {
      setUploading(false);
    }
  };

  const save = () =>
    start(async () => {
      const r = await saveWebComboAction({ id: combo?.id || null, title: f.title, description: f.description, coverUrl: f.coverUrl, price, active: f.active, productIds: picked });
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast(f.active ? "Combo salvo e visível na loja." : "Combo salvo como rascunho.");
      router.refresh();
      onClose();
    });

  const archive = () =>
    start(async () => {
      if (!combo) return;
      const r = await archiveWebComboAction(combo.id);
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast("Combo removido da Loja Web.");
      router.refresh();
      onClose();
    });

  return (
    <Modal
      title={combo ? "Editar combo" : "Novo combo"}
      subtitle="Escolha os títulos e o preço do pacote. Só títulos da Loja Web entram."
      onClose={onClose}
      busy={pending}
      footer={
        <>
          {combo && (
            <button type="button" onClick={archive} disabled={pending} className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] text-zinc-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" /> Remover
            </button>
          )}
          <button type="button" className={BTN_SEC} onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className={BTN_PRI} onClick={save} disabled={pending || uploading}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar combo
          </button>
        </>
      }
    >
      <div className="space-y-4 min-w-0">
        <div className="flex gap-3">
          <label className="relative w-[72px] h-[108px] shrink-0 rounded-[8px] border border-dashed border-white/[0.14] bg-white/[0.02] hover:border-[#3b82f6]/60 cursor-pointer overflow-hidden">
            {f.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10.5px] text-zinc-500 text-center px-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                Capa
              </span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <div className="flex-1 min-w-0 space-y-2.5">
            <input value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} placeholder="Nome do combo" maxLength={80} className={`${INPUT} w-full`} />
            <textarea value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} placeholder="Descrição curta (opcional)" maxLength={500} rows={2} className={`${INPUT} w-full h-auto py-2 resize-none`} />
          </div>
        </div>
        <p className="text-[11.5px] text-zinc-500 -mt-1">Sem capa, a loja mostra as capas dos títulos empilhadas.</p>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium text-zinc-400">Títulos do combo</span>
            <span className="text-[11.5px] text-zinc-500">{picked.length} escolhidos</span>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar título" className={`${INPUT} w-full mb-2`} />
          <ul className="max-h-[220px] overflow-y-auto overflow-x-hidden grid gap-1 pr-1">
            {shown.map((p) => {
              const on = picked.includes(p.id);
              return (
                <li key={p.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    className={`w-full min-w-0 flex items-center gap-2.5 h-11 px-2.5 rounded-[8px] border text-left ${on ? "border-[#3b82f6]/70 bg-[#3b82f6]/[0.07]" : "border-white/[0.06] hover:border-white/[0.14]"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.coverUrl ? <img src={p.coverUrl} alt="" className="w-6 h-9 rounded-[3px] object-cover shrink-0" /> : <span className="w-6 h-9 rounded-[3px] bg-[#1a1b20] shrink-0" />}
                    <span className="text-[12.5px] truncate flex-1">{p.title}</span>
                    <span className="text-[11.5px] text-zinc-500 tabular-nums shrink-0">{brl(p.price)}</span>
                    <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${on ? "bg-[#3b82f6] border-[#3b82f6]" : "border-zinc-600"}`}>{on && <Check className="w-3 h-3 text-white" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <label className="block">
            <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">Preço do combo</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500 pointer-events-none">R$</span>
              <input inputMode="decimal" value={f.price} placeholder="0,00" onChange={(e) => setF((s) => ({ ...s, price: e.target.value.replace(/[^\d,.]/g, "").slice(0, 9) }))} className={`${INPUT} w-full pl-9 tabular-nums`} />
            </div>
          </label>
          <div className="text-[12px] text-zinc-500 pb-2 leading-snug">
            Separados: <span className="text-zinc-300 tabular-nums">{brl(normal)}</span>
            {off > 0 && <span className="block text-[#9cc2ff]">Cliente economiza {off}%</span>}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[13px] text-zinc-300 cursor-pointer select-none">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} className="w-4 h-4 accent-[#3b82f6]" />
          Mostrar na loja
        </label>
      </div>
    </Modal>
  );
}
