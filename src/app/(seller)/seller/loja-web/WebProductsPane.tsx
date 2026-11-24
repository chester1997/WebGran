"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, Film, ImagePlus, Loader2, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { BTN_PRI, BTN_SEC, Callout, INPUT, Modal, useToast } from "../fluxos/_components/flow-ui";
import { archiveWebProductAction, copyCandidatesAction, copyProductsAction, saveWebProductAction, videoPickerAction } from "./actions";

export interface WebProductView {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  duration: string | null;
  badge: string | null;
  status: string;
  videoCount: number;
  copiedFrom: string | null;
}

const SURFACE =
  "relative rounded-[16px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DURATIONS: [string, string][] = [
  ["lifetime", "Vitalício"],
  ["monthly", "30 dias"],
  ["quarterly", "3 meses"],
  ["semiannual", "6 meses"],
  ["annual", "1 ano"],
  ["weekly", "7 dias"],
  ["daily", "1 dia"],
];

export default function WebProductsPane({ items, ready }: { items: WebProductView[]; ready: boolean }) {
  const [q, setQ] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [edit, setEdit] = useState<WebProductView | "new" | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((p) => p.title.toLowerCase().includes(t)) : items;
  }, [items, q]);

  return (
    <div className="space-y-4">
      <Callout>
        Os produtos da Loja Web são <b>só da web</b>: não aparecem no Mini App, nos bots nem nos fluxos. A entrega é sempre em <b>vídeo dentro da loja</b>, com os vídeos da sua Biblioteca.
      </Callout>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_PRI} onClick={() => setCopyOpen(true)} disabled={!ready}>
          <Copy className="w-4 h-4" /> Copiar dos meus produtos
        </button>
        <button type="button" className={BTN_SEC} onClick={() => setEdit("new")} disabled={!ready}>
          <Plus className="w-4 h-4" /> Novo produto
        </button>
        <label className="relative ml-auto w-full sm:w-[280px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className={`${INPUT} !pl-9`} />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className={`${SURFACE} px-6 py-14 text-center`}>
          <Film className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-300">{items.length ? "Nenhum produto encontrado." : "A Loja Web ainda não tem produtos."}</p>
          {!items.length && <p className="text-[12.5px] text-zinc-500 mt-1">Copie seus produtos de vídeo dos bots em um clique, ou crie um do zero.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {shown.map((p) => (
            <article key={p.id} className={`${SURFACE} p-2.5 flex gap-3 items-center group`}>
              <span className="w-[58px] aspect-[2/3] rounded-[8px] overflow-hidden bg-[#1a1b20] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.coverUrl && <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">{p.title}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  {brl(p.price)} · {p.videoCount} {p.videoCount === 1 ? "vídeo" : "vídeos"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.status === "web_active" ? (
                    <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] text-[10.5px] font-semibold bg-[#3b82f6]/14 text-[#9cc2ff]">Na loja</span>
                  ) : (
                    <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] text-[10.5px] font-semibold bg-white/[0.06] text-zinc-400">Rascunho</span>
                  )}
                  {p.videoCount === 0 && <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] text-[10.5px] font-semibold bg-amber-500/10 text-amber-300">Sem vídeos</span>}
                  {p.copiedFrom && <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] text-[10.5px] font-medium bg-white/[0.04] text-zinc-500">Cópia</span>}
                </div>
              </div>
              <button type="button" onClick={() => setEdit(p)} aria-label={`Editar ${p.title}`} className="w-9 h-9 rounded-[9px] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] shrink-0">
                <Pencil className="w-4 h-4" />
              </button>
            </article>
          ))}
        </div>
      )}

      {copyOpen && <CopyModal onClose={() => setCopyOpen(false)} />}
      {edit && <ProductEditor key={edit === "new" ? "new" : edit.id} product={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

type Candidate = Extract<Awaited<ReturnType<typeof copyCandidatesAction>>, { ok: true }>["list"][number];

function CopyModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Candidate[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    copyCandidatesAction().then((r) => (r.ok ? setList(r.list) : toast(r.error, "err")));
  }, [toast]);

  const shown = (list || []).filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const copyable = shown.filter((c) => !c.blockedReason && !c.alreadyCopied);
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = () =>
    start(async () => {
      const r = await copyProductsAction(Array.from(sel));
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast(`${r.copied} ${r.copied === 1 ? "produto copiado" : "produtos copiados"} para a Loja Web.`);
      router.refresh();
      onClose();
    });

  return (
    <Modal
      title="Copiar dos meus produtos"
      subtitle="Só produtos com entrega em vídeo podem ir para a Loja Web. A cópia é independente: mudar um não muda o outro. Os vídeos não são duplicados."
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-zinc-500 self-center">{sel.size} selecionados</span>
          <button type="button" className={BTN_SEC} onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className={BTN_PRI} onClick={run} disabled={pending || sel.size === 0}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Copiar para a Loja Web
          </button>
        </>
      }
    >
      {!list ? (
        <p className="flex items-center gap-2 text-[13px] text-zinc-500 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${INPUT} flex-1`} />
            <button type="button" className={BTN_SEC} onClick={() => setSel(new Set(copyable.map((c) => c.id)))} disabled={!copyable.length}>
              Marcar todos
            </button>
          </div>
          <ul className="grid gap-1.5 max-h-[52vh] overflow-y-auto pr-1">
            {shown.map((c) => {
              const blocked = Boolean(c.blockedReason) || c.alreadyCopied;
              const on = sel.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 p-2 rounded-[11px] border text-left transition-colors ${
                      on ? "border-[#3b82f6] bg-[#3b82f6]/[0.08]" : "border-white/[0.07] hover:border-white/[0.14]"
                    } ${blocked ? "opacity-55 cursor-not-allowed hover:border-white/[0.07]" : ""}`}
                  >
                    <span className="w-9 aspect-[2/3] rounded-[6px] overflow-hidden bg-[#1a1b20] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.coverUrl && <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-zinc-100 truncate">{c.title}</span>
                      <span className={`block text-[11.5px] ${c.blockedReason ? "text-red-300/90" : c.alreadyCopied ? "text-zinc-500" : "text-[#9cc2ff]"}`}>
                        {c.blockedReason || (c.alreadyCopied ? "Já está na Loja Web" : `Vídeo · ${c.videoCount} ${c.videoCount === 1 ? "vídeo" : "vídeos"} · ${brl(c.price)}`)}
                      </span>
                    </span>
                    {blocked ? (
                      <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
                    ) : (
                      <span className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 ${on ? "bg-[#3b82f6] border-[#3b82f6]" : "border-zinc-600"}`}>
                        {on && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

type LibVideo = Extract<Awaited<ReturnType<typeof videoPickerAction>>, { ok: true }>["library"][number];

function ProductEditor({ product, onClose }: { product: WebProductView | null; onClose: () => void }) {
  const [f, setF] = useState({
    title: product?.title || "",
    shortDescription: product?.shortDescription || "",
    description: product?.description || "",
    coverUrl: product?.coverUrl || "",
    bannerUrl: product?.bannerUrl || "",
    price: product ? String(product.price) : "",
    compareAtPrice: product?.compareAtPrice ? String(product.compareAtPrice) : "",
    duration: product?.duration || "lifetime",
    published: product ? product.status === "web_active" : true,
  });
  const [lib, setLib] = useState<LibVideo[] | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [vq, setVq] = useState("");
  const [uploading, setUploading] = useState<"cover" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    videoPickerAction(product?.id || null).then((r) => {
      if (!r.ok) return;
      setLib(r.library);
      setVideos(r.selected);
    });
  }, [product?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const byId = new Map((lib || []).map((v) => [v.id, v]));
  const move = (i: number, d: number) =>
    setVideos((list) => {
      const n = [...list];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const upload = async (kind: "cover" | "banner", file: File) => {
    setUploading(kind);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "products");
      setF((s) => ({ ...s, [kind === "cover" ? "coverUrl" : "bannerUrl"]: res.url }));
    } catch (e) {
      toast((e as Error).message || "Não foi possível enviar a imagem.", "err");
    } finally {
      setUploading(null);
    }
  };

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveWebProductAction(
        product?.id || null,
        {
          title: f.title,
          shortDescription: f.shortDescription,
          description: f.description,
          coverUrl: f.coverUrl,
          bannerUrl: f.bannerUrl,
          price: Number(String(f.price).replace(",", ".")),
          compareAtPrice: f.compareAtPrice ? Number(String(f.compareAtPrice).replace(",", ".")) : null,
          duration: f.duration,
          badge: null,
          published: f.published,
        },
        videos
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast(product ? "Produto salvo." : "Produto criado na Loja Web.");
      router.refresh();
      onClose();
    });

  const archive = () =>
    start(async () => {
      if (!product) return;
      const r = await archiveWebProductAction(product.id);
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast("Produto removido da Loja Web. Quem já comprou continua com acesso.");
      router.refresh();
      onClose();
    });

  const filteredLib = (lib || []).filter((v) => !videos.includes(v.id) && (!vq.trim() || v.title.toLowerCase().includes(vq.trim().toLowerCase())));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={product ? `Editar ${product.title}` : "Novo produto"}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => !pending && onClose()} />
      <aside className="relative w-full max-w-[640px] h-full flex flex-col bg-[#111215] border-l border-white/[0.08] shadow-2xl">
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
          <h2 className="text-[15.5px] font-semibold text-white flex-1 truncate">{product ? "Editar produto" : "Novo produto da Loja Web"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-[9px] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4">
            <ImageSlot label="Capa (2:3)" url={f.coverUrl} busy={uploading === "cover"} tall onFile={(file) => upload("cover", file)} onClear={() => setF((s) => ({ ...s, coverUrl: "" }))} />
            <div className="space-y-3 min-w-0">
              <Field label="Nome">
                <input value={f.title} onChange={set("title")} maxLength={140} className={INPUT} placeholder="Ex.: A Loba Negra Rejeitada" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <input value={f.price} onChange={set("price")} inputMode="decimal" className={INPUT} placeholder="5,00" />
                </Field>
                <Field label="Preço “de” (opcional)">
                  <input value={f.compareAtPrice} onChange={set("compareAtPrice")} inputMode="decimal" className={INPUT} placeholder="9,90" />
                </Field>
              </div>
              <Field label="Tempo de acesso">
                <select value={f.duration} onChange={set("duration")} className={INPUT}>
                  {DURATIONS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <ImageSlot label="Imagem larga do banner (16:9, opcional). Sem ela, a loja usa a capa." url={f.bannerUrl} busy={uploading === "banner"} onFile={(file) => upload("banner", file)} onClear={() => setF((s) => ({ ...s, bannerUrl: "" }))} />

          <Field label="Frase curta (aparece no banner e no card)">
            <input value={f.shortDescription} onChange={set("shortDescription")} maxLength={220} className={INPUT} placeholder="Romance, traição e uma reviravolta que ninguém espera." />
          </Field>
          <Field label="Descrição">
            <textarea value={f.description} onChange={set("description")} rows={4} maxLength={5000} className={`${INPUT} !h-auto py-2.5 resize-none`} />
          </Field>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-medium text-zinc-300">Vídeos do produto ({videos.length})</span>
              <span className="text-[11.5px] text-zinc-500">Na ordem em que o cliente assiste</span>
            </div>
            {videos.length > 0 && (
              <ol className="space-y-1.5 mb-3">
                {videos.map((id, i) => {
                  const v = byId.get(id);
                  return (
                    <li key={id} className="flex items-center gap-2.5 rounded-[10px] bg-white/[0.03] border border-white/[0.06] p-1.5 pr-2">
                      <span className="w-6 text-center text-[12px] text-zinc-500 tabular-nums">{i + 1}</span>
                      <span className="w-[64px] aspect-video rounded-[6px] overflow-hidden bg-[#1a1b20] shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {v?.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                      </span>
                      <span className="flex-1 min-w-0 text-[12.5px] text-zinc-200 truncate">{v?.title || "Vídeo"}</span>
                      <button type="button" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === videos.length - 1} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-zinc-500 hover:text-white disabled:opacity-30">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label="Tirar do produto" onClick={() => setVideos((l) => l.filter((x) => x !== id))} className="w-7 h-7 rounded-[7px] flex items-center justify-center text-zinc-500 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="rounded-[12px] border border-white/[0.07] bg-black/20">
              <div className="p-2 border-b border-white/[0.06]">
                <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Buscar na Biblioteca de vídeos" className={`${INPUT} !h-9`} />
              </div>
              {!lib ? (
                <p className="flex items-center justify-center gap-2 p-5 text-[12.5px] text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando a Biblioteca...
                </p>
              ) : filteredLib.length === 0 ? (
                <p className="p-5 text-center text-[12.5px] text-zinc-500">{lib.length ? "Nenhum vídeo encontrado." : "Sua Biblioteca não tem vídeos prontos."}</p>
              ) : (
                <ul className="max-h-[260px] overflow-y-auto p-1.5 space-y-1">
                  {filteredLib.slice(0, 120).map((v) => (
                    <li key={v.id}>
                      <button type="button" onClick={() => setVideos((l) => [...l, v.id])} className="w-full flex items-center gap-2.5 p-1.5 rounded-[9px] text-left hover:bg-white/[0.04]">
                        <span className="w-[64px] aspect-video rounded-[6px] overflow-hidden bg-[#1a1b20] shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] text-zinc-200 truncate">{v.title}</span>
                          <span className="block text-[11px] text-zinc-500 truncate">{v.products.length ? `Em: ${v.products.join(", ")}` : "Sem produto"}</span>
                        </span>
                        <Plus className="w-4 h-4 text-[#7fb0ff] shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-[12px] border border-white/[0.07] p-3 cursor-pointer">
            <input type="checkbox" checked={f.published} onChange={(e) => setF((s) => ({ ...s, published: e.target.checked }))} className="w-4 h-4 accent-[#3b82f6]" />
            <span>
              <span className="block text-[13px] font-medium text-zinc-200">Mostrar na loja</span>
              <span className="block text-[12px] text-zinc-500">Desmarcado, o produto fica como rascunho e ninguém vê.</span>
            </span>
          </label>
          {error && <p className="rounded-[10px] border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5 text-[13px] text-red-300">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-white/[0.07] flex items-center gap-2">
          {product && (
            <button type="button" onClick={archive} disabled={pending} className={`${BTN_SEC} hover:!text-red-300`}>
              <Trash2 className="w-4 h-4" /> Tirar da loja
            </button>
          )}
          <button type="button" onClick={onClose} disabled={pending} className={`${BTN_SEC} ml-auto`}>
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={pending || uploading !== null} className={BTN_PRI}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ImageSlot({ label, url, busy, tall = false, onFile, onClear }: { label: string; url: string; busy: boolean; tall?: boolean; onFile: (f: File) => void; onClear: () => void }) {
  return (
    <div>
      {!tall && <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">{label}</span>}
      <label className={`relative block rounded-[12px] border border-dashed border-white/[0.14] bg-white/[0.02] hover:border-[#3b82f6]/60 cursor-pointer overflow-hidden ${tall ? "aspect-[2/3]" : "aspect-[21/7]"}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[11.5px] text-zinc-500 px-2 text-center">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            {tall ? label : "Enviar imagem"}
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {url && (
        <button type="button" onClick={onClear} className="mt-1 text-[11.5px] text-zinc-500 hover:text-red-300">
          Remover imagem
        </button>
      )}
    </div>
  );
}
