"use client";

/**
 * Janelas de configuração dos blocos do Fluxo Avançado.
 * Cada bloco tem o seu formulário; todos editam um rascunho que só vale ao clicar em Salvar.
 * A cor de destaque de cada janela é a cor do bloco (variável CSS --c).
 */
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AtSign,
  Bot,
  Check,
  Image as ImageIcon,
  Clock,
  Film,
  Hash,
  Info,
  Keyboard,
  Languages,
  Lightbulb,
  Loader2,
  Megaphone,
  Mic,
  Music,
  Phone,
  PlayCircle,
  Plus,
  PlusCircle,
  RefreshCw,
  ShoppingCart,
  Tag,
  Target,
  Trash2,
  Type,
  Upload,
  Wallet,
  X,
  ChevronDown,
  ChevronUp,
  Flag,
} from "lucide-react";
import { jsonList, type AbVariant, type CondRule, type MsgButton, type MsgItem, type NodeType, type RuleKind } from "@/lib/flows/advanced-graph";
import { useToast } from "../_components/flow-ui";
import { uploadFlowFile } from "./flow-fields";
import type { FlowChat } from "./BasicFlowEditor";

type Values = Record<string, string | number>;
type Icon = ComponentType<{ className?: string; style?: CSSProperties }>;
export interface FormProps {
  type: NodeType;
  draft: Values;
  set: (key: string, value: string | number) => void;
  chats: FlowChat[];
  storeBots: { id: string; username: string; displayName?: string | null }[];
  currentBotIds: string[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => Number(v) || 0;
const VARS = ["{nome}", "{sobrenome}", "{username}", "{cidade}"];

/* Cor do bloco com transparência (sem depender de hex). */
const tint = (pct: number) => `color-mix(in srgb, var(--c) ${pct}%, transparent)`;
const FIELD = "w-full bg-[#0c0d10] border border-white/[0.09] hover:border-white/[0.14] focus:border-[color:var(--c)] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors placeholder:text-zinc-600";

/* ------------------------------------------------------------------ */
/* Moldura da janela                                                   */
/* ------------------------------------------------------------------ */
export function BlockModal({
  title,
  subtitle,
  color,
  icon: IconCmp,
  wide,
  onClose,
  onSave,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: Icon;
  wide?: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSave]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ "--c": color } as CSSProperties}
        className={`w-full ${wide ? "sm:max-w-[700px]" : "sm:max-w-[560px]"} max-h-[92dvh] flex flex-col bg-[#0f1012] border border-white/[0.09] rounded-t-[18px] sm:rounded-[18px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]`}
      >
        <header className="flex items-center gap-3.5 px-6 py-5 border-b border-white/[0.07] shrink-0">
          <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: tint(16), border: `1px solid ${tint(30)}`, color }}>
            <IconCmp className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] font-semibold text-white leading-tight">{title}</h3>
            <p className="text-[13.5px] text-zinc-400 truncate">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-[8px] text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center shrink-0">
            <X className="w-[18px] h-[18px]" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-5 flex flex-col gap-5">{children}</div>
        <footer className="flex items-center gap-2 px-6 py-4 border-t border-white/[0.07] shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 mr-auto text-[12px] text-zinc-500">
            <Kbd>Esc</Kbd> fecha · <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> salva
          </span>
          <button type="button" onClick={onClose} className="ml-auto sm:ml-0 h-10 px-4 rounded-[10px] border border-white/[0.12] text-[14px] font-medium text-zinc-200 hover:bg-white/[0.05]">
            Cancelar
          </button>
          <button type="button" onClick={onSave} className="h-10 px-4 rounded-[10px] bg-[#3b82f6] hover:bg-[#2f74e6] text-white text-[14px] font-semibold inline-flex items-center gap-1.5 shadow-[0_8px_20px_-10px_rgba(59,130,246,0.8)]">
            <Check className="w-4 h-4" />Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="px-1.5 py-0.5 rounded-[5px] border border-white/[0.1] bg-white/[0.04] font-sans text-[11px] text-zinc-400">{children}</kbd>
);

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */
function Field({ label, hint, aside, action, children }: { label: ReactNode; hint?: ReactNode; aside?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-white">{label}</span>
        {aside && <span className="text-[12px] text-zinc-500">{aside}</span>}
        {action}
      </div>
      {children}
      {hint && <p className="text-[12.5px] leading-[1.5] text-zinc-500">{hint}</p>}
    </section>
  );
}

function InfoNote({ children, icon: I = Info }: { children: ReactNode; icon?: Icon }) {
  return (
    <div className="flex gap-2.5 rounded-[10px] border border-white/[0.08] bg-[#121316] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-zinc-400">
      <I className="w-4 h-4 mt-px shrink-0 text-zinc-500" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className="relative inline-flex h-[24px] w-[42px] shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--c)" : "#2b2c31" }}>
      <span className={`absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : ""}`} />
    </button>
  );
}

