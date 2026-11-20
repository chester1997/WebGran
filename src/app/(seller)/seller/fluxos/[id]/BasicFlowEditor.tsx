"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import {
  basicStepStatus,
  DELAY_OPTIONS,
  MAX_MEDIA,
  MAX_MIMOS,
  MAX_PLANS,
  MAX_RECOVERY,
  MAX_UPSELLS,
  normalizeBasicConfig,
  type BasicFlowConfig,
  type BasicStepId,
  type ButtonColor,
} from "@/lib/flows/basic-config";
import { saveFlowConfigAction } from "../actions";
import { BTN_GHOST, BTN_SEC, CARD, Callout, INPUT, useToast } from "../_components/flow-ui";
import EditorTopBar, { type ChecklistItem, type SaveState } from "../_components/EditorTopBar";
import TelegramPreview, { previewHtml, type PreviewButton, type PreviewItem } from "../_components/TelegramPreview";
import Toaster from "../_components/Toaster";

export interface FlowProduct {
  id: string;
  title: string;
  price: number;
  duration: string;
}
export interface FlowChat {
  id: string;
  title: string;
  type: string;
  canInvite: boolean;
}

const DURATION: Record<string, string> = {
  daily: "1 dia", weekly: "7 dias", monthly: "30 dias", quarterly: "90 dias", semiannual: "6 meses", annual: "1 ano", lifetime: "Vitalício",
};
const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const PIX_SAMPLE = "00020126580014BR.GOV.BCB.PIX0136a3f1c9e2-77b4-4d10-9f2b-1c6e5204000053039865406";

