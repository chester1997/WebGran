"use client";

/** Campos reutilizáveis do editor do Fluxo Básico. */
import { Children, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Info, Loader2, Music, Trash2, Upload, X } from "lucide-react";
import type { ButtonColor } from "@/lib/flows/basic-config";
import { CARD, INPUT, useToast } from "../_components/flow-ui";

/** Tons de texto do editor (contraste ≥ 4.5:1 sobre #121316). */
const HINT = "text-[12.5px] leading-[1.45] text-[#8b8b94]";

/** Tira o emoji decorativo do começo dos títulos ("🛡️ Anti-Clone" → "Anti-Clone"). */
const plain = (n: ReactNode) => (typeof n === "string" ? n.replace(/^(?:\p{Extended_Pictographic}|️|‍|\s)+/u, "") : n);

/**
 * Grupo do editor, no estilo de ajustes:
 * - com conteúdo: título pequeno por fora e as linhas dentro de uma superfície;
 * - sem conteúdo e com controle à direita: uma linha só (título, descrição, controle);
 * - sem conteúdo e sem controle: nota explicativa discreta.
 */
export function Card({ title, sub, right, children, tone }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; tone?: "warn" }) {
  const rows = Children.toArray(children).filter(Boolean);
  const warn = tone === "warn" ? "!border-amber-500/25" : "";

  if (!rows.length && !right) {
    return (
      <aside className="flex gap-3 px-1 py-0.5" data-flow-note="">
        <Info className="w-4 h-4 mt-[2px] shrink-0 text-[#8b8b94]" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-300">{plain(title)}</p>
          {sub && <p className={`${HINT} mt-0.5`}>{sub}</p>}
        </div>
      </aside>
    );
  }

  if (!rows.length) {
    return (
      <section className={`${CARD} ${warn} flex items-center gap-4 px-[18px] py-3.5`} data-flow-group="">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-medium text-white">{plain(title)}</h3>
          {sub && <p className={`${HINT} mt-0.5`}>{sub}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2" data-flow-group="">
      <header className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-zinc-300 tracking-[0.005em]">{plain(title)}</h3>
          {sub && <p className={`${HINT} mt-0.5`}>{sub}</p>}
        </div>
        {right && <div className="shrink-0 flex items-center">{right}</div>}
      </header>
      <div className={`${CARD} ${warn} divide-y divide-white/[0.06]`}>
        {rows.map((r, i) => (
          <div key={i} className="px-[18px] py-4 flex flex-col gap-3.5 min-w-0">{r}</div>
        ))}
      </div>
    </section>
  );
}

export function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <span className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-zinc-200">{children}{aside}</span>;
}

const Hint = ({ children }: { children?: ReactNode }) => (children ? <span className={HINT}>{children}</span> : null);
const Count = ({ n, max }: { n: number; max: number }) => <span className="font-normal text-[12px] text-[#8b8b94] tabular-nums">{n}/{max}</span>;

export function TextField({ id, label, value, onChange, placeholder, hint, max = 300 }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label aside={max <= 100 ? <Count n={value.length} max={max} /> : undefined}>{label}</Label>
      <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      <Hint>{hint}</Hint>
    </label>
  );
}

export function NumField({ id, label, value, onChange, hint, step = 1, min = 0, max, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: ReactNode; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <span className="flex items-center gap-2">
        <input id={id} type="number" inputMode="decimal" step={step} min={min} max={max} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
        {suffix && <span className="text-[13px] text-[#8b8b94] shrink-0">{suffix}</span>}
      </span>
      <Hint>{hint}</Hint>
    </label>
  );
}

export function MoneyField({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const [text, setText] = useState(value ? value.toFixed(2).replace(".", ",") : "");
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <span className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8b8b94]">R$</span>
        <input
          id={id}
          inputMode="decimal"
          placeholder="29,90"
          value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d,.]/g, "");
            setText(t);
            const n = Number(t.replace(/\./g, "").replace(",", "."));
            onChange(Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
          }}
          className={`${INPUT} !pl-9 tabular-nums`}
        />
      </span>
      <Hint>{hint}</Hint>
    </label>
  );
}

const TAGS: [string, ReactNode, string][] = [
  ["b", <b key="b">B</b>, "Negrito"],
  ["i", <i key="i">I</i>, "Itálico"],
  ["u", <u key="u">U</u>, "Sublinhado"],
  ["s", <s key="s">S</s>, "Riscado"],
  ["code", <span key="c" className="font-mono text-[11px]">{"</>"}</span>, "Código"],
];

