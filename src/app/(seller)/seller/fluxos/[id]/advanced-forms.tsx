"use client";

/**
 * Formulários das janelas de configuração dos blocos do Fluxo Avançado.
 * Cada bloco tem o seu; todos editam um rascunho (draft) que só vale ao clicar em Salvar.
 */
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { jsonList, RULE_LABEL, type AbVariant, type CondRule, type MsgButton, type MsgItem, type NodeType, type RuleKind } from "@/lib/flows/advanced-graph";
import { INPUT, useToast } from "../_components/flow-ui";
import { uploadFlowFile } from "./flow-fields";
import type { FlowChat } from "./BasicFlowEditor";

type Values = Record<string, string | number>;
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

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */
function Field({ label, hint, aside, children }: { label: ReactNode; hint?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-zinc-200">
        {label}
        {aside && <span className="text-[11.5px] font-normal text-[#8b8b94]">{aside}</span>}
      </span>
      {children}
      {hint && <span className="text-[12px] leading-[1.45] text-[#8b8b94]">{hint}</span>}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] leading-[1.5] text-[#9aa0aa] rounded-[10px] border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">{children}</p>;
}

function Toggle({ title, desc, on, set }: { title: string; desc?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-white/[0.07] bg-[#0d0e11] px-3.5 py-3">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-white">{title}</span>
        {desc && <span className="block text-[12px] text-[#8b8b94] mt-0.5">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => set(!on)}
        className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-[#3b82f6]" : "bg-[#3f3f46]"}`}
      >
        <span className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </button>
    </div>
  );
}

/** Opções lado a lado (com título e descrição opcional). */
function Choice<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [T, string, string?][] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0, 1fr))` }}>
      {options.map(([v, title, sub]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => set(v)}
            className={`text-left rounded-[10px] border px-3 py-2.5 transition-colors ${on ? "border-[#3b82f6]/70 bg-[#3b82f6]/[0.08]" : "border-white/[0.08] bg-[#0d0e11] hover:border-white/[0.16]"}`}
          >
            <span className="block text-[13px] font-medium text-white">{title}</span>
            {sub && <span className="block text-[11.5px] text-[#8b8b94] mt-0.5">{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Atalhos de valor ("30 seg", "5 min"...). */
function Presets({ items, onPick }: { items: [string, () => void][]; onPick?: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([label, fn]) => (
        <button key={label} type="button" onClick={() => { fn(); onPick?.(); }} className="h-7 px-2.5 rounded-[7px] border border-white/[0.08] bg-white/[0.03] text-[12px] text-zinc-300 hover:text-white hover:border-white/[0.18]">
          {label}
        </button>
      ))}
    </div>
  );
}

function Seg<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="group" className="inline-flex self-start p-[2px] rounded-[9px] bg-[#0d0e11] border border-white/[0.07]">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)} className={`px-3 h-[28px] rounded-[7px] text-[12.5px] font-medium ${value === v ? "bg-[#26272c] text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Texto com variáveis clicáveis e contador. */
function TextArea({ id, value, set, max = 4096, rows = 4, vars = VARS, placeholder }: { id: string; value: string; set: (v: string) => void; max?: number; rows?: number; vars?: string[]; placeholder?: string }) {
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
    <div className="rounded-[10px] border border-white/[0.09] bg-[#0d0e11] overflow-hidden focus-within:border-[#3b82f6] focus-within:ring-[3px] focus-within:ring-[#3b82f6]/15">
      <textarea id={id} ref={ref} rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="block w-full bg-transparent px-3.5 py-3 text-[14px] leading-[1.55] text-white outline-none resize-y placeholder:text-zinc-600" />
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-white/[0.06] bg-[#141518]">
        {vars.map((v) => (
          <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="h-6 px-1.5 rounded-[6px] font-mono text-[11px] text-zinc-300 bg-white/[0.04] border border-white/[0.06] hover:text-white">
            {v}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-[#8b8b94] tabular-nums">{value.length}/{max}</span>
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
const ACCEPT_HINT: Record<string, string> = {
  image: "JPG, PNG, GIF ou WebP",
  video: "MP4 ou MOV · até 4 MB",
  audio: "MP3, OGG ou M4A · até 4 MB",
  file: "PDF, ZIP, RAR, 7Z, Word, Excel, PowerPoint, EPUB, TXT ou CSV · até 4 MB",
  visual: "Foto, vídeo ou áudio · até 4 MB",
};

/** Envio de arquivo (clique ou arraste), com prévia e remover. */
function Upload_({ kind, url, set, onName }: { kind: keyof typeof ACCEPT; url: string; set: (v: string) => void; onName?: (n: string) => void }) {
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
    const isImg = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || kind === "image";
    const isVid = /\.(mp4|mov)(\?|$)/i.test(url);
    const isAud = /\.(ogg|oga|opus|mp3|m4a)(\?|$)/i.test(url);
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#0d0e11] p-2.5">
        {isImg && !isVid && !isAud ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-16 h-16 rounded-[8px] object-cover shrink-0" />
        ) : isVid ? (
          <video src={url} className="w-16 h-16 rounded-[8px] object-cover shrink-0" muted playsInline preload="metadata" />
        ) : isAud ? (
          <audio src={url} controls className="h-9 flex-1 min-w-0" />
        ) : null}
        {!isAud && <span className="flex-1 min-w-0 text-[12.5px] text-zinc-300 truncate">{decodeURIComponent(url.split("/").pop() || "arquivo")}</span>}
        <button type="button" onClick={() => set("")} aria-label="Remover arquivo" className="w-8 h-8 rounded-[8px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) send(f); }}
        className={`w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-[12px] border border-dashed transition-colors ${over ? "border-[#3b82f6] bg-[#3b82f6]/[0.06]" : "border-white/[0.14] bg-[#0d0e11] hover:border-white/[0.25]"}`}
      >
        <span className="w-9 h-9 rounded-[10px] bg-[#3b82f6]/[0.12] text-[#60a5fa] flex items-center justify-center">
          {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Upload className="w-[18px] h-[18px]" />}
        </span>
        <span className="text-[13px] font-medium text-white">{busy ? "Enviando…" : "Clique ou arraste um arquivo"}</span>
        <span className="text-[11.5px] text-[#8b8b94]">{ACCEPT_HINT[kind]}</span>
      </button>
      <input ref={ref} type="file" accept={ACCEPT[kind]} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
    </>
  );
}

const Num = ({ value, set, min = 0, step = 1, suffix }: { value: number; set: (v: number) => void; min?: number; step?: number; suffix?: string }) => (
  <span className="flex items-center gap-2">
    <input type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => set(Number(e.target.value))} className={`${INPUT} tabular-nums`} />
    {suffix && <span className="text-[13px] text-[#8b8b94] shrink-0">{suffix}</span>}
  </span>
);

const iconBtn = "w-7 h-7 rounded-[7px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30";
function moveItem<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
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
          <div className="rounded-[12px] border border-[#3b82f6]/25 bg-[#3b82f6]/[0.06] px-4 py-3">
            <p className="text-[13.5px] font-medium text-white">Lead</p>
            <p className="text-[12.5px] text-[#93c5fd]">enviou <b className="text-white">/start</b></p>
          </div>
          <p className="text-[12.5px] text-[#9aa0aa]">O fluxo começa sempre que o lead envia /start para o bot (ou toca em “Iniciar”).</p>
          <Toggle title="Ignorar /start repetido" desc="O bot só responde ao /start na primeira vez que o lead entra" on={bool("ignoreRepeat")} set={(b) => set("ignoreRepeat", b ? 1 : 0)} />
        </>
      );

    case "texto":
      return (
        <>
          <Field label="Mensagem"><TextArea id="f-texto" value={v("text")} set={(t) => set("text", t)} /></Field>
          <Toggle title="Spoiler" desc="O texto fica borrado até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
        </>
      );

    case "imagem":
      return (
        <>
          <Upload_ kind="image" url={v("url")} set={(u) => set("url", u)} />
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}"><TextArea id="f-cap" value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} /></Field>
          <Toggle title="Spoiler" desc="A foto fica borrada até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
        </>
      );

    case "video":
      return (
        <>
          <Upload_ kind="video" url={v("url")} set={(u) => set("url", u)} />
          <Field label="Formato">
            <Choice value={(v("format") || "normal") as "normal" | "redondo"} set={(f) => set("format", f)} options={[["normal", "Vídeo normal", "Com legenda"], ["redondo", "Recado redondo", "Vídeo em círculo, sem legenda, até 1 min"]]} />
          </Field>
          {v("format") !== "redondo" && (
            <>
              <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}"><TextArea id="f-cap" value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={3} /></Field>
              <Toggle title="Spoiler" desc="O vídeo fica borrado até o lead tocar" on={bool("spoiler")} set={(b) => set("spoiler", b ? 1 : 0)} />
            </>
          )}
        </>
      );

    case "audio":
      return (
        <>
          <Upload_ kind="audio" url={v("url")} set={(u) => set("url", u)} />
          <Field label="Enviar como">
            <Choice value={(v("mode") || "voz") as "voz" | "musica"} set={(m) => set("mode", m)} options={[["voz", "Áudio gravado", "Aparece como se você tivesse gravado agora"], ["musica", "Música", "Player com o nome do arquivo"]]} />
          </Field>
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}"><TextArea id="f-cap" value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={2} /></Field>
          {v("mode") !== "musica" && <Note>Para aparecer como áudio gravado (com a onda de voz), envie em .ogg. MP3 e M4A vão como música.</Note>}
        </>
      );

    case "arquivo":
      return (
        <>
          <Upload_ kind="file" url={v("url")} set={(u) => set("url", u)} onName={(n) => set("name", n.slice(0, 120))} />
          <Field label="Legenda" aside="opcional · aceita {nome}, {cidade}"><TextArea id="f-cap" value={v("caption")} set={(t) => set("caption", t)} max={1024} rows={2} /></Field>
          <Note>O lead recebe o arquivo com o nome original e pode baixar no celular ou no computador.</Note>
        </>
      );

    case "digitando": {
      const sec = num(draft.sec);
      return (
        <>
          <Field label="O que o lead vê">
            <Choice value={(v("action") || "digitando") as "digitando" | "gravando"} set={(a) => set("action", a)} options={[["digitando", "Digitando...", "Mostra que o bot está escrevendo"], ["gravando", "Gravando áudio...", "Mostra que o bot está gravando"]]} />
          </Field>
          <Field label="Duração" hint={`O indicador fica visível por ${sec} segundos e depois o fluxo segue para o próximo bloco.`}>
            <Num value={sec} set={(x) => set("sec", Math.max(1, Math.min(60, Math.round(x))))} min={1} suffix="seg" />
            <Presets items={[3, 5, 10, 30, 60].map((s) => [s < 60 ? `${s} seg` : "1 min", () => set("sec", s)])} />
          </Field>
          <div className="rounded-[12px] bg-[#0e1621] px-4 py-3">
            <p className="text-[13px] font-semibold text-white">Seu bot</p>
            <p className="text-[12px] text-[#60a5fa]">{v("action") === "gravando" ? "gravando áudio..." : "digitando..."}</p>
          </div>
        </>
      );
    }

    case "fakecall":
      return (
        <>
          <Field label="Nome do chamador" hint="Nome que aparece na mensagem de chamada"><input value={v("name")} maxLength={60} onChange={(e) => set("name", e.target.value)} className={INPUT} placeholder="Ex.: Maria" /></Field>
          <Field label="Vídeo da chamada" hint="Vídeo que o lead recebe ao atender (MP4 ou MOV, até 4 MB)"><Upload_ kind="video" url={v("videoUrl")} set={(u) => set("videoUrl", u)} /></Field>
          <Field label="Mensagem no chat" hint="Texto enviado antes dos botões"><TextArea id="f-fc" value={v("msg")} set={(t) => set("msg", t)} rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Botão Atender"><input value={v("acceptBtn")} maxLength={40} onChange={(e) => set("acceptBtn", e.target.value)} className={INPUT} /></Field>
            <Field label="Botão Recusar"><input value={v("declineBtn")} maxLength={40} onChange={(e) => set("declineBtn", e.target.value)} className={INPUT} /></Field>
          </div>
          <Note>Conecte a saída “Recusou” a outro bloco para recuperar quem não atendeu.</Note>
        </>
      );

    case "espera": {
      const u = v("u") || "minutos";
      const unitLabel: Record<string, string> = { segundos: "segundos", minutos: "minutos", horas: "horas", dias: "dias" };
      return (
        <Field label="Tempo de espera" hint={`O lead fica parado aqui por ${num(draft.n)} ${unitLabel[u]} e depois segue para o próximo bloco.`}>
          <div className="flex gap-2">
            <Num value={num(draft.n)} set={(x) => set("n", Math.max(0, Math.round(x)))} />
            <Seg value={u as "segundos"} set={(x) => set("u", x)} options={[["segundos", "seg"], ["minutos", "min"], ["horas", "horas"], ["dias", "dias"]]} />
          </div>
          <Presets
            items={[
              ["30 seg", () => { set("n", 30); set("u", "segundos"); }],
              ["5 min", () => { set("n", 5); set("u", "minutos"); }],
              ["30 min", () => { set("n", 30); set("u", "minutos"); }],
              ["1 hora", () => { set("n", 1); set("u", "horas"); }],
              ["1 dia", () => { set("n", 1); set("u", "dias"); }],
            ]}
          />
        </Field>
      );
    }

    case "condicao": {
      const rules = jsonList<CondRule>(draft.rules);
      const upd = (i: number, patch: Partial<CondRule>) => setJson("rules", rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
      return (
        <>
          <Note>O lead é avaliado de cima pra baixo e segue pelo primeiro caminho que bater. Se nenhum bater, vai pelo “Senão”.</Note>
          {rules.map((r, i) => (
            <div key={i} className="rounded-[12px] border border-white/[0.08] bg-[#0d0e11] p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-[#a78bfa]">SE</span>
                <select value={r.kind} onChange={(e) => upd(i, { kind: e.target.value as RuleKind, value: "", value2: "" })} className={`${INPUT} !py-1.5 flex-1`}>
                  {(Object.keys(RULE_LABEL) as RuleKind[]).map((k) => <option key={k} value={k}>{RULE_LABEL[k]}</option>)}
                </select>
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setJson("rules", moveItem(rules, i, -1))} aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" className={iconBtn} disabled={i === rules.length - 1} onClick={() => setJson("rules", moveItem(rules, i, 1))} aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
                <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => setJson("rules", rules.filter((_, j) => j !== i))} aria-label="Remover condição"><Trash2 className="w-4 h-4" /></button>
              </div>
              {r.kind === "horario" ? (
                <div className="flex items-center gap-2 text-[12.5px] text-[#8b8b94]">
                  entre <input type="time" value={r.value || "08:00"} onChange={(e) => upd(i, { value: e.target.value })} className={`${INPUT} !py-1.5`} /> e <input type="time" value={r.value2 || "18:00"} onChange={(e) => upd(i, { value2: e.target.value })} className={`${INPUT} !py-1.5`} />
                  <span className="shrink-0">(Brasília)</span>
                </div>
              ) : r.kind === "pagou" ? (
                <Seg value={(r.value || "sim") as "sim"} set={(x) => upd(i, { value: x })} options={[["sim", "Já pagou"], ["nao", "Ainda não pagou"]]} />
              ) : r.kind === "idioma" ? (
                <input value={r.value || ""} onChange={(e) => upd(i, { value: e.target.value.slice(0, 10) })} placeholder="pt, en, es…" className={INPUT} />
              ) : (
                <input value={r.value || ""} onChange={(e) => upd(i, { value: e.target.value.slice(0, 80) })} placeholder="Valor (use * para “qualquer valor”)" className={INPUT} />
              )}
            </div>
          ))}
          {rules.length < 8 && (
            <button type="button" onClick={() => setJson("rules", [...rules, { kind: "horario", value: "08:00", value2: "18:00" }])} className="h-10 rounded-[10px] border border-dashed border-white/[0.14] text-[13px] text-zinc-300 hover:text-white hover:border-white/[0.3] inline-flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />Adicionar {rules.length ? "outra " : ""}condição
            </button>
          )}
          <div className="rounded-[12px] border border-white/[0.08] bg-[#0d0e11] px-3.5 py-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-zinc-400">SENÃO</p>
            <p className="text-[12.5px] text-[#8b8b94] mt-0.5">Lead que não bater em nenhuma condição segue por aqui</p>
          </div>
          <Note>UTM vem do link de campanha do bot (t.me/seubot?start=…). Dispositivo, país e estado não são informados pelo Telegram, por isso não aparecem aqui.</Note>
        </>
      );
    }

    case "ab": {
      const vs = jsonList<AbVariant>(draft.variants);
      const total = vs.reduce((a, x) => a + num(x.pct), 0);
      return (
        <>
          <Field label="Caminhos">
            <div className="flex flex-col gap-2">
              {vs.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#fb923c]/15 text-[#fb923c] text-[12px] font-semibold flex items-center justify-center shrink-0">{"ABCDEFGH"[i]}</span>
                  <input value={x.name} maxLength={30} onChange={(e) => setJson("variants", vs.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className={`${INPUT} flex-1`} placeholder={`Caminho ${"ABCDEFGH"[i]}`} />
                  <span className="w-[110px] shrink-0"><Num value={num(x.pct)} set={(p) => setJson("variants", vs.map((y, j) => (j === i ? { ...y, pct: Math.max(0, Math.min(100, Math.round(p))) } : y)))} suffix="%" /></span>
                  <button type="button" className={`${iconBtn} hover:!text-red-400`} disabled={vs.length <= 2} onClick={() => setJson("variants", vs.filter((_, j) => j !== i))} aria-label="Remover caminho"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between">
            {vs.length < 8 ? (
              <button type="button" onClick={() => setJson("variants", [...vs, { name: "ABCDEFGH"[vs.length], pct: 0 }])} className="inline-flex items-center gap-1.5 text-[13px] text-[#60a5fa] hover:text-[#93c5fd]"><Plus className="w-4 h-4" />Adicionar caminho</button>
            ) : <span />}
            <span className={`text-[12.5px] tabular-nums ${total === 100 ? "text-emerald-400" : "text-amber-400"}`}>Total: {total}%</span>
          </div>
          {total !== 100 && <Note>A soma precisa dar 100% para a divisão ficar exata.</Note>}
        </>
      );
    }

    case "input":
      return (
        <>
          <Field label="Pergunta" hint="O bot envia esta pergunta e espera a resposta do lead."><TextArea id="f-in" value={v("text")} set={(t) => set("text", t)} rows={3} /></Field>
          <Field label="Tipo de resposta">
            <Seg value={(v("kind") || "texto") as "texto"} set={(k) => set("kind", k)} options={[["texto", "Texto"], ["numero", "Número"], ["email", "E-mail"], ["telefone", "Telefone"]]} />
          </Field>
          <Field label="Tempo para responder" hint="Sem resposta nesse tempo, o fluxo segue pela saída Timeout.">
            <div className="flex gap-2">
              <Num value={num(draft.wait)} set={(x) => set("wait", Math.max(1, Math.round(x)))} min={1} />
              <Seg value={(v("u") || "segundos") as "segundos"} set={(x) => set("u", x)} options={[["segundos", "seg"], ["minutos", "min"], ["horas", "horas"]]} />
            </div>
          </Field>
          <Field label="Guardar resposta como" hint={`Use {${v("var") || "resposta"}} nas próximas mensagens.`}>
            <input value={v("var")} maxLength={30} onChange={(e) => set("var", e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())} className={INPUT} placeholder="resposta" />
          </Field>
        </>
      );

    case "pagamento":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)"><Num value={num(draft.value)} set={(x) => set("value", Math.max(0, Math.round(x * 100) / 100))} step={0.01} /></Field>
            <Field label="Timeout" hint="Sem pagamento nesse tempo, segue por “Expirou”."><Num value={num(draft.timeout)} set={(x) => set("timeout", Math.max(1, Math.round(x)))} min={1} suffix="min" /></Field>
          </div>
          <Field label="Descrição" hint="Nome da cobrança que o lead vê (ex.: Plano mensal VIP)."><input value={v("desc")} maxLength={120} onChange={(e) => set("desc", e.target.value)} className={INPUT} /></Field>
          <Field label="Tipo de venda">
            <Seg value={(v("saleType") || "principal") as "principal"} set={(x) => set("saleType", x)} options={[["principal", "Principal"], ["upsell", "Upsell"], ["downsell", "Downsell"], ["bump", "Order Bump"], ["remarketing", "Remarketing"]]} />
          </Field>
          <Field label="QR Code">
            <Seg value={(v("qr") || "botao") as "botao"} set={(x) => set("qr", x)} options={[["botao", "Por botão"], ["junto", "Junto do Pix"], ["nao", "Não enviar"]]} />
          </Field>
          <Field label="Mensagem personalizada" aside="opcional" hint="Vazio usa a mensagem padrão. Use {valor} e {descricao}; o código Pix vai logo abaixo.">
            <TextArea id="f-pay" value={v("msg")} set={(t) => set("msg", t)} rows={3} vars={["{nome}", "{valor}", "{descricao}"]} />
          </Field>
          <Note>O fluxo pausa até o pagamento ser confirmado. Conecte a saída “Pagou” e, se quiser recuperar, a “Expirou”.</Note>
        </>
      );

    case "grupo":
      return (
        <>
          <Field label="Grupo" hint="Grupo ou canal onde o lead será adicionado. O bot precisa ser admin com permissão de convidar e banir.">
            {chats.length ? (
              <select value={v("chatId")} onChange={(e) => set("chatId", e.target.value)} className={`${INPUT} cursor-pointer`}>
                <option value="">Escolha…</option>
                {chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            ) : (
              <Note>Nenhum grupo encontrado. Ligue o fluxo a um bot e adicione o bot como administrador do grupo ou canal.</Note>
            )}
          </Field>
          <Field label="Tempo de acesso" hint="Depois desse período o lead é removido e o fluxo segue pela saída “Expirado”. 0 = sem vencimento.">
            <Num value={num(draft.days)} set={(x) => set("days", Math.max(0, Math.round(x)))} suffix="dias" />
            <Presets items={[7, 30, 90, 365, 0].map((d) => [d ? `${d} dias` : "Vitalício", () => set("days", d)])} />
          </Field>
        </>
      );

    case "bottaxa": {
      const others = storeBots.filter((b) => !currentBotIds.includes(b.id));
      return (
        <>
          <Note>A entrega será feita por outro bot. O lead recebe “👉 Clique no botão abaixo para acessar:” com um botão que abre o bot de destino já no /start.</Note>
          <Field label="Bot de destino" hint="O lead será direcionado para este bot.">
            {others.length ? (
              <select value={v("botId")} onChange={(e) => set("botId", e.target.value)} className={`${INPUT} cursor-pointer`}>
                <option value="">Escolha…</option>
                {others.map((b) => <option key={b.id} value={b.id}>@{b.username}</option>)}
              </select>
            ) : (
              <Note>Você não tem outros bots. Crie um bot no painel para usá-lo como destino da entrega.</Note>
            )}
          </Field>
          <Field label="Texto do botão" hint="Se vazio, usa “🤖 Acessar {nome do bot}”."><input value={v("btnText")} maxLength={64} onChange={(e) => set("btnText", e.target.value)} className={INPUT} /></Field>
        </>
      );
    }

    case "remover":
      return (
        <>
          <Field label="ID do grupo" aside="opcional" hint="Deixe vazio para tirar o lead do grupo do último acesso liberado. O ID de grupos começa com -100.">
            <input value={v("groupId")} maxLength={20} onChange={(e) => set("groupId", e.target.value.replace(/[^\d-]/g, ""))} className={INPUT} placeholder="-1001234567890" />
          </Field>
          <Note>O bot precisa ser administrador do grupo com permissão para banir usuários.</Note>
        </>
      );

    case "pixel":
      return (
        <>
          <Field label="Evento">
            <select value={v("event")} onChange={(e) => set("event", e.target.value)} className={`${INPUT} cursor-pointer`}>
              <option value="">Escolha…</option>
              {[["PageView", "Visualizou"], ["Lead", "Virou lead"], ["AddToCart", "Adicionou ao carrinho"], ["InitiateCheckout", "Iniciou pagamento"], ["Purchase", "Comprou"], ["CompleteRegistration", "Concluiu cadastro"]].map(([k, l]) => (
                <option key={k} value={k}>{k} · {l}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor (R$)" aside="opcional" hint="Vazio = usa o valor do último pagamento deste lead no fluxo."><Num value={num(draft.value)} set={(x) => set("value", Math.max(0, x))} step={0.01} /></Field>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Facebook Pixel ID"><input value={v("fbPixelId")} maxLength={40} onChange={(e) => set("fbPixelId", e.target.value.replace(/\D/g, ""))} className={INPUT} placeholder="123456789012345" /></Field>
            <Field label="Token da API de Conversões"><input value={v("fbToken")} maxLength={400} onChange={(e) => set("fbToken", e.target.value.trim())} className={INPUT} placeholder="EAAB…" /></Field>
          </div>
        </>
      );

    case "nota":
      return <Field label="Nota (só você vê)"><textarea rows={5} maxLength={4000} value={v("text")} onChange={(e) => set("text", e.target.value)} className={`${INPUT} resize-y`} /></Field>;

    case "mensagem":
      return <MessageForm draft={draft} set={set} />;

    default:
      return <Note>Este é um bloco da versão anterior. Ele continua funcionando; para mudar, troque por um bloco novo da lista.</Note>;
  }
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

  return (
    <>
      <Field label="Conteúdo">
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-[12px] border border-white/[0.08] bg-[#0d0e11] p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-zinc-300">{it.t === "texto" ? "Texto" : it.t === "midia" ? "Mídia" : "Delay"}</span>
                <span className="ml-auto flex">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setItems(moveItem(items, i, -1))} aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => setItems(moveItem(items, i, 1))} aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remover item"><Trash2 className="w-4 h-4" /></button>
                </span>
              </div>
              {it.t === "texto" && <TextArea id={`f-m-${i}`} value={it.text || ""} set={(t) => upd(i, { text: t })} rows={3} />}
              {it.t === "midia" && <Upload_ kind="visual" url={it.url || ""} set={(u) => upd(i, { url: u })} />}
              {it.t === "delay" && <Num value={num(it.sec)} set={(x) => upd(i, { sec: Math.max(1, Math.min(60, Math.round(x))) })} min={1} suffix="segundos" />}
              {it.t !== "delay" && (
                <label className="flex items-center gap-2 text-[12.5px] text-[#9aa0aa] cursor-pointer">
                  <input type="checkbox" checked={!!it.spoiler} onChange={(e) => upd(i, { spoiler: e.target.checked })} className="accent-[#3b82f6]" />
                  Spoiler — fica escondido até o lead tocar
                </label>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            {(["texto", "midia", "delay"] as const).map((t) => (
              <button key={t} type="button" disabled={items.length >= 12} onClick={() => add(t)} className="flex-1 h-9 rounded-[9px] border border-dashed border-white/[0.14] text-[12.5px] text-zinc-300 hover:text-white hover:border-white/[0.3] disabled:opacity-40">
                + {t === "texto" ? "Texto" : t === "midia" ? "Mídia" : "Delay"}
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field label="Botões" aside="opcional" hint="Quando há botões, o fluxo pausa até o lead clicar. Botão com link abre o link e não cria caminho.">
        <div className="flex flex-col gap-2">
          {buttons.map((b, i) => (
            <div key={i} className="flex gap-2">
              <input value={b.label} maxLength={64} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={`${INPUT} flex-1`} placeholder="Texto do botão" />
              <input value={b.url || ""} maxLength={500} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)))} className={`${INPUT} flex-1`} placeholder="Link (opcional)" />
              <button type="button" className={`${iconBtn} !w-9 !h-9 hover:!text-red-400`} onClick={() => setButtons(buttons.filter((_, j) => j !== i))} aria-label="Remover botão"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {buttons.length < 8 && (
            <button type="button" onClick={() => setButtons([...buttons, { label: "" }])} className="h-9 rounded-[9px] border border-dashed border-white/[0.14] text-[12.5px] text-zinc-300 hover:text-white hover:border-white/[0.3]">+ Botão</button>
          )}
        </div>
      </Field>

      {buttons.length > 0 && (
        <>
          <Field label="Texto acima dos botões" aside="opcional" hint="Se preenchido, os botões vão numa mensagem separada com este texto.">
            <input value={str(draft.btnText)} maxLength={300} onChange={(e) => set("btnText", e.target.value)} className={INPUT} />
          </Field>
          <Field label="Timeout automático" hint="Se o lead não clicar em nenhum botão, segue pela saída “Sem clique” depois desse tempo. 0 = espera para sempre.">
            <Num value={num(draft.timeout)} set={(x) => set("timeout", Math.max(0, Math.round(x)))} suffix="min" />
          </Field>
        </>
      )}
    </>
  );
}