const STEPS: { group: string; items: [BasicStepId, string, string][] }[] = [
  { group: "Jornada da venda", items: [["inicio", "Início", "Boas-vindas do /start"], ["planos", "Planos", "Produtos que viram botões"], ["bump", "Order Bump", "Oferta antes do Pix"], ["pix", "Pix", "Mensagem de pagamento"], ["entrega", "Entrega", "Acesso depois de pagar"]] },
  { group: "Depois da venda", items: [["upsell", "Upsell", "Ofertas pós-compra"], ["recup", "Recuperação", "Quem não comprou"], ["renov", "Renovação", "Quando o acesso vence"]] },
  { group: "Extras", items: [["mimos", "Mimos", "Presentes em dinheiro"], ["botoes", "Botões", "Cores no Telegram"], ["suporte", "Suporte", "Comando /suporte"]] },
  { group: "Divulgação", items: [["disparo", "Disparos", "Mensagem em massa"], ["rastreio", "Rastreamento", "Pixels e UTMs"]] },
];
const ALL_STEPS = STEPS.flatMap((g) => g.items);

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */
function Card({ title, sub, right, children }: { title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={CARD}>
      <header className="px-5 pt-4 pb-3.5 border-b border-white/[0.07] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {sub && <p className="text-[13px] text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        {right}
      </header>
      <div className="px-5 py-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <span className="flex justify-between gap-2 text-[12.5px] font-semibold text-zinc-300">{children}{aside}</span>;
}

function TextField({ id, label, value, onChange, placeholder, hint, max = 300 }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function NumField({ id, label, value, onChange, hint, step = 1, min = 0, max }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <input id={id} type="number" inputMode="decimal" step={step} min={min} max={max} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={INPUT} />
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function AreaField({ id, label, value, onChange, vars, rows = 5, max = 4000 }: { id: string; label: string; value: string; onChange: (v: string) => void; vars: string[]; rows?: number; max?: number }) {
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
        <span className="text-[11.5px] text-zinc-500 mr-0.5">Variáveis:</span>
        {vars.map((v) => (
          <button key={v} type="button" onClick={() => insert(v)} className="font-mono text-[11.5px] px-2 py-0.5 rounded-[7px] border border-[#3984FF]/30 text-[#60a5fa] bg-[#3984FF]/[0.1] hover:brightness-125">{v}</button>
        ))}
        <span className="text-[11.5px] text-zinc-500 ml-1.5 mr-0.5">Formato:</span>
        {(["b", "i", "u", "code"] as const).map((t) => (
          <button key={t} type="button" onClick={() => insert(`<${t}>`, `</${t}>`)} className="font-mono text-[11.5px] px-2 py-0.5 rounded-[7px] border border-white/[0.13] text-zinc-400 hover:text-white">{`<${t}>`}</button>
        ))}
      </span>
    </label>
  );
}

function Toggle({ title, desc, checked, onChange }: { title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-white">{title}</p>
        {desc && <p className="text-[12.5px] text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#3984FF]" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label?: string }) {
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

const COLOR_OPTS: [ButtonColor, string, string][] = [["none", "Sem cor", "bg-zinc-600"], ["blue", "Azul", "bg-[#3a7bd5]"], ["green", "Verde", "bg-[#2e9e5b]"], ["red", "Vermelho", "bg-[#d14b4b]"]];
function ColorPick({ value, onChange }: { value: ButtonColor; onChange: (v: ButtonColor) => void }) {
  return (
    <div role="group" aria-label="Cor do botão" className="flex gap-1.5">
      {COLOR_OPTS.map(([c, l, bg]) => (
        <button key={c} type="button" title={l} aria-label={l} aria-pressed={value === c} onClick={() => onChange(c)} className={`w-[22px] h-[22px] rounded-full border-2 ${bg} ${value === c ? "border-white" : "border-transparent"}`} />
      ))}
    </div>
  );
}

function Select({ id, label, value, onChange, options, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: string }) {
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

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */
type Updater = (fn: (draft: BasicFlowConfig) => void) => void;

export default function BasicFlowEditor({
  flowId,
  name,
  status,
  bots,
  products,
  chats,
  botName,
  initialConfig,
}: {
  flowId: string;
  name: string;
  status: "draft" | "published";
  bots: { id: string; username: string }[];
  products: FlowProduct[];
  chats: FlowChat[];
  botName: string;
  initialConfig: BasicFlowConfig;
}) {
  const toast = useToast();
  const [config, setConfig] = useState<BasicFlowConfig>(() => normalizeBasicConfig(initialConfig));
  const [step, setStep] = useState<BasicStepId>("inicio");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const lastSaved = useRef<string | null>(null);
  const seq = useRef(0);
  const formRef = useRef<HTMLDivElement>(null);

  const update: Updater = useCallback((fn) => {
    setConfig((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  // Salvamento automático (1,2 s depois da última mudança).
  useEffect(() => {
    const snapshot = JSON.stringify(config);
    if (lastSaved.current === null) lastSaved.current = snapshot;
    if (snapshot === lastSaved.current) {
      setSaveState((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    setSaveState("dirty");
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveFlowConfigAction(flowId, config);
      if (id !== seq.current) return;
      if (!res.success) {
        setSaveState("error");
        toast(res.error, "err");
      } else {
        lastSaved.current = snapshot;
        setSaveState("saved");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [config, flowId, toast]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activePlans = config.planos.items.filter((p) => p.on && productById.has(p.productId)).map((p) => ({ ...p, product: productById.get(p.productId)! }));

  const goto = (s: BasicStepId) => {
    setStep(s);
    if (window.innerWidth < 1024) formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const checklist: ChecklistItem[] = [
    { label: "Mensagem de boas-vindas", ok: basicStepStatus("inicio", config)[0] === "ok", required: true, onFix: () => goto("inicio") },
    { label: "Pelo menos um plano", ok: activePlans.length > 0, required: true, onFix: () => goto("planos") },
    { label: "Mensagem do Pix", ok: basicStepStatus("pix", config)[0] === "ok", required: true, onFix: () => goto("pix") },
    { label: "Destino da entrega", ok: basicStepStatus("entrega", config)[0] === "ok", required: true, onFix: () => goto("entrega") },
    { label: "Recuperação de quem não pagou", ok: config.recup.items.length > 0, required: false, onFix: () => goto("recup") },
  ];

  const statusOf = (id: BasicStepId) => (id === "planos" ? (activePlans.length ? (["ok", `${activePlans.length} ${activePlans.length === 1 ? "plano" : "planos"}`] as const) : (["pend", "Nenhum plano"] as const)) : basicStepStatus(id, config));
  const current = ALL_STEPS.find((s) => s[0] === step)!;
  const [st, stLabel] = statusOf(step);

  return (
    <div className="w-full max-w-full pb-10 space-y-5">
      <Toaster />
      <SellerPageHeader title={name} subtitle="Fluxo básico · venda na conversa" />
      <EditorTopBar flowId={flowId} name={name} type="basic" status={status} bots={bots} saveState={saveState} checklist={checklist} />

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_370px] gap-4 items-start">
        <nav aria-label="Etapas do fluxo" className={`${CARD} p-2.5 lg:sticky lg:top-4 flex lg:flex-col gap-3 overflow-x-auto`}>
          {(() => {
            let n = 0;
            return STEPS.map((g) => (
              <div key={g.group} className="flex lg:flex-col gap-0.5 shrink-0">
                <p className="hidden lg:block text-[10.5px] tracking-[0.08em] font-semibold text-zinc-500 uppercase px-2.5 pt-1.5 pb-1">{g.group}</p>
                {g.items.map(([id, label, sub]) => {
                  n++;
                  const [s] = statusOf(id);
                  const on = step === id;
                  return (
                    <button key={id} type="button" onClick={() => goto(id)} aria-current={on ? "step" : undefined} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left whitespace-nowrap ${on ? "bg-[#3984FF]/[0.12]" : "hover:bg-white/[0.04]"}`}>
                      <span className={`w-[22px] h-[22px] rounded-[7px] border text-[11px] tabular-nums flex items-center justify-center shrink-0 ${on ? "bg-[#3984FF] border-[#3984FF] text-white" : "border-white/[0.13] text-zinc-400"}`}>{n}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-white">{label}</span>
                        <span className="hidden lg:block text-[11.5px] text-zinc-500 truncate">{sub}</span>
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${s === "ok" ? "bg-emerald-400" : s === "pend" ? "bg-amber-400" : "border border-zinc-600"}`} />
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </nav>

        <div ref={formRef} className="flex flex-col gap-4 min-w-0 scroll-mt-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[19px] font-semibold text-white">{current[1]}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11.5px] font-semibold ${st === "ok" ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.08]" : st === "pend" ? "text-amber-400 border-amber-500/25 bg-amber-500/[0.08]" : "text-zinc-400 border-white/[0.13]"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />{stLabel}
            </span>
          </div>
          <StepForm step={step} config={config} update={update} products={products} productById={productById} chats={chats} bots={bots} />
        </div>

        <aside className="lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4 flex flex-col gap-2.5" aria-label="Prévia no Telegram">
          <div className="flex justify-between text-[12.5px] text-zinc-500"><span>{step === "rastreio" ? "Eventos enviados" : "Como o cliente vê"}</span><span>Prévia</span></div>
          {step === "rastreio" ? <TrackingPreview config={config} /> : <TelegramPreview title={botName} items={buildPreview(step, config, activePlans)} />}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulários por etapa                                               */
/* ------------------------------------------------------------------ */
function StepForm({
  step,
  config: c,
  update,
  products,
  productById,
  chats,
  bots,
}: {
  step: BasicStepId;
  config: BasicFlowConfig;
  update: Updater;
  products: FlowProduct[];
  productById: Map<string, FlowProduct>;
  chats: FlowChat[];
  bots: { id: string; username: string }[];
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMedia = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("Por enquanto só imagens. Vídeo e áudio chegam na próxima etapa.", "err");
      return;
    }
    setUploading(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "banners");
      update((d) => {
        if (d.inicio.media.length < MAX_MEDIA) d.inicio.media.push(res.url);
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha ao enviar a imagem.", "err");
    } finally {
      setUploading(false);
    }
  };

  switch (step) {
    case "inicio":
      return (
        <>
          <p className="text-zinc-400 -mt-2">O que o cliente recebe ao mandar /start no seu bot.</p>
          <Card title="Mídias de boas-vindas" sub={`Até ${MAX_MEDIA} imagens. Vídeo e áudio chegam na próxima etapa.`}>
            <div className="flex flex-wrap gap-2.5">
              {c.inicio.media.map((url, i) => (
                <div key={url + i} className="relative w-[92px] h-[92px] rounded-xl overflow-hidden border border-white/[0.13]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Mídia ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remover mídia" onClick={() => update((d) => { d.inicio.media.splice(i, 1); })} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {c.inicio.media.length < MAX_MEDIA && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-[92px] h-[92px] rounded-xl border border-dashed border-white/[0.2] text-[#60a5fa] text-[12px] flex flex-col items-center justify-center gap-1 hover:bg-white/[0.03]">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  {uploading ? "Enviando" : "Adicionar"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.target.value = ""; }} />
            </div>
            {c.inicio.media.length > 1 && <Seg label="Como enviar" value={c.inicio.sendMode} onChange={(v) => update((d) => { d.inicio.sendMode = v; })} options={[["album", "Álbum (juntas)"], ["seq", "Uma por vez"]]} />}
          </Card>
          <Card title="Mensagens">
            <AreaField id="f-inicio-msg" label="Mensagem principal" value={c.inicio.msg} onChange={(v) => update((d) => { d.inicio.msg = v; })} vars={["{nome}", "{saudacao}", "{localizacao}"]} />
            <AreaField id="f-inicio-msg2" label="Mensagem secundária (opcional)" rows={2} value={c.inicio.msg2} onChange={(v) => update((d) => { d.inicio.msg2 = v; })} vars={["{nome}", "{saudacao}"]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <TextField id="f-inicio-btn" label="Texto do botão inicial" max={64} value={c.inicio.btn} onChange={(v) => update((d) => { d.inicio.btn = v; })} hint="Abre a lista de planos." />
              <div className="flex flex-col gap-1.5"><Label>Cor do botão</Label><ColorPick value={c.botoes.cta} onChange={(v) => update((d) => { d.botoes.cta = v; })} /><span className="text-[12px] text-zinc-500">A mesma da etapa Botões.</span></div>
            </div>
          </Card>
          <Card title="Proteção">
            <Toggle title="Anti-Clone" desc="Bloqueia encaminhar, salvar e copiar as mensagens e mídias do bot." checked={c.inicio.antiClone} onChange={(v) => update((d) => { d.inicio.antiClone = v; })} />
          </Card>
        </>
      );

    case "planos": {
      const onCount = c.planos.items.filter((p) => p.on && productById.has(p.productId)).length;
      return (
        <>
          <p className="text-zinc-400 -mt-2">Os planos são os seus produtos. Preço, duração e entrega vêm do cadastro de Produtos.</p>
          <Card title="Planos deste fluxo" sub={`Até ${MAX_PLANS}. Marque quais aparecem como botões e escolha a cor de cada um.`}>
            <TextField id="f-planos-msg" label="Mensagem acima dos planos" max={1000} value={c.planos.msg} onChange={(v) => update((d) => { d.planos.msg = v; })} />
            {products.length === 0 && <Callout tone="warn">Você ainda não tem produtos ativos. Crie em Produtos e volte aqui.</Callout>}
            {products.map((p) => {
              const item = c.planos.items.find((x) => x.productId === p.id);
              const on = !!item?.on;
              return (
                <div key={p.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-3.5 items-center px-3.5 py-3 rounded-xl border border-white/[0.08] bg-[#0d0e12] ${on ? "" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    className="w-[18px] h-[18px] accent-[#3984FF]"
                    aria-label={`Usar ${p.title}`}
                    checked={on}
                    disabled={!on && onCount >= MAX_PLANS}
                    onChange={(e) => update((d) => {
                      const ex = d.planos.items.find((x) => x.productId === p.id);
                      if (ex) ex.on = e.target.checked;
                      else d.planos.items.push({ productId: p.id, on: e.target.checked, color: "none" });
                    })}
                  />
                  <div className="min-w-0"><p className="text-[13.5px] font-semibold text-white truncate">{p.title}</p><p className="text-[12px] text-zinc-500">{DURATION[p.duration] || p.duration}</p></div>
                  <span className="font-semibold tabular-nums text-white">{brl(p.price)}</span>
                  <div className="col-span-3 sm:col-span-1 pl-8 sm:pl-0">
                    <ColorPick value={item?.color || "none"} onChange={(v) => update((d) => {
                      const ex = d.planos.items.find((x) => x.productId === p.id);
                      if (ex) ex.color = v;
                      else d.planos.items.push({ productId: p.id, on: false, color: v });
                    })} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card title="Variação de centavos" sub="Muda os centavos de cada cobrança para o Pix não ser barrado por antifraude.">
            <Toggle title="Variar centavos do preço" desc="Ex.: R$ 19,90 pode sair R$ 19,73 ou R$ 20,12." checked={c.planos.varOn} onChange={(v) => update((d) => { d.planos.varOn = v; })} />
            {c.planos.varOn && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <NumField id="f-var-cents" label="Variação máxima (centavos)" min={1} max={99} value={c.planos.varCents} onChange={(v) => update((d) => { d.planos.varCents = Math.min(99, Math.max(1, Math.round(v) || 1)); })} />
                <Seg label="Direção" value={c.planos.varDir} onChange={(v) => update((d) => { d.planos.varDir = v; })} options={[["ambos", "↕ Ambos"], ["cima", "↑ Para cima"], ["baixo", "↓ Para baixo"]]} />
              </div>
            )}
          </Card>
        </>
      );
    }

    case "bump":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Uma oferta extra depois de escolher o plano e antes do Pix.</p>
          <Card title="Oferta" right={<Toggle title={c.bump.on ? "Ligado" : "Desligado"} checked={c.bump.on} onChange={(v) => update((d) => { d.bump.on = v; })} />}>
            {!c.bump.on ? (
              <Callout>Desligado. O cliente vai direto para o Pix depois de escolher o plano.</Callout>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <Select id="f-bump-scope" label="Aparece em" value={c.bump.productScope} onChange={(v) => update((d) => { d.bump.productScope = v; })} options={[["todos", "Todos os planos"], ...products.map((p) => [p.id, "Só no " + p.title] as [string, string])]} />
                  <TextField id="f-bump-name" label="Nome da oferta" max={100} value={c.bump.name} onChange={(v) => update((d) => { d.bump.name = v; })} />
                </div>
                <NumField id="f-bump-price" label="Preço (R$)" step={0.01} value={c.bump.price} onChange={(v) => update((d) => { d.bump.price = v; })} />
                <AreaField id="f-bump-msg" label="Mensagem da oferta" rows={3} value={c.bump.msg} onChange={(v) => update((d) => { d.bump.msg = v; })} vars={["{nome}", "{plano}"]} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <TextField id="f-bump-yes" label="Botão aceitar" max={64} value={c.bump.yes} onChange={(v) => update((d) => { d.bump.yes = v; })} />
                  <TextField id="f-bump-no" label="Botão recusar" max={64} value={c.bump.no} onChange={(v) => update((d) => { d.bump.no = v; })} />
                </div>
                <AreaField id="f-bump-msgyes" label="Mensagem se aceitar (opcional)" rows={2} value={c.bump.msgYes} onChange={(v) => update((d) => { d.bump.msgYes = v; })} vars={["{nome}"]} />
                <AreaField id="f-bump-msgno" label="Mensagem se recusar (opcional)" rows={2} value={c.bump.msgNo} onChange={(v) => update((d) => { d.bump.msgNo = v; })} vars={["{nome}"]} />
                <div className="flex flex-col gap-2">
                  <Label>Oferecer também em</Label>
                  <label className="flex items-center gap-2.5 text-[13px] text-zinc-300"><input type="checkbox" className="w-[18px] h-[18px] accent-[#3984FF]" checked={c.bump.inUpsell} onChange={(e) => update((d) => { d.bump.inUpsell = e.target.checked; })} />Ofertas de Upsell</label>
                  <label className="flex items-center gap-2.5 text-[13px] text-zinc-300"><input type="checkbox" className="w-[18px] h-[18px] accent-[#3984FF]" checked={c.bump.inRecovery} onChange={(e) => update((d) => { d.bump.inRecovery = e.target.checked; })} />Mensagens de Recuperação</label>
                </div>
              </>
            )}
          </Card>
        </>
      );

    case "pix":
      return (
        <>
          <p className="text-zinc-400 -mt-2">A mensagem com o código do Pix. O gateway é o que está em Gateways.</p>
          <Card title="Mensagem do Pix">
            <AreaField id="f-pix-msg" label="Mensagem" value={c.pix.msg} onChange={(v) => update((d) => { d.pix.msg = v; })} vars={["{nome}", "{plano}", "{valor}", "{duracao}"]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Seg label="Onde vai o código" value={c.pix.pos} onChange={(v) => update((d) => { d.pix.pos = v; })} options={[["junto", "Na mesma mensagem"], ["separada", "Mensagem separada"]]} />
              <Seg label="Formato do código" value={c.pix.fmt} onChange={(v) => update((d) => { d.pix.fmt = v; })} options={[["caixa", "Caixa"], ["pre", "Bloco"], ["code", "Simples"]]} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Seg label="QR Code" value={c.pix.qr} onChange={(v) => update((d) => { d.pix.qr = v; })} options={[["off", "Não enviar"], ["botao", "Por botão"], ["direto", "Junto do Pix"]]} />
              <TextField id="f-pix-verify" label="Botão de verificar pagamento" max={64} value={c.pix.verify} onChange={(v) => update((d) => { d.pix.verify = v; })} />
            </div>
          </Card>
          <Card title="Provas sociais" sub="Avisos curtos embaixo do Pix para criar urgência.">
            <Toggle title="Mostrar provas sociais" desc="Trocam sozinhas enquanto o Pix está aberto." checked={c.pix.proof} onChange={(v) => update((d) => { d.pix.proof = v; })} />
            {c.pix.proof && (
              <>
                <NumField id="f-proof-int" label="Trocar a cada (segundos)" min={3} max={30} hint="Entre 3 e 30. Use {random} (3 a 10) e {localizacao}." value={c.pix.proofInterval} onChange={(v) => update((d) => { d.pix.proofInterval = Math.min(30, Math.max(3, Math.round(v) || 3)); })} />
                {c.pix.proofMsgs.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Aviso ${i + 1}`} value={m} maxLength={300} onChange={(e) => update((d) => { d.pix.proofMsgs[i] = e.target.value; })} className={INPUT} />
                    <button type="button" aria-label="Remover aviso" onClick={() => update((d) => { d.pix.proofMsgs.splice(i, 1); })} className="w-9 h-9 shrink-0 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {c.pix.proofMsgs.length < 10 && <button type="button" className={`${BTN_GHOST} self-start`} onClick={() => update((d) => { d.pix.proofMsgs.push("✅ Mais um acesso liberado agora"); })}><Plus className="w-4 h-4" />Adicionar aviso</button>}
              </>
            )}
          </Card>
          <Card title="Pix reserva" sub="Se o banco do cliente recusar, ele gera o Pix em outro gateway.">
            <Toggle title="Botão “Problemas para pagar?”" desc="Usa o segundo gateway conectado em Gateways." checked={c.pix.fallback} onChange={(v) => update((d) => { d.pix.fallback = v; })} />
            {c.pix.fallback && <Callout tone="warn">Funciona só com <b>2 gateways</b> conectados em Gateways.</Callout>}
          </Card>
        </>
      );

    case "entrega":
      return (
        <>
          <p className="text-zinc-400 -mt-2">O que o cliente recebe quando o pagamento é aprovado.</p>
          <Card title="Entrega principal">
            <Seg label="Tipo de entrega" value={c.entrega.tipo} onChange={(v) => update((d) => { d.entrega.tipo = v; })} options={[["grupo", "Grupo ou canal"], ["link", "Link"], ["texto", "Só mensagem"]]} />
            {c.entrega.tipo === "grupo" &&
              (bots.length === 0 ? (
                <Callout tone="warn">Ligue este fluxo a um bot (em Meus Fluxos) para listar os grupos e canais dele.</Callout>
              ) : chats.length === 0 ? (
                <Callout tone="warn">O bot ligado ainda não está como administrador em nenhum grupo ou canal.</Callout>
              ) : (
                <Select
                  id="f-entrega-chat"
                  label="Grupo ou canal"
                  value={c.entrega.chatId}
                  onChange={(v) => update((d) => { d.entrega.chatId = v; })}
                  options={[["", "Escolha…"], ...chats.map((ch) => [ch.id, `${ch.title}${ch.canInvite ? "" : " (sem permissão de convidar)"}`] as [string, string])]}
                  hint="Entra e sai sozinho quando o acesso vence. O bot precisa poder convidar usuários."
                />
              ))}
            {c.entrega.tipo === "link" && <TextField id="f-entrega-link" label="Link de entrega" max={1000} placeholder="https://" value={c.entrega.link} onChange={(v) => update((d) => { d.entrega.link = v; })} hint="Drive, Mega etc. Sem remoção automática." />}
            {c.entrega.tipo === "texto" && <Callout>O cliente recebe só a mensagem abaixo. Bom para códigos, senhas ou instruções.</Callout>}
          </Card>
          <Card title="Mensagem de entrega">
            <AreaField id="f-entrega-msg" label="Mensagem" value={c.entrega.msg} onChange={(v) => update((d) => { d.entrega.msg = v; })} vars={["{nome}", "{plano}", "{valor}", "{link_vip}"]} />
          </Card>
          <Card title="Entregas das ofertas" sub="Order Bump, Upsell e Recuperação podem entregar em outro lugar.">
            {([["bump", "Order Bump"], ["upsell", "Upsell"], ["recovery", "Recuperação"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[13.5px] font-semibold text-white">{l}</span>
                <Seg value={c.entrega[k]} onChange={(v) => update((d) => { d.entrega[k] = v; })} options={[["padrao", "Usa a principal"], ["propria", "Entrega própria"]]} />
              </div>
            ))}
            <p className="text-[12px] text-zinc-500">A entrega própria de cada oferta é configurada quando o envio de ofertas for ligado.</p>
          </Card>
        </>
      );

    case "upsell":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Ofertas enviadas depois de uma compra aprovada. Até {MAX_UPSELLS}.</p>
          <Card title="Como enviar">
            <Seg value={c.upsell.mode} onChange={(v) => update((d) => { d.upsell.mode = v; })} options={[["padrao", "Todas no seu tempo"], ["sequencial", "Uma depois da outra"]]} />
            <p className="text-[12px] text-zinc-500 -mt-2">{c.upsell.mode === "sequencial" ? "O cliente só recebe a próxima oferta depois de responder a anterior." : "Cada oferta sai no tempo configurado nela, mesmo sem resposta."}</p>
          </Card>
          {c.upsell.items.map((u, i) => (
            <div key={i} className="rounded-[14px] border border-white/[0.08] bg-[#0d0e12] p-4 flex flex-col gap-3.5">
              <div className="flex items-center justify-between"><b className="text-[13.5px] text-white">{i + 1}. {u.name}</b><button type="button" aria-label="Remover oferta" onClick={() => update((d) => { d.upsell.items.splice(i, 1); })} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <TextField id={`f-up-name-${i}`} label="Nome" max={100} value={u.name} onChange={(v) => update((d) => { d.upsell.items[i].name = v; })} />
                <NumField id={`f-up-price-${i}`} label="Preço (R$)" step={0.01} value={u.price} onChange={(v) => update((d) => { d.upsell.items[i].price = v; })} />
                <Select id={`f-up-delay-${i}`} label="Enviar" value={u.delay} onChange={(v) => update((d) => { d.upsell.items[i].delay = v; })} options={DELAY_OPTIONS.map((x) => [x, x])} />
              </div>
              <AreaField id={`f-up-msg-${i}`} label="Mensagem" rows={2} value={u.msg} onChange={(v) => update((d) => { d.upsell.items[i].msg = v; })} vars={["{nome}", "{plano}"]} />
              <label className="flex items-center gap-2.5 text-[13px] text-zinc-300"><input type="checkbox" className="w-[18px] h-[18px] accent-[#3984FF]" checked={u.hideDecline} onChange={(e) => update((d) => { d.upsell.items[i].hideDecline = e.target.checked; })} />Esconder o botão “Agora não”</label>
            </div>
          ))}
          {c.upsell.items.length < MAX_UPSELLS && (
            <button type="button" className={`${BTN_SEC} self-start`} onClick={() => update((d) => { d.upsell.items.push({ name: "Nova oferta", price: 19.9, delay: "1 hora", hideDecline: false, msg: "🎁 Oferta especial para você, {nome}." }); })}><Plus className="w-4 h-4" />Adicionar oferta</button>
          )}
        </>
      );

    case "recup":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Mensagens automáticas para quem chegou perto e não comprou. Até {MAX_RECOVERY}.</p>
          {c.recup.items.map((r, i) => (
            <div key={i} className="rounded-[14px] border border-white/[0.08] bg-[#0d0e12] p-4 flex flex-col gap-3.5">
              <div className="flex items-center justify-between"><b className="text-[13.5px] text-white">{i + 1}. {r.name}</b><button type="button" aria-label="Remover mensagem" onClick={() => update((d) => { d.recup.items.splice(i, 1); })} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div>
              <Seg label="Quem recebe" value={r.audience} onChange={(v) => update((d) => { d.recup.items[i].audience = v; })} options={[["pix", "Gerou Pix e não pagou"], ["start", "Deu /start e não comprou"]]} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <TextField id={`f-rc-name-${i}`} label="Nome" max={100} value={r.name} onChange={(v) => update((d) => { d.recup.items[i].name = v; })} />
                <Select id={`f-rc-delay-${i}`} label="Enviar depois de" value={r.delay} onChange={(v) => update((d) => { d.recup.items[i].delay = v; })} options={DELAY_OPTIONS.filter((x) => x !== "Imediato").map((x) => [x, x])} />
                <NumField id={`f-rc-desc-${i}`} label="Desconto (%)" min={0} max={90} value={r.discount} onChange={(v) => update((d) => { d.recup.items[i].discount = Math.min(90, Math.max(0, Math.round(v) || 0)); })} />
              </div>
              <AreaField id={`f-rc-msg-${i}`} label="Mensagem" rows={2} value={r.msg} onChange={(v) => update((d) => { d.recup.items[i].msg = v; })} vars={["{nome}", "{saudacao}", "{plano}"]} />
            </div>
          ))}
          {c.recup.items.length < MAX_RECOVERY && (
            <button type="button" className={`${BTN_SEC} self-start`} onClick={() => update((d) => { d.recup.items.push({ name: "Nova mensagem", audience: "pix", delay: "1 hora", discount: 10, msg: "{nome}, ainda dá tempo de entrar com desconto." }); })}><Plus className="w-4 h-4" />Adicionar mensagem</button>
          )}
          <Callout>Se o cliente comprar antes do horário, as mensagens pendentes dele são canceladas sozinhas.</Callout>
        </>
      );

    case "renov":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Quando o acesso vence, o cliente sai do grupo e recebe esta mensagem com os planos.</p>
          <Card title="Mensagem de renovação">
            <AreaField id="f-renov-msg" label="Mensagem" rows={3} value={c.renov.msg} onChange={(v) => update((d) => { d.renov.msg = v; })} vars={["{nome}", "{plano}"]} />
            <Select id="f-renov-desc" label="Desconto para renovar" value={String(c.renov.discount)} onChange={(v) => update((d) => { d.renov.discount = Number(v); })} options={[["0", "Sem desconto"], ...[5, 10, 15, 20, 25, 30, 40, 50, 60, 75].map((v) => [String(v), `${v}% off`] as [string, string])]} hint="Vale para todos os planos." />
          </Card>
        </>
      );

    case "mimos":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Um botão no /start para o cliente mandar um presente em dinheiro.</p>
          <Card title="Mimos" right={<Toggle title={c.mimos.on ? "Ligado" : "Desligado"} checked={c.mimos.on} onChange={(v) => update((d) => { d.mimos.on = v; })} />}>
            {!c.mimos.on ? (
              <Callout>Desligado. O botão de mimo não aparece no /start.</Callout>
            ) : (
              <>
                <AreaField id="f-mimo-msg" label="Mensagem" rows={2} value={c.mimos.msg} onChange={(v) => update((d) => { d.mimos.msg = v; })} vars={["{nome}"]} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <TextField id="f-mimo-btn" label="Botão no /start" max={50} value={c.mimos.btn} onChange={(v) => update((d) => { d.mimos.btn = v; })} />
                  <TextField
                    id="f-mimo-values"
                    label="Valores (R$)"
                    value={c.mimos.values.join(", ")}
                    onChange={(v) => update((d) => { d.mimos.values = v.split(",").map((x) => Number(x.trim().replace(",", "."))).filter((x) => x > 0).slice(0, MAX_MIMOS); })}
                    hint={`Separados por vírgula. Até ${MAX_MIMOS}.`}
                  />
                </div>
                <TextField id="f-mimo-thanks" label="Mensagem de obrigado" max={2000} value={c.mimos.thanks} onChange={(v) => update((d) => { d.mimos.thanks = v; })} />
              </>
            )}
          </Card>
        </>
      );

    case "botoes":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Cor dos botões no Telegram. A prévia mostra todos juntos.</p>
          <Card title="Cores" sub="Cores nativas do Telegram para bots.">
            {([["cta", "Ver planos"], ["comprar", "Comprar plano"], ["verificar", "Verificar pagamento"], ["aceitar", "Aceitar oferta"], ["recusar", "Recusar oferta"], ["upsell", "Pagar upsell"], ["desconto", "Comprar com desconto"], ["mimo", "Enviar mimo"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between gap-3"><span className="text-[13.5px] font-semibold text-white">{l}</span><ColorPick value={c.botoes[k]} onChange={(v) => update((d) => { d.botoes[k] = v; })} /></div>
            ))}
          </Card>
        </>
      );

    case "suporte":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Quando o cliente manda /suporte, recebe um botão para falar com você.</p>
          <Card title="Suporte">
            <TextField id="f-sup-user" label="Usuário de suporte" max={64} placeholder="@seu_suporte" value={c.suporte.user} onChange={(v) => update((d) => { d.suporte.user = v; })} hint="Pode ser você ou outro bot." />
            <TextField id="f-sup-msg" label="Mensagem" max={1000} value={c.suporte.msg} onChange={(v) => update((d) => { d.suporte.msg = v; })} />
          </Card>
        </>
      );

    case "disparo":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Mensagem para vários clientes do bot de uma vez.</p>
          <Callout>Os disparos (agora, com desconto em planos ou programados) chegam numa próxima etapa, depois que o bot começar a seguir os fluxos. Clientes bloqueados nunca recebem.</Callout>
        </>
      );

    case "rastreio":
      return (
        <>
          <p className="text-zinc-400 -mt-2">Envia /start, Pix gerado e compra aprovada direto do servidor para as suas campanhas.</p>
          <Card title="Integrações">
            <Toggle title="Facebook" desc="Conversions API (servidor)" checked={c.rastreio.fb} onChange={(v) => update((d) => { d.rastreio.fb = v; })} />
            {c.rastreio.fb && <TextField id="f-fb-pixel" label="Pixel ID" max={32} value={c.rastreio.fbPixelId} onChange={(v) => update((d) => { d.rastreio.fbPixelId = v.replace(/\D/g, ""); })} hint="O token de acesso fica num campo protegido, quando o envio for ligado." />}
            <Toggle title="TikTok" desc="Events API (servidor)" checked={c.rastreio.tt} onChange={(v) => update((d) => { d.rastreio.tt = v; })} />
            {c.rastreio.tt && <TextField id="f-tt-pixel" label="Pixel ID" max={40} value={c.rastreio.ttPixelId} onChange={(v) => update((d) => { d.rastreio.ttPixelId = v; })} />}
            <Toggle title="UTMify" desc="Atribuição por UTM" checked={c.rastreio.utm} onChange={(v) => update((d) => { d.rastreio.utm = v; })} />
          </Card>
          <Callout>Os eventos começam a ser enviados quando o bot seguir os fluxos (próxima etapa).</Callout>
        </>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Prévia                                                              */
/* ------------------------------------------------------------------ */
type ActivePlan = { productId: string; color: ButtonColor; product: FlowProduct };

function pixCodeHtml(fmt: BasicFlowConfig["pix"]["fmt"]) {
  if (fmt === "caixa") return `<div style="border-left:3px solid #60a5fa;background:rgba(57,132,255,.1);padding:6px 8px;border-radius:4px;font-family:monospace;font-size:11.5px;margin-top:6px;word-break:break-all">${PIX_SAMPLE}</div>`;
  if (fmt === "pre") return `<div style="background:rgba(0,0,0,.25);padding:6px 8px;border-radius:6px;font-family:monospace;font-size:11.5px;margin-top:6px;word-break:break-all">${PIX_SAMPLE}</div>`;
  return `<br><code>${PIX_SAMPLE}</code>`;
}

function buildPreview(step: BasicStepId, c: BasicFlowConfig, plans: ActivePlan[]): PreviewItem[] {
  const B = c.botoes;
  const plan = plans[0]?.product;
  const pv = plan ? { "{plano}": plan.title, "{valor}": brl(plan.price), "{duracao}": DURATION[plan.duration] || plan.duration } : { "{plano}": "Seu plano", "{valor}": "R$ 0,00", "{duracao}": "30 dias" };
  const plansKb = (disc = 0): PreviewButton[][] =>
    plans.length ? plans.map((p) => [{ t: `${p.product.title} • ${brl(p.product.price * (1 - disc / 100))}`, c: disc ? B.desconto : p.color !== "none" ? p.color : B.comprar }]) : [[{ t: "Nenhum plano marcado" }]];
  const bot = (text: string, extra: Record<string, string> = {}, kb?: PreviewButton[][]): PreviewItem => ({ kind: "bot", html: text.trim() ? previewHtml(text, { ...pv, ...extra }) : undefined, kb });

  switch (step) {
    case "inicio": {
      const out: PreviewItem[] = [{ kind: "me", text: "/start" }];
      const media = c.inicio.media.map((url, i) => ({ url, label: `Mídia ${i + 1}` }));
      if (media.length) {
        if (c.inicio.sendMode === "album") out.push({ kind: "bot", media });
        else media.forEach((m) => out.push({ kind: "bot", media: [m] }));
      }
      out.push(bot(c.inicio.msg || "(escreva a mensagem de boas-vindas)", {}, [[{ t: c.inicio.btn || "Ver planos", c: B.cta }], ...(c.mimos.on ? [[{ t: c.mimos.btn, c: B.mimo }]] : [])]));
      if (c.inicio.msg2.trim()) out.push(bot(c.inicio.msg2));
      if (c.inicio.antiClone) out.push({ kind: "sys", text: "🔒 Encaminhar e salvar está bloqueado" });
      return out;
    }
    case "planos": {
      const out: PreviewItem[] = [{ kind: "me", text: c.inicio.btn || "Ver planos" }, bot(c.planos.msg, {}, plansKb())];
      if (c.planos.varOn) out.push({ kind: "sys", text: `Preço cobrado varia até ${c.planos.varCents} centavos` });
      return out;
    }
    case "bump": {
      if (!c.bump.on) return [{ kind: "me", text: plan?.title || "Plano" }, { kind: "sys", text: "Order Bump desligado: vai direto para o Pix" }];
      const out: PreviewItem[] = [{ kind: "me", text: plan ? `${plan.title} • ${brl(plan.price)}` : "Plano" }, bot(c.bump.msg || `Leve também ${c.bump.name} por ${brl(c.bump.price)}?`, {}, [[{ t: c.bump.yes, c: B.aceitar }], [{ t: c.bump.no, c: B.recusar }]])];
      if (c.bump.msgYes.trim()) out.push({ kind: "sys", text: "Se aceitar" }, bot(c.bump.msgYes));
      if (c.bump.msgNo.trim()) out.push({ kind: "sys", text: "Se recusar" }, bot(c.bump.msgNo));
      return out;
    }
    case "pix": {
      const kb: PreviewButton[][] = [[{ t: c.pix.verify || "Verificar pagamento", c: B.verificar }]];
      if (c.pix.qr === "botao") kb.push([{ t: "📱 Mostrar QR Code" }]);
      if (c.pix.fallback) kb.push([{ t: "⚠️ Problemas para pagar?" }]);
      const out: PreviewItem[] = [{ kind: "me", text: plan ? `${plan.title} • ${brl(plan.price)}` : "Plano" }];
      if (c.pix.qr === "direto") out.push({ kind: "bot", media: [{ label: "QR", qr: true }] });
      const msgHtml = previewHtml(c.pix.msg || "(escreva a mensagem do Pix)", pv);
      if (c.pix.pos === "junto") out.push({ kind: "bot", html: msgHtml + pixCodeHtml(c.pix.fmt), kb });
      else out.push({ kind: "bot", html: msgHtml }, { kind: "bot", html: pixCodeHtml(c.pix.fmt).replace(/^<br>/, ""), kb });
      if (c.pix.proof && c.pix.proofMsgs[0]) out.push({ kind: "proof", text: c.pix.proofMsgs[0] });
      return out;
    }
    case "entrega": {
      const link = c.entrega.tipo === "grupo" ? "👇 toque no botão para entrar" : c.entrega.tipo === "link" ? c.entrega.link || "(link)" : "";
      return [{ kind: "sys", text: "Pagamento aprovado" }, bot(c.entrega.msg || "(escreva a mensagem de entrega)", { "{link_vip}": link }, c.entrega.tipo === "grupo" ? [[{ t: "Entrar no grupo", c: "green" }]] : undefined)];
    }
    case "upsell": {
      const out: PreviewItem[] = [{ kind: "sys", text: "Pagamento aprovado · acesso entregue" }];
      c.upsell.items.forEach((u, i) => {
        if (c.upsell.mode === "sequencial" && i > 0) out.push({ kind: "me", text: "Agora não" }, { kind: "sys", text: "Próxima oferta só depois da resposta", wait: true });
        out.push({ kind: "sys", text: u.delay === "Imediato" ? "Na hora" : `⏱ ${u.delay} depois`, wait: true }, bot(u.msg, {}, [[{ t: `Pagar ${brl(u.price)}`, c: B.upsell }], ...(u.hideDecline ? [] : [[{ t: "Agora não" }]])]));
      });
      if (!c.upsell.items.length) out.push({ kind: "sys", text: "Nenhuma oferta configurada" });
      return out;
    }
    case "recup": {
      const out: PreviewItem[] = [];
      c.recup.items.forEach((r) => {
        out.push({ kind: "sys", text: r.audience === "pix" ? "Cliente gerou Pix e não pagou" : "Cliente deu /start e não comprou" }, { kind: "sys", text: `⏱ ${r.delay} depois`, wait: true }, bot(r.msg, {}, plansKb(r.discount).slice(0, 3)));
      });
      if (!out.length) out.push({ kind: "sys", text: "Nenhuma mensagem configurada" });
      return out;
    }
    case "renov":
      return [{ kind: "sys", text: "Acesso venceu · removido do grupo" }, bot(c.renov.msg || "(escreva a mensagem de renovação)", {}, plansKb(c.renov.discount)), ...(c.renov.discount ? [{ kind: "sys", text: `Desconto de ${c.renov.discount}% aplicado` } as PreviewItem] : [])];
    case "mimos":
      if (!c.mimos.on) return [{ kind: "sys", text: "Mimos desligados" }];
      return [{ kind: "me", text: c.mimos.btn }, bot(c.mimos.msg, {}, [c.mimos.values.slice(0, 4).map((v) => ({ t: brl(v), c: B.mimo }))]), { kind: "sys", text: "Depois do pagamento" }, bot(c.mimos.thanks)];
    case "botoes":
      return [bot("Assim ficam os botões do seu bot:", {}, [[{ t: "🔥 Ver planos", c: B.cta }], [{ t: "Plano • R$ 19,90", c: B.comprar }], [{ t: "🔍 Verificar pagamento", c: B.verificar }], [{ t: "✅ Quero aproveitar", c: B.aceitar }, { t: "Não, obrigado", c: B.recusar }], [{ t: "Pagar R$ 29,90", c: B.upsell }], [{ t: "Comprar com 20% off", c: B.desconto }], [{ t: "🎁 Enviar mimo", c: B.mimo }]])];
    case "suporte":
      return [{ kind: "me", text: "/suporte" }, bot(c.suporte.msg, {}, [[{ t: `💬 Falar com ${c.suporte.user || "o suporte"}` }]])];
    case "disparo":
      return [{ kind: "sys", text: "Disparos chegam numa próxima etapa" }];
    default:
      return [];
  }
}

function TrackingPreview({ config }: { config: BasicFlowConfig }) {
  const on = [config.rastreio.fb && "Facebook", config.rastreio.tt && "TikTok", config.rastreio.utm && "UTMify"].filter(Boolean).join(", ") || "nenhuma integração";
  return (
    <div className={`${CARD} p-4 flex flex-col gap-3`}>
      <span className="self-start px-2 py-0.5 rounded-full border border-white/[0.13] text-[11.5px] font-semibold text-zinc-400">{on}</span>
      {[["1", "Lead", "Cliente deu /start no bot (com a UTM do link)"], ["2", "InitiateCheckout", "Cliente gerou o Pix"], ["3", "Purchase", "Pagamento aprovado, com valor e plano"]].map(([n, e, d]) => (
        <div key={n} className="flex gap-3"><span className="w-7 h-7 rounded-lg bg-[#3984FF]/[0.12] text-[#60a5fa] text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span><div><p className="text-[13px] font-semibold text-white">{e}</p><p className="text-[12px] text-zinc-500">{d}</p></div></div>
      ))}
      <p className="text-[12px] text-zinc-500">Sai do servidor, sem depender do navegador do cliente.</p>
    </div>
  );
}