/** Editor de mensagem: barra com variáveis e formatação em cima, contador no canto. */
export function AreaField({ id, label, value, onChange, vars, rows = 5, max = 4000, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; vars: string[]; rows?: number; max?: number; hint?: ReactNode }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (before: string, after = "") => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? s;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    onChange(next.slice(0, max));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + before.length + (e - s) + after.length;
      ta.setSelectionRange(pos, pos);
    });
  };
  // Mantém o foco no texto ao clicar na barra (a prévia segue destacando esta mensagem).
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const tool = "h-7 min-w-7 px-1.5 rounded-[6px] text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors";
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id}><Label>{label}</Label></label>
      <div className="rounded-[10px] border border-white/[0.09] bg-[#0d0e11] overflow-hidden transition-[border-color,box-shadow] focus-within:border-[#3b82f6] focus-within:ring-[3px] focus-within:ring-[#3b82f6]/15">
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.06] bg-[#16171b] overflow-x-auto">
          {vars.length > 0 && <span className="text-[11.5px] text-[#8b8b94] px-1 shrink-0">Inserir</span>}
          {vars.map((v) => (
            <button key={v} type="button" onMouseDown={keep} onClick={() => insert(v)} title={`Inserir ${v}`} className="shrink-0 h-7 px-2 rounded-[6px] font-mono text-[11.5px] text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors">{v}</button>
          ))}
          {vars.length > 0 && <span className="w-px h-4 mx-1 bg-white/[0.1] shrink-0" />}
          {TAGS.map(([t, glyph, name]) => (
            <button key={t} type="button" onMouseDown={keep} onClick={() => insert(`<${t}>`, `</${t}>`)} title={name} aria-label={name} className={`${tool} shrink-0`}>{glyph}</button>
          ))}
          <span className="ml-auto pl-2 shrink-0"><Count n={value.length} max={max} /></span>
        </div>
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          maxLength={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full bg-transparent px-3.5 py-3 text-[14px] leading-[1.6] text-white outline-none resize-y min-h-[88px] placeholder:text-zinc-600"
        />
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

/** Linha com título, descrição e interruptor à direita. */
export function Toggle({ title, desc, checked, onChange }: { title: ReactNode; desc?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-white">{plain(title)}</p>
        {desc && <p className={`${HINT} mt-0.5`}>{desc}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={typeof title === "string" ? String(plain(title)) : "Ligar"} />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121316] ${checked ? "bg-[#3b82f6]" : "bg-[#3f3f46]"}`}
    >
      <span className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-transform duration-200 motion-reduce:transition-none ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

/** Controle segmentado (2 a 4 opções curtas). */
export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label && <Label>{label}</Label>}
      <div role="group" aria-label={label} className="inline-flex self-start max-w-full flex-wrap gap-0.5 p-[2px] rounded-[9px] bg-[#0d0e11] border border-white/[0.07]">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`px-3 h-[30px] rounded-[7px] text-[12.5px] font-medium whitespace-nowrap transition-colors ${value === v ? "bg-[#26272c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {plain(l)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Opções com título e exemplo (como "Posição do código Pix"). */
export function ChoiceCards<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string, string][]; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label && <Label>{label}</Label>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
        {options.map(([v, title, sub]) => {
          const on = value === v;
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => onChange(v)} className={`text-left px-3.5 py-3 rounded-[10px] border transition-colors ${on ? "border-[#3b82f6]/70 bg-[#3b82f6]/[0.06]" : "border-white/[0.08] bg-[#0d0e11] hover:border-white/[0.16]"}`}>
              <span className="flex items-center gap-2">
                <span className={`w-[14px] h-[14px] rounded-full shrink-0 ${on ? "border-[4px] border-[#3b82f6]" : "border-[1.5px] border-white/25"}`} />
                <span className="text-[13px] font-medium text-white">{plain(title)}</span>
              </span>
              <span className="block text-[12px] text-[#8b8b94] mt-1 pl-[22px] font-mono break-all">{sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const COLOR_OPTS: [ButtonColor, string, string][] = [
  ["none", "Sem cor (padrão do Telegram)", "bg-transparent border-dashed !border-white/40"],
  ["blue", "Azul", "bg-[#3a7bd5]"],
  ["green", "Verde", "bg-[#2e9e5b]"],
  ["red", "Vermelho", "bg-[#d14b4b]"],
];
export function ColorPick({ value, onChange }: { value: ButtonColor; onChange: (v: ButtonColor) => void }) {
  return (
    <div role="group" aria-label="Cor do botão" className="flex gap-2">
      {COLOR_OPTS.map(([c, l, bg]) => (
        <button
          key={c}
          type="button"
          title={l}
          aria-label={l}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={`w-[22px] h-[22px] rounded-full border-2 transition-shadow ${bg} ${value === c ? "ring-2 ring-white/90 ring-offset-2 ring-offset-[#121316]" : "border-transparent hover:ring-1 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#121316]"}`}
        />
      ))}
    </div>
  );
}

export function Select({ id, label, value, onChange, options, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} cursor-pointer`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Hint>{hint}</Hint>
    </label>
  );
}

/** Item de uma lista (plano, oferta, botão...), aninhado dentro de um grupo. */
export function ItemShell({ title, onRemove, children, right }: { title: ReactNode; onRemove?: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-white/[0.07] bg-[#0f1013] p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium text-white min-w-0 truncate">{plain(title)}</span>
        <span className="flex items-center gap-0.5 shrink-0">
          {right}
          {onRemove && (
            <button type="button" aria-label="Remover" title="Remover" onClick={onRemove} className="w-8 h-8 rounded-[8px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"><Trash2 className="w-4 h-4" /></button>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mídia                                                               */
/* ------------------------------------------------------------------ */
export type MediaAccept = "image" | "visual" | "audio";

export async function uploadFlowFile(file: File, asDocument = false): Promise<string> {
  if (!asDocument && file.type.startsWith("image/")) {
    const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
    return (await uploadOptimizedImage(file, "banners")).url;
  }
  const fd = new FormData();
  fd.append("file", file);
  if (asDocument) fd.append("kind", "file");
  const res = await fetch("/api/flows/media", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(data?.error || "Não foi possível enviar o arquivo.");
  return data.url as string;
}

export const isVideoUrl = (u: string) => /\.(mp4|mov)(\?|$)/i.test(u);
export const isAudioUrl = (u: string) => /\.(ogg|mp3|m4a|oga|opus)(\?|$)/i.test(u);

const ACCEPT: Record<MediaAccept, string> = {
  image: "image/jpeg,image/png,image/webp",
  visual: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime",
  audio: "audio/ogg,audio/mpeg,audio/mp4,.ogg,.mp3,.m4a,.opus",
};

export function MediaThumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="relative w-[84px] h-[84px] rounded-[10px] overflow-hidden ring-1 ring-inset ring-white/[0.08] bg-[#0b0c10] shrink-0">
      {isVideoUrl(url) ? (
        <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
      ) : isAudioUrl(url) ? (
        <span className="w-full h-full flex items-center justify-center text-[#60a5fa]"><Music className="w-6 h-6" /></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
      {onRemove && (
        <button type="button" aria-label="Remover mídia" onClick={onRemove} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/90"><X className="w-3 h-3" /></button>
      )}
    </div>
  );
}

/** Um arquivo (mídia opcional, áudio). */
export function MediaField({ label, value, onChange, accept, hint }: { label: string; value: string; onChange: (url: string) => void; accept: MediaAccept; hint?: ReactNode }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File) => {
    setBusy(true);
    try {
      onChange(await uploadFlowFile(f));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha no envio.", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      {value ? (
        accept === "audio" ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#0d0e11] p-2">
            <audio src={value} controls className="h-9 flex-1 min-w-0" />
            <button type="button" onClick={() => onChange("")} aria-label="Remover áudio" className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          </div>
        ) : (
          <MediaThumb url={value} onRemove={() => onChange("")} />
        )
      ) : (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="self-start inline-flex items-center gap-2 h-9 px-3.5 rounded-[9px] border border-white/[0.11] bg-[#17181c] hover:bg-[#1d1e23] text-[13px] font-medium text-zinc-100 transition-colors disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : accept === "audio" ? <Upload className="w-4 h-4 text-zinc-400" /> : <ImagePlus className="w-4 h-4 text-zinc-400" />}
          {busy ? "Enviando…" : accept === "audio" ? "Escolher áudio" : "Escolher mídia"}
        </button>
      )}
      <input ref={ref} type="file" accept={ACCEPT[accept]} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      <Hint>{hint}</Hint>
    </div>
  );
}

/** Grupo/canal: lista os grupos onde os bots são admin, ou ID digitado. */
export function GroupField({ id, label, value, onChange, chats, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; chats: { chatId: string; title: string }[]; hint?: ReactNode }) {
  const known = chats.some((c) => c.chatId === value);
  const [manual, setManual] = useState(!!value && !known);
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      {!manual && chats.length > 0 ? (
        <select id={id} value={known ? value : ""} style={{ cursor: "pointer" }} onChange={(e) => (e.target.value === "__manual" ? setManual(true) : onChange(e.target.value))} className={INPUT}>
          <option value="">Escolha um grupo ou canal…</option>
          {chats.map((c) => <option key={c.chatId} value={c.chatId}>{c.title}</option>)}
          <option value="__manual">Digitar o ID…</option>
        </select>
      ) : (
        <span className="flex gap-2">
          <input id={id} value={value} placeholder="-1001234567890" maxLength={20} onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))} className={INPUT} />
          {chats.length > 0 && <button type="button" onClick={() => setManual(false)} className="shrink-0 px-3 rounded-[9px] border border-white/[0.11] bg-[#17181c] text-[12.5px] text-zinc-300 hover:bg-[#1d1e23]">Lista</button>}
        </span>
      )}
      <Hint>{hint}</Hint>
    </div>
  );
}
