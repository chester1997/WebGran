"use client";

/** Campos reutilizáveis do editor do Fluxo Básico. */
import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Music, Trash2, Upload, X } from "lucide-react";
import type { ButtonColor } from "@/lib/flows/basic-config";
import { CARD, INPUT, useToast } from "../_components/flow-ui";

export function Card({ title, sub, right, children, tone }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; tone?: "warn" }) {
  return (
    <section className={`${CARD} ${tone === "warn" ? "!border-amber-500/25" : ""}`}>
      <header className={`px-5 pt-4 pb-3.5 flex items-start justify-between gap-3 ${children ? "border-b border-white/[0.07]" : ""}`}>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {sub && <p className="text-[13px] text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        {right}
      </header>
      {children && <div className="px-5 py-4 flex flex-col gap-4">{children}</div>}
    </section>
  );
}

export function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <span className="flex justify-between gap-2 text-[12.5px] font-semibold text-zinc-300">{children}{aside}</span>;
}

export function TextField({ id, label, value, onChange, placeholder, hint, max = 300 }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label aside={max <= 100 ? <span className="font-normal text-zinc-600 tabular-nums">{value.length}/{max}</span> : undefined}>{label}</Label>
      <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function NumField({ id, label, value, onChange, hint, step = 1, min = 0, max, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: ReactNode; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <span className="flex items-center gap-2">
        <input id={id} type="number" inputMode="decimal" step={step} min={min} max={max} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={INPUT} />
        {suffix && <span className="text-[12.5px] text-zinc-500 shrink-0">{suffix}</span>}
      </span>
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function MoneyField({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const [text, setText] = useState(value ? value.toFixed(2).replace(".", ",") : "");
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
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
        className={INPUT}
      />
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

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
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label aside={<span className="font-normal text-zinc-600 tabular-nums">{value.length}/{max}</span>}>{label}</Label>
      <textarea id={id} ref={ref} rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} resize-y leading-relaxed min-h-[84px]`} />
      <span className="flex flex-wrap items-center gap-1.5">
        {vars.length > 0 && <span className="text-[11.5px] text-zinc-500 mr-0.5">Variáveis:</span>}
        {vars.map((v) => (
          <button key={v} type="button" onClick={() => insert(v)} className="font-mono text-[11.5px] px-2 py-0.5 rounded-[7px] border border-[#3984FF]/30 text-[#60a5fa] bg-[#3984FF]/[0.1] hover:brightness-125">{v}</button>
        ))}
        <span className="text-[11.5px] text-zinc-500 ml-1.5 mr-0.5">HTML:</span>
        {(["b", "i", "u", "s", "code"] as const).map((t) => (
          <button key={t} type="button" onClick={() => insert(`<${t}>`, `</${t}>`)} className="font-mono text-[11.5px] px-2 py-0.5 rounded-[7px] border border-white/[0.13] text-zinc-400 hover:text-white">{`<${t}>`}</button>
        ))}
      </span>
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ title, desc, checked, onChange }: { title: ReactNode; desc?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-white">{title}</p>
        {desc && <p className="text-[12.5px] text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={typeof title === "string" ? title : "Ligar"} />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#3984FF]" : "bg-zinc-700"}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label && <Label>{label}</Label>}
      <div role="group" aria-label={label} className="flex flex-wrap gap-0.5 p-[3px] rounded-[10px] bg-[#0d0e12] border border-white/[0.08]">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`flex-1 px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium whitespace-nowrap ${value === v ? "bg-[#25272d] text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/** Cartões de escolha (como "Posição do código Pix"). */
export function ChoiceCards<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string, string][]; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label && <Label>{label}</Label>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
        {options.map(([v, title, sub]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`text-left px-3.5 py-3 rounded-xl border transition-colors ${value === v ? "border-[#3984FF] bg-[#3984FF]/[0.08]" : "border-white/[0.1] bg-[#0d0e12] hover:border-white/20"}`}>
            <span className="flex items-center gap-2"><span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${value === v ? "border-[4px] border-[#3984FF]" : "border-white/25"}`} /><span className="text-[13px] font-semibold text-white">{title}</span></span>
            <span className="block text-[12px] text-zinc-500 mt-1 pl-5 font-mono break-all">{sub}</span>
          </button>
        ))}
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
    <div role="group" aria-label="Cor do botão" className="flex gap-1.5">
      {COLOR_OPTS.map(([c, l, bg]) => (
        <button
          key={c}
          type="button"
          title={l}
          aria-label={l}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={`w-[24px] h-[24px] rounded-full border-2 ${bg} ${value === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#141519]" : "border-transparent"}`}
        />
      ))}
    </div>
  );
}

export function Select({ id, label, value, onChange, options, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function ItemShell({ title, onRemove, children, right }: { title: ReactNode; onRemove?: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0d0e12] p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[13.5px] text-white min-w-0 truncate">{title}</b>
        <span className="flex items-center gap-1 shrink-0">
          {right}
          {onRemove && (
            <button type="button" aria-label="Remover" onClick={onRemove} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
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

export async function uploadFlowFile(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
    return (await uploadOptimizedImage(file, "banners")).url;
  }
  const fd = new FormData();
  fd.append("file", file);
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
    <div className="relative w-[92px] h-[92px] rounded-xl overflow-hidden border border-white/[0.13] bg-[#0b0c10] shrink-0">
      {isVideoUrl(url) ? (
        <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
      ) : isAudioUrl(url) ? (
        <span className="w-full h-full flex items-center justify-center text-[#60a5fa]"><Music className="w-6 h-6" /></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
      {onRemove && (
        <button type="button" aria-label="Remover mídia" onClick={onRemove} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
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
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#0d0e12] p-2">
            <audio src={value} controls className="h-9 flex-1 min-w-0" />
            <button type="button" onClick={() => onChange("")} aria-label="Remover áudio" className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          </div>
        ) : (
          <MediaThumb url={value} onRemove={() => onChange("")} />
        )
      ) : (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="self-start inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] border border-dashed border-white/[0.2] text-[13px] font-medium text-[#60a5fa] hover:bg-white/[0.03]">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : accept === "audio" ? <Upload className="w-4 h-4" /> : <ImagePlus className="w-4 h-4" />}
          {busy ? "Enviando…" : accept === "audio" ? "Escolher áudio" : "Escolher mídia"}
        </button>
      )}
      <input ref={ref} type="file" accept={ACCEPT[accept]} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
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
        <select id={id} value={known ? value : ""} onChange={(e) => (e.target.value === "__manual" ? setManual(true) : onChange(e.target.value))} className={INPUT}>
          <option value="">Escolha um grupo ou canal…</option>
          {chats.map((c) => <option key={c.chatId} value={c.chatId}>{c.title}</option>)}
          <option value="__manual">Digitar o ID…</option>
        </select>
      ) : (
        <span className="flex gap-2">
          <input id={id} value={value} placeholder="-1001234567890" maxLength={20} onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))} className={INPUT} />
          {chats.length > 0 && <button type="button" onClick={() => setManual(false)} className="shrink-0 px-3 rounded-[10px] border border-white/[0.13] text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">Lista</button>}
        </span>
      )}
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </div>
  );
}