function ToggleRow({ title, desc, on, set, children }: { title: ReactNode; desc?: string; on: boolean; set: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-white/[0.08] bg-[#121316] px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-white">{title}</span>
          {desc && <span className="block text-[12.5px] text-zinc-500 mt-0.5">{desc}</span>}
        </span>
        <Switch on={on} set={set} label={typeof title === "string" ? title : "Ligar"} />
      </div>
      {on && children && <div className="mt-3.5 pt-3.5 border-t border-white/[0.07]">{children}</div>}
    </div>
  );
}

/** Cartões de escolha com ícone, título e descrição. */
function Cards<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: { v: T; title: string; desc?: string; icon: Icon }[] }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, minmax(0, 1fr))` }}>
      {options.map(({ v, title, desc, icon: I }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => set(v)}
            className="flex items-start gap-3 text-left rounded-[12px] border px-3.5 py-3 transition-colors"
            style={on ? { borderColor: tint(70), background: tint(10) } : { borderColor: "rgba(255,255,255,0.08)", background: "#121316" }}
          >
            <span className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: on ? tint(22) : "rgba(255,255,255,0.05)", color: on ? "var(--c)" : "#a1a1aa" }}>
              <I className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-white">{title}</span>
              {desc && <span className="block text-[12.5px] text-zinc-500 mt-0.5 leading-snug">{desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Ladrilhos com ícone em cima (tipo de resposta, tipo de venda). */
function Tiles<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: { v: T; title: string; icon: Icon }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ v, title, icon: I }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => set(v)}
            className="flex flex-col items-center gap-2 rounded-[12px] border py-3.5 px-1 transition-colors"
            style={on ? { borderColor: tint(75), background: tint(10) } : { borderColor: "rgba(255,255,255,0.08)", background: "#121316" }}
          >
            <span className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: on ? tint(22) : "rgba(255,255,255,0.05)", color: on ? "var(--c)" : "#a1a1aa" }}>
              <I className="w-4 h-4" />
            </span>
            <span className="text-[12.5px] font-semibold text-center leading-tight" style={{ color: on ? "var(--c)" : "#e4e4e7" }}>{title}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Número grande + unidades lado a lado (seg, min, horas...). */
function Amount<U extends string>({ value, set, units, unit, setUnit }: { value: number; set: (v: number) => void; units?: [U, string][]; unit?: U; setUnit?: (u: U) => void }) {
  return (
    <div className="flex gap-2">
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => set(Math.max(0, Number(e.target.value)))}
        className="w-[120px] h-12 bg-[#0c0d10] border border-white/[0.09] focus:border-[color:var(--c)] rounded-[10px] text-center text-[18px] font-semibold text-white outline-none tabular-nums"
      />
      {units && setUnit && (
        <div className="flex p-1 rounded-[10px] border border-white/[0.09] bg-[#0c0d10]">
          {units.map(([u, l]) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className="px-3.5 rounded-[7px] text-[13.5px] font-medium transition-colors" style={unit === u ? { background: "var(--c)", color: "#0b0c0f" } : { color: "#a1a1aa" }}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pills({ items }: { items: [string, () => void, boolean?][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([label, fn, on]) => (
        <button key={label} type="button" onClick={fn} className="h-7 px-3 rounded-full border text-[12.5px] transition-colors" style={on ? { borderColor: tint(70), color: "var(--c)", background: tint(10) } : { borderColor: "rgba(255,255,255,0.1)", color: "#d4d4d8", background: "rgba(255,255,255,0.03)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Botão pequeno colorido ("+ Texto", "+ Caminho"...). */
function AddChip({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-7 px-2.5 rounded-[8px] text-[12.5px] font-semibold border transition-opacity disabled:opacity-40 inline-flex items-center gap-1"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/** Texto com contador e variáveis clicáveis embaixo. */
function TextArea({ value, set, max = 4096, rows = 4, vars = VARS, placeholder }: { value: string; set: (v: string) => void; max?: number; rows?: number; vars?: string[]; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (v: string) => {
    const ta = ref.current;
    const s = ta?.selectionStart ?? value.length;
    const e = ta?.selectionEnd ?? s;
    set((value.slice(0, s) + v + value.slice(e)).slice(0, max));
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(s + v.length, s + v.length);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <textarea ref={ref} rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={`${FIELD} resize-y leading-[1.55]`} />
      <div className="flex items-center gap-1.5 flex-wrap">
        {vars.map((v) => (
          <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="h-7 px-2 rounded-[7px] font-mono text-[12px] text-zinc-300 bg-white/[0.03] border border-white/[0.09] hover:text-white hover:border-white/[0.2]">
            {v}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-zinc-500 tabular-nums">{value.length}/{max}</span>
      </div>
    </div>
  );
}

const ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/gif,image/webp",
  video: "video/mp4,video/quicktime",
  audio: "audio/ogg,audio/mpeg,audio/mp4,.ogg,.mp3,.m4a,.opus",
  file: ".pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.epub,.txt,.csv",
  visual: "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,audio/ogg,audio/mpeg,.ogg,.mp3,.m4a",
};
const DROP: Record<string, [string, string]> = {
  image: ["Clique ou arraste uma imagem", "JPG, PNG, GIF ou WebP · até 4MB"],
  video: ["Clique ou arraste um vídeo", "MP4 ou MOV · até 4MB"],
  audio: ["Clique ou arraste um áudio", "MP3, OGG ou M4A · até 4MB"],
  file: ["Clique ou arraste um arquivo", "PDF, ZIP, RAR, 7Z, Word, Excel, PowerPoint, EPUB, TXT ou CSV · até 4MB"],
  visual: ["Clique para enviar foto, vídeo ou áudio", "JPG, PNG, GIF, MP4, MP3 ou OGG · até 4MB"],
};

/** Área de envio (clique ou arraste), com prévia e remover. */
function Dropzone({ kind, url, set, icon: I, onName, compact }: { kind: keyof typeof ACCEPT; url: string; set: (v: string) => void; icon: Icon; onName?: (n: string) => void; compact?: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const send = async (f: File) => {
    setBusy(true);
    try {
      set(await uploadFlowFile(f, kind === "file"));
      onName?.(f.name);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha no envio.", "err");
    } finally {
      setBusy(false);
    }
  };
  if (url) {
    const isVid = /\.(mp4|mov)(\?|$)/i.test(url);
    const isAud = /\.(ogg|oga|opus|mp3|m4a)(\?|$)/i.test(url);
    const isImg = !isVid && !isAud && (kind === "image" || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url));
    return (
      <div className="flex items-center gap-3 rounded-[12px] border border-white/[0.09] bg-[#121316] p-3">
        {isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-16 h-16 rounded-[9px] object-cover shrink-0" />
        ) : isVid ? (
          <video src={url} className="w-16 h-16 rounded-[9px] object-cover shrink-0" muted playsInline preload="metadata" />
        ) : isAud ? (
          <audio src={url} controls className="h-9 flex-1 min-w-0" />
        ) : (
          <span className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: tint(16), color: "var(--c)" }}><I className="w-5 h-5" /></span>
        )}
        {!isAud && <span className="flex-1 min-w-0 text-[13px] text-zinc-300 truncate">{decodeURIComponent(url.split("/").pop() || "arquivo")}</span>}
        <button type="button" onClick={() => set("")} aria-label="Remover arquivo" className="w-9 h-9 rounded-[9px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }
  const [title, hint] = DROP[kind];
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) send(f); }}
        className={`w-full flex flex-col items-center justify-center gap-2 ${compact ? "py-5" : "py-9"} rounded-[14px] border border-dashed transition-colors`}
        style={{ borderColor: over ? "var(--c)" : "rgba(255,255,255,0.14)", background: over ? tint(6) : "#0c0d10" }}
      >
        <span className="w-11 h-11 rounded-[11px] flex items-center justify-center" style={{ background: tint(16), color: "var(--c)" }}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <I className="w-5 h-5" />}
        </span>
        <span className="text-[14px] font-semibold text-white">{busy ? "Enviando…" : title}</span>
        <span className="text-[12px] text-zinc-500 px-4 text-center">{hint}</span>
      </button>
      <input ref={ref} type="file" accept={ACCEPT[kind]} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
    </>
  );
}

const iconBtn = "w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent";
function moveItem<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const COLORS: [string, string][] = [["blue", "#2f5fae"], ["green", "#1f7a46"], ["red", "#9b2f2f"]];
function ColorRow({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[90px] text-[13px] text-zinc-400">{label}</span>
      <div className="flex gap-1.5">
        {COLORS.map(([k, hex]) => (
          <button key={k} type="button" aria-label={`${label}: ${k}`} aria-pressed={value === k} onClick={() => set(value === k ? "none" : k)} className="w-7 h-7 rounded-[7px] transition-shadow" style={{ background: hex, boxShadow: value === k ? "0 0 0 2px #0f1012, 0 0 0 4px #fff" : "none" }} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulários                                                         */
/* ------------------------------------------------------------------ */
export function BlockForm({ type, draft, set, chats, storeBots, currentBotIds }: FormProps) {
  const v = (k: string) => str(draft[k]);
  const bool = (k: string) => num(draft[k]) === 1;
  const setJson = (k: string, list: unknown[]) => set(k, JSON.stringify(list));

  switch (type) {
    case "inicio":
      return (
        <>
          <div className="flex items-center gap-3 rounded-[12px] px-4 py-3.5" style={{ background: tint(10), border: `1px solid ${tint(30)}` }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: tint(20), color: "var(--c)" }}><Bot className="w-[18px] h-[18px]" /></span>
            <span>
              <span className="block text-[14px] font-semibold text-white">Lead</span>
              <span className="block text-[13px]" style={{ color: "var(--c)" }}>enviou <b className="text-white font-mono">/start</b></span>
            </span>
          </div>
          <p className="text-[13px] text-zinc-400">O fluxo começa sempre que o lead envia <b className="text-zinc-200">/start</b> para o bot (ou toca em “Iniciar”).</p>
          <ToggleRow title="Ignorar /start repetido" desc="O bot só responde ao /start na primeira vez que o lead entra" on={bool("ignoreRepeat")} set={(b) => set("ignoreRepeat", b ? 1 : 0)} />
        </>
      );

    case "texto":
      return (
        <>
          <Field label="Mensagem">
            <TextArea value={v("text")} set={(t) => set("text", t)} rows={5} placeholder="Ex.: Oi {nome}! Separei uma condição especial pra você hoje 👇" />
          </Field>
          <ToggleRow title="Spoiler" desc="O texto fica borrado até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
        </>
      );

    case "imagem":
      return (
        <>
          <Dropzone kind="image" url={v("url")} set={(u) => set("url", u)} icon={ImageIcon} />
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}">
            <TextArea value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} placeholder="Escreva uma legenda..." />
          </Field>
          <ToggleRow title="Spoiler" desc="A foto fica borrada até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
        </>
      );

    case "video": {
      const round = v("format") === "redondo";
      return (
        <>
          <Dropzone kind="video" url={v("url")} set={(u) => set("url", u)} icon={Film} />
          <Field label="Formato">
            <Cards value={round ? "redondo" : "normal"} set={(f) => set("format", f)} options={[{ v: "normal", title: "Vídeo normal", desc: "Com legenda", icon: Film }, { v: "redondo", title: "Recado redondo", desc: "Vídeo em círculo, sem legenda, até 1 min", icon: PlayCircle }]} />
          </Field>
          {!round && (
            <>
              <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}">
                <TextArea value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} placeholder="Escreva uma legenda..." />
              </Field>
              <ToggleRow title="Spoiler" desc="O vídeo fica borrado até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
            </>
          )}
        </>
      );
    }

    case "audio":
      return (
        <>
          <Dropzone kind="audio" url={v("url")} set={(u) => set("url", u)} icon={Mic} />
          <Field label="Enviar como">
            <Cards value={(v("mode") || "voz") as "voz" | "musica"} set={(m) => set("mode", m)} options={[{ v: "voz", title: "Áudio gravado", desc: "Aparece como se você tivesse gravado agora", icon: Mic }, { v: "musica", title: "Música", desc: "Player com o nome do arquivo", icon: Music }]} />
          </Field>
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}">
            <TextArea value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} placeholder="Escreva uma legenda..." />
          </Field>
          {v("mode") !== "musica" && <InfoNote>Para aparecer como áudio gravado (com a onda de voz), envie o arquivo em .ogg.</InfoNote>}
        </>
      );

    case "arquivo":
      return (
        <>
          <Dropzone kind="file" url={v("url")} set={(u) => set("url", u)} icon={Upload} onName={(n) => set("name", n.slice(0, 120))} />
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}">
            <TextArea value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} placeholder="Escreva uma legenda..." />
          </Field>
          <InfoNote>O lead recebe o arquivo com o nome original e pode baixar no celular ou no computador.</InfoNote>
        </>
      );

    case "digitando": {
      const sec = num(draft.sec);
      const inMin = sec >= 60 && sec % 60 === 0;
      const recording = v("action") === "gravando";
      return (
        <>
          <Field label="O que o lead vê">
            <Cards value={recording ? "gravando" : "digitando"} set={(a) => set("action", a)} options={[{ v: "digitando", title: "Digitando...", desc: "Mostra que o bot está escrevendo", icon: Keyboard }, { v: "gravando", title: "Gravando áudio...", desc: "Mostra que o bot está gravando", icon: Mic }]} />
          </Field>
          <Field label="Duração">
            <Amount
              value={inMin ? sec / 60 : sec}
              set={(x) => set("sec", Math.max(1, Math.min(600, Math.round(x) * (inMin ? 60 : 1))))}
              units={[["seg", "seg"], ["min", "min"]]}
              unit={inMin ? "min" : "seg"}
              setUnit={(u) => set("sec", u === "min" ? Math.max(60, Math.round(sec / 60) * 60 || 60) : Math.min(59, sec))}
            />
            <Pills items={[3, 5, 10, 30, 60, 120].map((s) => [s < 60 ? `${s} seg` : `${s / 60} min`, () => set("sec", s), sec === s] as [string, () => void, boolean])} />
          </Field>
          <Field label="Prévia" aside="como aparece no Telegram">
            <div className="flex items-center gap-3 rounded-[12px] px-4 py-3 bg-[#0e1621] border border-white/[0.06]">
              <span className="w-10 h-10 rounded-full bg-[#2b5278] text-white flex items-center justify-center"><Bot className="w-5 h-5" /></span>
              <span>
                <span className="block text-[14px] font-semibold text-white">Seu bot</span>
                <span className="flex items-center gap-1.5 text-[13px] text-[#6ab3f3]">
                  {recording ? <span className="flex items-end gap-[2px] h-3">{[6, 10, 8, 12].map((h, i) => <span key={i} className="w-[2px] rounded-full bg-[#6ab3f3] animate-pulse" style={{ height: h, animationDelay: `${i * 120}ms` }} />)}</span> : <span className="flex gap-[3px]">{[0, 1, 2].map((i) => <span key={i} className="w-[5px] h-[5px] rounded-full bg-[#6ab3f3] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}</span>}
                  {recording ? "gravando áudio" : "digitando"}
                </span>
              </span>
            </div>
          </Field>
          <p className="text-[13px] text-zinc-400 -mt-2">O indicador fica visível por <b className="text-white">{sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} segundos`}</b> e depois o fluxo segue para o próximo bloco. Use antes de um bloco de Texto ou Áudio para parecer uma conversa real.</p>
        </>
      );
    }

    case "espera": {
      const u = (v("u") || "minutos") as "segundos" | "minutos" | "horas" | "dias";
      const n = num(draft.n);
      const label: Record<string, [string, string]> = { segundos: ["segundo", "segundos"], minutos: ["minuto", "minutos"], horas: ["hora", "horas"], dias: ["dia", "dias"] };
      const is = (nn: number, uu: string) => n === nn && u === uu;
      return (
        <>
          <Field label="Tempo de espera">
            <Amount value={n} set={(x) => set("n", Math.round(x))} units={[["segundos", "seg"], ["minutos", "min"], ["horas", "horas"], ["dias", "dias"]]} unit={u} setUnit={(x) => set("u", x)} />
            <Pills
              items={[
                ["30 seg", () => { set("n", 30); set("u", "segundos"); }, is(30, "segundos")],
                ["5 min", () => { set("n", 5); set("u", "minutos"); }, is(5, "minutos")],
                ["30 min", () => { set("n", 30); set("u", "minutos"); }, is(30, "minutos")],
                ["1 hora", () => { set("n", 1); set("u", "horas"); }, is(1, "horas")],
                ["1 dia", () => { set("n", 1); set("u", "dias"); }, is(1, "dias")],
              ]}
            />
          </Field>
          <p className="text-[13px] text-zinc-400 -mt-2">O lead fica parado aqui por <b className="text-white">{n} {label[u][n === 1 ? 0 : 1]}</b> e depois segue para o próximo bloco.</p>
        </>
      );
    }

    case "condicao":
      return <ConditionForm draft={draft} setJson={setJson} />;

    case "ab": {
      const vs = jsonList<AbVariant>(draft.variants);
      const total = vs.reduce((a, x) => a + num(x.pct), 0);
      const BAR = ["#fb923c", "#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#22d3ee", "#f87171"];
      return (
        <>
          <Field label="Caminhos" action={vs.length < 8 ? <AddChip label="Caminho" color="#fb923c" onClick={() => setJson("variants", [...vs, { name: "ABCDEFGH"[vs.length], pct: 0 }])} /> : undefined}>
            <div className="flex flex-col gap-2.5">
              {vs.map((x, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-[9px] text-[13px] font-bold flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${BAR[i]} 18%, transparent)`, color: BAR[i] }}>{"ABCDEFGH"[i]}</span>
                  <input value={x.name} maxLength={30} onChange={(e) => setJson("variants", vs.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className={`${FIELD} flex-1`} placeholder={`Caminho ${"ABCDEFGH"[i]}`} />
                  <span className="relative w-[110px] shrink-0">
                    <input type="number" min={0} max={100} value={num(x.pct)} onChange={(e) => setJson("variants", vs.map((y, j) => (j === i ? { ...y, pct: Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) } : y)))} className={`${FIELD} text-right pr-8 tabular-nums`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">%</span>
                  </span>
                  <button type="button" className={`${iconBtn} hover:!text-red-400`} disabled={vs.length <= 2} onClick={() => setJson("variants", vs.filter((_, j) => j !== i))} aria-label="Remover caminho"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Field>
          <div className="flex flex-col gap-2">
            <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.06] gap-[2px]">
              {vs.map((x, i) => <span key={i} style={{ width: `${(num(x.pct) / Math.max(total, 100)) * 100}%`, background: BAR[i] }} />)}
            </div>
            <span className="text-[13px] text-zinc-400">Total: <b className={total === 100 ? "text-white" : "text-amber-400"}>{total}%</b>{total !== 100 && " · a soma precisa dar 100%"}</span>
          </div>
        </>
      );
    }

    case "input": {
      const u = (v("u") || "segundos") as "segundos" | "minutos" | "horas";
      return (
        <>
          <Field label="Pergunta" hint="O bot envia esta pergunta e espera a resposta do lead.">
            <TextArea value={v("text")} set={(t) => set("text", t)} rows={3} placeholder="Ex.: Qual cidade você mora?" />
          </Field>
          <Field label="Tipo de resposta">
            <Tiles value={(v("kind") || "texto") as "texto"} set={(k) => set("kind", k)} options={[{ v: "texto", title: "Texto", icon: Type }, { v: "numero", title: "Número", icon: Hash }, { v: "email", title: "E-mail", icon: AtSign }, { v: "telefone", title: "Telefone", icon: Phone }]} />
          </Field>
          <Field label="Tempo para responder" hint={<>Sem resposta nesse tempo, o fluxo segue pela saída <b className="text-zinc-300">Timeout</b>.</>}>
            <Amount value={num(draft.wait)} set={(x) => set("wait", Math.max(1, Math.round(x)))} units={[["segundos", "seg"], ["minutos", "min"], ["horas", "horas"]]} unit={u} setUnit={(x) => set("u", x)} />
          </Field>
          <Field label="Guardar resposta como" hint={`Use {${v("var") || "resposta"}} nas próximas mensagens.`}>
            <input value={v("var")} maxLength={30} onChange={(e) => set("var", e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())} className={FIELD} placeholder="resposta" />
          </Field>
        </>
      );
    }

    case "pagamento": {
      const qrOn = (v("qr") || "botao") !== "nao";
      return (
        <>
          <Field label="Valor (R$)">
            <input type="number" min={0} step={0.01} value={num(draft.value)} onChange={(e) => set("value", Math.max(0, Math.round(Number(e.target.value) * 100) / 100))} className={`${FIELD} tabular-nums`} />
          </Field>
          <Field label="Descrição">
            <input value={v("desc")} maxLength={120} onChange={(e) => set("desc", e.target.value)} className={FIELD} placeholder="Ex: Plano VIP" />
          </Field>
          <Field label="Tipo de venda">
            <Tiles
              value={(v("saleType") || "principal") as "principal"}
              set={(x) => set("saleType", x)}
              options={[{ v: "principal", title: "Principal", icon: ShoppingCart }, { v: "upsell", title: "Upsell", icon: ArrowUp }, { v: "downsell", title: "Downsell", icon: ArrowDown }, { v: "bump", title: "Order Bump", icon: PlusCircle }, { v: "remarketing", title: "Remarketing", icon: Megaphone }]}
            />
          </Field>
          <ToggleRow title={<>Botão “Pagar com QR Code”</>} desc="Inclui o botão 📱 Pagar com QR Code na mensagem do PIX" on={qrOn} set={(b) => set("qr", b ? "botao" : "nao")} />
          <Field label="Timeout (minutos)" hint="Tempo para expirar o pagamento e seguir pela saída “Expirou”.">
            <input type="number" min={1} value={num(draft.timeout)} onChange={(e) => set("timeout", Math.max(1, Math.round(Number(e.target.value))))} className={`${FIELD} tabular-nums`} />
          </Field>
          <Field label="Mensagem do PIX" hint={<>Variáveis: <code className="text-[color:var(--c)]">{"{plano}"}</code> <code className="text-[color:var(--c)]">{"{valor}"}</code> <code className="text-[color:var(--c)]">{"{pix}"}</code> — o código Pix entra onde estiver {"{pix}"}. Deixe vazio para usar a mensagem padrão.</>}>
            <TextArea value={v("msg")} set={(t) => set("msg", t)} rows={6} vars={["{nome}", "{plano}", "{valor}", "{pix}"]} placeholder={"⭐ Você selecionou o seguinte plano:\n\n🎁 Plano: {plano}\n💲 Valor: {valor}\n\n💎 Pague via Pix Copia e Cola:\n\n{pix}"} />
          </Field>
          <Field label="Cor dos botões">
            <div className="flex flex-col gap-2.5">
              <ColorRow label="Pagar" value={v("payColor") || "none"} set={(c) => set("payColor", c)} />
              <ColorRow label="Consultar" value={v("checkColor") || "none"} set={(c) => set("checkColor", c)} />
            </div>
          </Field>
          <InfoNote icon={Wallet}>O fluxo pausa até o pagamento ser confirmado. Conecte a saída <b className="text-zinc-200">Pagou</b> e, se quiser recuperar, a <b className="text-zinc-200">Expirou</b>.</InfoNote>
        </>
      );
    }

    case "grupo":
      return (
        <>
          <Field label="Grupo" hint="Selecione o grupo onde o lead será adicionado. O bot precisa ser admin com permissão de convidar e banir.">
            {chats.length ? (
              <select value={v("chatId")} onChange={(e) => set("chatId", e.target.value)} className={`${FIELD} cursor-pointer`}>
                <option value="">Escolha…</option>
                {chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            ) : (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3">
                <span className="text-amber-400 mt-px">⚠</span>
                <span className="flex-1 text-[13px] text-zinc-300">Nenhum grupo encontrado. Ligue este fluxo a um bot e adicione o bot como administrador do grupo ou canal.</span>
                <button type="button" onClick={() => window.location.reload()} className="text-[12.5px] font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: "var(--c)" }}><RefreshCw className="w-3.5 h-3.5" />Tentar novamente</button>
              </div>
            )}
          </Field>
          <Field label="Tempo de acesso" hint="Após esse período, o lead é removido e o fluxo segue pela saída “Expirado”. 0 = sem vencimento.">
            <div className="flex gap-2">
              <input type="number" min={0} value={num(draft.days)} onChange={(e) => set("days", Math.max(0, Math.round(Number(e.target.value))))} className={`${FIELD} w-[120px] tabular-nums`} />
              <div className={`${FIELD} flex items-center text-zinc-300`}>Dias</div>
            </div>
            <Pills items={[7, 30, 90, 365, 0].map((d) => [d ? `${d} dias` : "Vitalício", () => set("days", d), num(draft.days) === d] as [string, () => void, boolean])} />
          </Field>
        </>
      );

    case "bottaxa": {
      const others = storeBots.filter((b) => !currentBotIds.includes(b.id));
      return (
        <>
          <p className="text-[13.5px] leading-[1.55] text-zinc-300">🤖 A entrega será feita por <b className="text-white">outro bot</b>. O lead recebe <b className="text-white">“👉 Clique no botão abaixo para acessar:”</b> com um botão que abre o bot de destino já no <code className="text-zinc-400">/start</code>.</p>
          <Field label="Bot de destino" hint="O lead será direcionado para este bot.">
            {others.length ? (
              <select value={v("botId")} onChange={(e) => set("botId", e.target.value)} className={`${FIELD} cursor-pointer`}>
                <option value="">Escolha…</option>
                {others.map((b) => <option key={b.id} value={b.id}>@{b.username}</option>)}
              </select>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bot className="w-7 h-7 text-zinc-500" />
                <p className="text-[14px] text-zinc-300">Você não tem outros bots.</p>
                <p className="text-[12.5px] text-zinc-500">Crie um bot no painel para usá-lo como destino da entrega.</p>
              </div>
            )}
          </Field>
          <Field label="Texto do botão" hint="Se vazio, usa “🤖 Acessar {nome do bot}”.">
            <input value={v("btnText")} maxLength={64} onChange={(e) => set("btnText", e.target.value)} className={FIELD} placeholder="Ex: 🔓 Acessar conteúdo" />
          </Field>
        </>
      );
    }

    case "fakecall":
      return (
        <>
          <Field label="Chamador" hint="Nome que aparece na mensagem de chamada">
            <input value={v("name")} maxLength={60} onChange={(e) => set("name", e.target.value)} className={FIELD} placeholder="Ex.: Maria" />
          </Field>
          <Field label="Vídeo da chamada" hint="Vídeo que o lead recebe quando atende a chamada simulada">
            <Dropzone kind="video" url={v("videoUrl")} set={(u) => set("videoUrl", u)} icon={Film} compact />
          </Field>
          <Field label="Mensagem no chat" hint="Texto enviado antes dos botões">
            <TextArea value={v("msg")} set={(t) => set("msg", t)} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botão Atender"><input value={v("acceptBtn")} maxLength={40} onChange={(e) => set("acceptBtn", e.target.value)} className={FIELD} /></Field>
            <Field label="Botão Recusar"><input value={v("declineBtn")} maxLength={40} onChange={(e) => set("declineBtn", e.target.value)} className={FIELD} /></Field>
          </div>
          <InfoNote>Conecte a saída <b className="text-zinc-200">Recusou</b> a outro bloco para recuperar quem não atendeu.</InfoNote>
        </>
      );

    case "remover":
      return (
        <>
          <Field label="ID do grupo" aside="opcional" hint="Deixe vazio para tirar o lead do grupo do último acesso liberado. O ID de grupos começa com -100.">
            <input value={v("groupId")} maxLength={20} onChange={(e) => set("groupId", e.target.value.replace(/[^\d-]/g, ""))} className={FIELD} placeholder="-1001234567890" />
          </Field>
          <InfoNote>O bot precisa ser administrador do grupo com permissão para banir usuários.</InfoNote>
        </>
      );

    case "pixel": {
      const EVENTS: [string, string][] = [["PageView", "Visualizou"], ["Lead", "Virou lead"], ["AddToCart", "Adicionou ao carrinho"], ["InitiateCheckout", "Iniciou pagamento"], ["Purchase", "Comprou"], ["CompleteRegistration", "Concluiu cadastro"]];
      return (
        <>
          <Field label="Evento">
            <div className="grid grid-cols-2 gap-2">
              {EVENTS.map(([k, l]) => {
                const on = v("event") === k;
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => set("event", k)} className="text-left rounded-[10px] border px-3 py-2.5" style={on ? { borderColor: tint(70), background: tint(10) } : { borderColor: "rgba(255,255,255,0.08)", background: "#121316" }}>
                    <span className="block text-[13.5px] font-semibold text-white">{k}</span>
                    <span className="block text-[12px] text-zinc-500">{l}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Valor" aside="opcional" hint="Vazio = usa o valor do último pagamento deste lead no fluxo.">
            <input type="number" min={0} step={0.01} value={num(draft.value)} onChange={(e) => set("value", Math.max(0, Number(e.target.value)))} className={`${FIELD} tabular-nums`} />
          </Field>
          <Field label="Facebook Pixel ID">
            <input value={v("fbPixelId")} maxLength={40} onChange={(e) => set("fbPixelId", e.target.value.replace(/\D/g, ""))} className={FIELD} placeholder="123456789012345" />
          </Field>
          <Field label="Token da API de Conversões">
            <input value={v("fbToken")} maxLength={400} onChange={(e) => set("fbToken", e.target.value.trim())} className={FIELD} placeholder="EAAB…" />
          </Field>
        </>
      );
    }

    case "nota":
      return (
        <Field label="Nota (só você vê)">
          <textarea rows={6} maxLength={4000} value={v("text")} onChange={(e) => set("text", e.target.value)} className={`${FIELD} resize-y`} />
        </Field>
      );

    case "mensagem":
      return <MessageForm draft={draft} set={set} />;

    case "botao":
      return <ButtonsOnlyForm draft={draft} set={set} />;

    default:
      return <InfoNote>Este é um bloco da versão anterior. Ele continua funcionando; para mudar, troque por um bloco novo da lista.</InfoNote>;
  }
}

/* ------------------------------------------------------------------ */
/* Condição                                                            */
/* ------------------------------------------------------------------ */
const RULES: { k: RuleKind; label: string; icon: Icon; color: string }[] = [
  { k: "horario", label: "Horário", icon: Clock, color: "#fbbf24" },
  { k: "utm_source", label: "UTM Source", icon: Target, color: "#f87171" },
  { k: "utm_medium", label: "UTM Medium", icon: Tag, color: "#fb923c" },
  { k: "utm_campaign", label: "UTM Campaign", icon: Flag, color: "#a78bfa" },
  { k: "idioma", label: "Idioma", icon: Languages, color: "#f472b6" },
  { k: "pagou", label: "Já pagou?", icon: Wallet, color: "#34d399" },
];

function ConditionForm({ draft, setJson }: { draft: Values; setJson: (k: string, list: unknown[]) => void }) {
  const rules = jsonList<CondRule>(draft.rules);
  const upd = (i: number, patch: Partial<CondRule>) => setJson("rules", rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const [adding, setAdding] = useState(rules.length === 0);
  const pick = (k: RuleKind) => {
    setJson("rules", [...rules, k === "horario" ? { kind: k, value: "08:00", value2: "18:00" } : k === "pagou" ? { kind: k, value: "sim" } : { kind: k, value: "" }]);
    setAdding(false);
  };
  return (
    <>
      <div className="flex gap-3 rounded-[12px] px-4 py-3.5" style={{ background: tint(8), border: `1px solid ${tint(28)}` }}>
        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--c)" }} />
        <p className="text-[13px] leading-[1.5] text-zinc-300"><b style={{ color: "var(--c)" }}>Como funciona?</b><br />O lead é avaliado de cima pra baixo. Segue pelo <b className="text-white">primeiro caminho que bater</b>. Se nenhum bater, vai pro “Senão”.</p>
      </div>

      {rules.map((r, i) => {
        const meta = RULES.find((x) => x.k === r.kind) || RULES[0];
        const I = meta.icon;
        return (
          <div key={i} className="rounded-[14px] border border-white/[0.09] bg-[#121316] overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/[0.06]">
              <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold" style={{ background: tint(18), color: "var(--c)" }}>{i === 0 ? "SE" : "SENÃO SE"}</span>
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white"><I className="w-4 h-4" style={{ color: meta.color }} />{meta.label}</span>
              <span className="ml-auto flex">
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setJson("rules", moveItem(rules, i, -1))} aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" className={iconBtn} disabled={i === rules.length - 1} onClick={() => setJson("rules", moveItem(rules, i, 1))} aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
                <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => setJson("rules", rules.filter((_, j) => j !== i))} aria-label="Remover condição"><Trash2 className="w-4 h-4" /></button>
              </span>
            </div>
            <div className="px-3.5 py-3">
              {r.kind === "horario" ? (
                <div className="flex items-center gap-2 text-[13px] text-zinc-400">
                  entre <input type="time" value={r.value || "08:00"} onChange={(e) => upd(i, { value: e.target.value })} className={`${FIELD} !w-auto`} /> e <input type="time" value={r.value2 || "18:00"} onChange={(e) => upd(i, { value2: e.target.value })} className={`${FIELD} !w-auto`} /> <span className="text-zinc-500">(Brasília)</span>
                </div>
              ) : r.kind === "pagou" ? (
                <div className="flex gap-2">
                  {[["sim", "Já pagou"], ["nao", "Ainda não pagou"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => upd(i, { value: k })} className="h-9 px-3.5 rounded-[9px] border text-[13px] font-medium" style={(r.value || "sim") === k ? { borderColor: tint(70), background: tint(12), color: "#fff" } : { borderColor: "rgba(255,255,255,0.09)", color: "#a1a1aa" }}>{l}</button>
                  ))}
                </div>
              ) : (
                <input value={r.value || ""} onChange={(e) => upd(i, { value: e.target.value.slice(0, 80) })} placeholder={r.kind === "idioma" ? "pt, en, es…" : "Valor (use * para “qualquer valor”)"} className={FIELD} />
              )}
            </div>
          </div>
        );
      })}

      {adding && rules.length < 8 ? (
        <div className="rounded-[14px] border border-dashed border-white/[0.14] bg-[#0c0d10] overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-white/[0.06]"><span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold" style={{ background: tint(18), color: "var(--c)" }}>SE</span></div>
          <div className="p-3.5">
            <p className="text-[12.5px] text-zinc-500 mb-2.5">O que verificar?</p>
            <div className="grid grid-cols-3 gap-2">
              {RULES.map(({ k, label, icon: I, color }) => (
                <button key={k} type="button" onClick={() => pick(k)} className="flex items-center gap-2 h-10 px-3 rounded-[9px] border border-white/[0.09] bg-[#121316] hover:border-white/[0.2] text-[13px] text-zinc-200 text-left">
                  <I className="w-4 h-4 shrink-0" style={{ color }} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        rules.length < 8 && (
          <button type="button" onClick={() => setAdding(true)} className="h-11 rounded-[12px] border border-dashed text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ borderColor: tint(40), color: "var(--c)" }}>
            <Plus className="w-4 h-4" />Adicionar outra condição
          </button>
        )
      )}

      <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.09] bg-[#121316] px-4 py-3.5">
        <span className="w-9 h-9 rounded-[9px] bg-white/[0.05] text-zinc-400 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></span>
        <span>
          <span className="block text-[13px] font-bold tracking-[0.06em] text-zinc-300">SENÃO</span>
          <span className="block text-[12.5px] text-zinc-500">Lead que não bater em nenhuma condição segue por aqui</span>
        </span>
      </div>
      <InfoNote>UTM vem do link de campanha: <code className="text-zinc-300">t.me/seubot?start=s-facebook_c-black_m-stories</code> (s = source, c = campaign, m = medium). Dispositivo, país e estado não são informados pelo Telegram.</InfoNote>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Botões (lista com texto, link opcional e cor)                       */
/* ------------------------------------------------------------------ */
const BTN_COLORS: [NonNullable<MsgButton["color"]>, string, string][] = [["blue", "#2f6fdc", "Azul"], ["green", "#1f9d55", "Verde"], ["red", "#c0392b", "Vermelho"]];

function ButtonsEditor({ label, buttons, setButtons }: { label: string; buttons: MsgButton[]; setButtons: (l: MsgButton[]) => void }) {
  const upd = (i: number, patch: Partial<MsgButton>) => setButtons(buttons.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Field
      label={label}
      hint="Quando há botões, o fluxo pausa até o lead clicar. Botão com link abre o link e não cria caminho. A cor aparece no Telegram."
      action={buttons.length < 8 ? <AddChip label="Botão" color="#3b82f6" onClick={() => setButtons([...buttons, { label: "" }])} /> : undefined}
    >
      {buttons.length > 0 && (
        <div className="flex flex-col gap-2">
          {buttons.map((b, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] items-center gap-2">
              <input value={b.label} maxLength={64} onChange={(e) => upd(i, { label: e.target.value })} className={`${FIELD} min-w-0`} placeholder="Texto do botão" />
              <input value={b.url || ""} maxLength={500} onChange={(e) => upd(i, { url: e.target.value.trim() })} className={`${FIELD} min-w-0`} placeholder="Link (opcional)" />
              <span className="flex gap-1 shrink-0" role="group" aria-label="Cor do botão">
                {BTN_COLORS.map(([k, hex, name]) => (
                  <button
                    key={k}
                    type="button"
                    title={name}
                    aria-label={`${name}${b.color === k ? " (selecionada)" : ""}`}
                    aria-pressed={b.color === k}
                    onClick={() => upd(i, { color: b.color === k ? "none" : k })}
                    className="w-7 h-7 rounded-[7px] transition-shadow"
                    style={{ background: hex, opacity: b.color && b.color !== "none" && b.color !== k ? 0.45 : 1, boxShadow: b.color === k ? "0 0 0 2px #0f1012, 0 0 0 4px #fff" : "none" }}
                  />
                ))}
              </span>
              <button type="button" className={`${iconBtn} !w-9 !h-9 hover:!text-red-400`} onClick={() => setButtons(buttons.filter((_, j) => j !== i))} aria-label="Remover botão"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}

function ButtonsOnlyForm({ draft, set }: { draft: Values; set: (k: string, v: string | number) => void }) {
  const buttons = jsonList<MsgButton>(draft.buttons);
  return (
    <>
      <Field label="Mensagem" hint="Texto enviado junto com os botões.">
        <TextArea value={str(draft.text)} set={(t) => set("text", t)} rows={3} placeholder="Escolha uma opção 👇" />
      </Field>
      <ButtonsEditor label="Botões" buttons={buttons} setButtons={(l) => set("buttons", JSON.stringify(l))} />
      <ToggleRow title="Timeout automático" desc="Se o lead não clicar em nenhum botão, segue pela saída “Sem clique” depois de X minutos" on={num(draft.timeout) > 0} set={(on) => set("timeout", on ? 5 : 0)}>
        <span className="flex items-center gap-2">
          <input type="number" min={1} value={num(draft.timeout)} onChange={(e) => set("timeout", Math.max(1, Math.round(Number(e.target.value))))} className={`${FIELD} w-[100px] text-center tabular-nums`} />
          <span className="text-[13px] text-zinc-500">minutos</span>
        </span>
      </ToggleRow>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mensagem (conteúdo composto + botões)                               */
/* ------------------------------------------------------------------ */
function MessageForm({ draft, set }: { draft: Values; set: (k: string, v: string | number) => void }) {
  const items = jsonList<MsgItem>(draft.items);
  const buttons = jsonList<MsgButton>(draft.buttons);
  const setItems = (l: MsgItem[]) => set("items", JSON.stringify(l));
  const setButtons = (l: MsgButton[]) => set("buttons", JSON.stringify(l));
  const upd = (i: number, patch: Partial<MsgItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (t: MsgItem["t"]) => setItems([...items, t === "delay" ? { t, sec: 3 } : t === "texto" ? { t, text: "" } : { t, url: "" }]);
  const ITEM: Record<MsgItem["t"], [string, string]> = { texto: ["Texto", "#60a5fa"], midia: ["Mídia", "#34d399"], delay: ["Delay", "#fbbf24"] };
  const full = items.length >= 12;

  return (
    <>
      <Field
        label="Conteúdo"
        action={
          <span className="flex gap-1.5">
            <AddChip label="Texto" color="#60a5fa" onClick={() => add("texto")} disabled={full} />
            <AddChip label="Mídia" color="#34d399" onClick={() => add("midia")} disabled={full} />
            <AddChip label="Delay" color="#fbbf24" onClick={() => add("delay")} disabled={full} />
          </span>
        }
      >
        {items.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {items.map((it, i) => {
              const [label, color] = ITEM[it.t];
              return (
                <div key={i} className="rounded-[12px] border bg-[#121316] p-3.5 flex flex-col gap-3" style={{ borderColor: `color-mix(in srgb, ${color} 22%, rgba(255,255,255,0.08))` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color }}>{label}</span>
                    <span className="ml-auto flex">
                      <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setItems(moveItem(items, i, -1))} aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => setItems(moveItem(items, i, 1))} aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remover item"><Trash2 className="w-4 h-4" /></button>
                    </span>
                  </div>
                  {it.t === "texto" && <TextArea value={it.text || ""} set={(t) => upd(i, { text: t })} rows={3} placeholder="Escreva a mensagem..." />}
                  {it.t === "midia" && <Dropzone kind="visual" url={it.url || ""} set={(u) => upd(i, { url: u })} icon={Upload} compact />}
                  {it.t === "delay" && (
                    <span className="flex items-center gap-2">
                      <input type="number" min={1} max={60} value={num(it.sec)} onChange={(e) => upd(i, { sec: Math.max(1, Math.min(60, Math.round(Number(e.target.value)))) })} className={`${FIELD} w-[100px] text-center tabular-nums`} />
                      <span className="text-[13px] text-zinc-500">segundos</span>
                    </span>
                  )}
                  {it.t !== "delay" && (
                    <label className="flex items-center gap-2 text-[12.5px] text-zinc-400 cursor-pointer w-fit">
                      <input type="checkbox" checked={!!it.spoiler} onChange={(e) => upd(i, { spoiler: e.target.checked })} className="accent-[#3b82f6] w-4 h-4" />
                      Spoiler — fica escondido até o lead tocar
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Field>

      <ButtonsEditor label="Botões (opcional)" buttons={buttons} setButtons={setButtons} />

      {buttons.length > 0 && (
        <>
          <ToggleRow title="Timeout automático" desc="Se o lead não clicar em nenhum botão, segue pela saída “Sem clique” depois de X minutos" on={num(draft.timeout) > 0} set={(b) => set("timeout", b ? 5 : 0)}>
            <span className="flex items-center gap-2">
              <input type="number" min={1} value={num(draft.timeout)} onChange={(e) => set("timeout", Math.max(1, Math.round(Number(e.target.value))))} className={`${FIELD} w-[100px] text-center tabular-nums`} />
              <span className="text-[13px] text-zinc-500">minutos</span>
            </span>
          </ToggleRow>
          <ToggleRow title="Texto acima dos botões" desc="Botões enviados em mensagem separada com este texto" on={str(draft.btnText).length > 0} set={(b) => set("btnText", b ? "Escolha uma opção 👇" : "")}>
            <input value={str(draft.btnText)} maxLength={300} onChange={(e) => set("btnText", e.target.value)} className={FIELD} />
          </ToggleRow>
        </>
      )}

      <ToggleRow title="Simular ação" desc="Mostra “digitando...”, “enviando foto...” etc antes de cada item" on={num(draft.simulate) === 1} set={(b) => set("simulate", b ? 1 : 0)}>
        <div className="flex items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-zinc-400">Duração (seg)</span>
            <input type="number" min={1} max={5} value={num(draft.simSec) || 2} onChange={(e) => set("simSec", Math.max(1, Math.min(5, Math.round(Number(e.target.value)))))} className={`${FIELD} w-[90px] text-center tabular-nums`} />
          </label>
          <span className="text-[12.5px] text-zinc-500 pb-2.5">Detecta automaticamente: ✏️ Texto → digitando… · 📷 Foto → enviando foto…</span>
        </div>
      </ToggleRow>
    </>
  );
}
