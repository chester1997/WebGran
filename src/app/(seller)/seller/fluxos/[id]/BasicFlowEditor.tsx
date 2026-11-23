"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, ImagePlus, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  BUTTON_KEYS,
  BUTTON_LABELS,
  DELAY_UNITS,
  MAX_DOWNSELLS,
  MAX_MEDIA,
  MAX_MIMOS,
  MAX_PLANS,
  MAX_REDIRECTS,
  MAX_UPSELLS,
  PERIOD_UNITS,
  basicStepStatus,
  blankDownsell,
  blankOrderBump,
  blankPlan,
  blankUpsell,
  newId,
  normalizeBasicConfig,
  planDelivery,
  planPeriodLabel,
  type BasicFlowConfig,
  type BasicStepId,
  type DeliveryKind,
} from "@/lib/flows/basic-config";
import { saveFlowConfigAction } from "../actions";
import { BTN_GHOST, BTN_SEC, Callout, INPUT, useToast } from "../_components/flow-ui";
import EditorTopBar, { type ChecklistItem, type SaveState } from "../_components/EditorTopBar";
import TelegramPreview, { previewHtml, type PreviewButton, type PreviewItem } from "../_components/TelegramPreview";
import Toaster from "../_components/Toaster";
import BroadcastPanel from "./BroadcastPanel";
import { FlowStepIcon } from "../_components/FlowStepIcons";
import {
  AreaField,
  Card,
  ChoiceCards,
  ColorPick,
  GroupField,
  ItemShell,
  Label,
  MediaField,
  MediaThumb,
  MoneyField,
  NumField,
  Seg,
  Select,
  Switch,
  TextField,
  Toggle,
  isVideoUrl,
  uploadFlowFile,
} from "./flow-fields";

export interface FlowChat {
  id: string;
  chatId: string;
  title: string;
  type: string;
  canInvite: boolean;
}
/** Usado pelo editor avançado (bloco Pix ainda escolhe produtos). */
export interface FlowProduct {
  id: string;
  title: string;
  price: number;
  duration: string;
}

const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const PIX_SAMPLE = "00020126580014BR.GOV.BCB.PIX0136a3f1c9e2-77b4-4d10-9f2b-1c6e5204000053039865406";

/** Mesma ordem da referência (sem Gateway, que fica em Gateways). */
const STEPS: [BasicStepId, string][] = [
  ["inicio", "Início"], ["planos", "Planos"], ["upsell", "Upsell"], ["downsell", "Downsell"], ["bump", "Order Bump"],
  ["pix", "PIX"], ["mimos", "Mimos"], ["rastreio", "Rastreamento"], ["expiracao", "Expiração"], ["botoes", "Botões"],
  ["vip", "Entregável"], ["disparo", "Disparo"], ["suporte", "Suporte"],
];

/** Etapas agrupadas pelo caminho da venda (menu lateral). */
const STEP_GROUPS: [string, BasicStepId[]][] = [
  ["Entrada", ["inicio", "planos"]],
  ["Ofertas", ["upsell", "downsell", "bump"]],
  ["Pagamento", ["pix", "expiracao"]],
  ["Entrega", ["vip", "mimos"]],
  ["Ajustes", ["botoes", "rastreio", "disparo", "suporte"]],
];

const STEP_DESC: Record<BasicStepId, string> = {
  inicio: "O que o cliente recebe quando manda /start para o bot.",
  planos: "Os planos à venda, com preço, duração e para onde vai cada compra.",
  upsell: "Ofertas enviadas depois que o cliente paga.",
  downsell: "Mensagens para recuperar quem não comprou ou não pagou o Pix.",
  bump: "Uma oferta extra que entra na mesma compra, antes do Pix.",
  pix: "A mensagem com o código Pix e o que acompanha a cobrança.",
  mimos: "Botões para o cliente mandar um mimo em dinheiro.",
  rastreio: "Pixels e UTMs para medir as vendas de cada campanha.",
  expiracao: "O que o bot envia quando o plano do cliente vence.",
  botoes: "As cores dos botões que o cliente vê no Telegram.",
  vip: "Para onde o cliente vai depois de pagar.",
  disparo: "Mensagens em massa para os leads do bot.",
  suporte: "Quem atende quando o cliente usa /suporte.",
};

const STATUS_DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  pend: "bg-amber-400",
  off: "ring-[1.5px] ring-inset ring-zinc-600",
};

const V_START = ["{nome}", "{saudacao}", "{localizacao}"];
const V_OFFER = ["{nome}", "{localizacao}"];
const V_PIX = ["{codigo_pix}", "{nome_plano}", "{valor_final}", "{duracao}"];
const V_DELIVERY = ["{nome}", "{plano}", "{valor}", "{link_vip}"];

type Updater = (fn: (draft: BasicFlowConfig) => void) => void;
type Chat = { chatId: string; title: string; type?: string; canInvite?: boolean };
const addBtn = `${BTN_SEC} !h-8 !px-3 !text-[12.5px]`;

export default function BasicFlowEditor({
  flowId,
  name,
  status,
  bots,
  chats,
  botName,
  initialConfig,
  initialStep = "inicio",
}: {
  flowId: string;
  name: string;
  status: "draft" | "published";
  bots: { id: string; username: string }[];
  products?: FlowProduct[];
  chats: FlowChat[];
  botName: string;
  initialConfig: BasicFlowConfig;
  /** Etapa aberta ao carregar (padrão: Início). */
  initialStep?: BasicStepId;
}) {
  const toast = useToast();
  const [config, setConfig] = useState<BasicFlowConfig>(() => normalizeBasicConfig(initialConfig));
  const [activeField, setActiveField] = useState<string | null>(null);
  const [step, setStep] = useState<BasicStepId>(initialStep);
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

  /** Botão "Salvar": grava já, sem esperar o salvamento automático. */
  const saveNow = async () => {
    const snapshot = JSON.stringify(config);
    const id = ++seq.current; // descarta o salvamento automático pendente
    setSaveState("saving");
    const res = await saveFlowConfigAction(flowId, config);
    if (id !== seq.current) return res.success;
    if (!res.success) {
      setSaveState("error");
      toast(res.error, "err");
      return false;
    }
    lastSaved.current = snapshot;
    setSaveState("saved");
    return true;
  };

  const goto = (s: BasicStepId) => {
    setStep(s);
    setActiveField(null);
    if (window.innerWidth < 1024) formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const chatList: Chat[] = chats.map((c) => ({ chatId: c.chatId, title: c.title, type: c.type, canInvite: c.canInvite }));
  const plansOk = config.planos.items.length > 0 && config.planos.items.every((p) => p.name.trim() && p.price >= 1);
  const checklist: ChecklistItem[] = [
    { label: "Mensagem de boas-vindas", ok: basicStepStatus("inicio", config)[0] === "ok", required: true, onFix: () => goto("inicio") },
    { label: "Planos com nome e preço (mín. R$ 1,00)", ok: plansOk, required: true, onFix: () => goto("planos") },
    { label: "Entregável de todos os planos (VIP)", ok: basicStepStatus("vip", config)[0] === "ok", required: true, onFix: () => goto("vip") },
    { label: "Mensagem do PIX personalizada", ok: !!config.pix.msg.trim(), required: false, onFix: () => goto("pix") },
  ];

  const [st, stLabel] = basicStepStatus(step, config);
  const stepLabel = (id: BasicStepId) => STEPS.find((s) => s[0] === id)![1];
  const label = STEPS.find((s) => s[0] === step)![1];

  return (
    <div className="w-full max-w-full pb-10">
      <Toaster />
      {/* Topo fixo (no computador): só a área do meio rola */}
      <div className="lg:sticky lg:top-[-20px] z-30 -mt-4 sm:-mt-5 pt-4 sm:pt-5 bg-[var(--seller-bg,#0A0A0A)]">
        <EditorTopBar flowId={flowId} name={name} type="basic" status={status} bots={bots} saveState={saveState} checklist={checklist} onSaveNow={saveNow} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_360px] gap-6 xl:gap-8 items-start">
        {/* Jornada: etapas agrupadas pelo caminho da venda */}
        <nav aria-label="Etapas do fluxo" className="lg:sticky lg:top-[var(--flow-head,100px)] lg:max-h-[calc(100dvh-var(--flow-head,100px)-24px)] lg:overflow-y-auto custom-scrollbar -mx-1 lg:mx-0 flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto pb-1 lg:pb-2">
          {STEP_GROUPS.map(([group, ids], gi) => (
            <div key={group} className="contents lg:block">
              <p className={`hidden lg:block px-3 mb-1 text-[12px] font-semibold text-[#8b8b94] ${gi ? "mt-5" : ""}`}>{group}</p>
              {ids.map((id) => {
                const [s] = basicStepStatus(id, config);
                const on = step === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goto(id)}
                    aria-current={on ? "page" : undefined}
                    className={`group flex items-center gap-3 h-[38px] px-3 rounded-[9px] text-left whitespace-nowrap shrink-0 lg:w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 ${
                      on ? "bg-[#17181c] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]" : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`[&_svg]:w-4 [&_svg]:h-4 flex ${on ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-300"}`}><FlowStepIcon step={id} /></span>
                    <span className="flex-1 text-[14px]">{stepLabel(id)}</span>
                    <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${STATUS_DOT[s] || STATUS_DOT.off}`} title={basicStepStatus(id, config)[1]} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          ref={formRef}
          className="min-w-0 w-full flex flex-col gap-7 lg:scroll-mt-[var(--flow-head,100px)] scroll-mt-4"
          onFocusCapture={(e) => {
            const id = (e.target as HTMLElement).id;
            if (id) setActiveField(id);
          }}
        >
          <header>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[24px] font-semibold tracking-tight text-white">{label}</h2>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8b8b94]">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st] || STATUS_DOT.off}`} />
                {stLabel}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-zinc-400">{STEP_DESC[step]}</p>
          </header>
          <Section step={step} c={config} update={update} chats={chatList} goto={goto} flowId={flowId} published={status === "published"} />
        </div>

        <aside className="lg:col-start-2 xl:col-start-auto xl:sticky xl:top-[var(--flow-head,100px)] xl:max-h-[calc(100dvh-var(--flow-head,100px)-24px)] xl:overflow-y-auto custom-scrollbar flex flex-col gap-2.5 w-full" aria-label="Prévia no Telegram">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold text-zinc-400">Prévia no Telegram</span>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#8b8b94]"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />Ao vivo</span>
          </div>
          <TelegramPreview title={botName} items={buildPreview(step, config)} activeSrc={activeField} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seções                                                              */
/* ------------------------------------------------------------------ */
type DeliveryValue = { useDefault: boolean; type: DeliveryKind; groupId: string; link: string };

const chatKind = (t?: string) => (t === "channel" ? "canal" : t === "supergroup" ? "supergrupo" : "grupo");

/** Nome curto de uma entrega, para resumos ("APOLLO DORAMAS", "Link de convite"...). */
function deliveryName(v: { deliveryType: DeliveryKind; groupId: string; link: string }, chats: Chat[]): string {
  if (v.deliveryType === "link") return v.link ? "Link de convite" : "";
  if (!v.groupId) return "";
  return chats.find((ch) => ch.chatId === v.groupId)?.title || `ID ${v.groupId}`;
}

/**
 * Escolha da entrega numa lista só: os grupos/canais em que o bot está (detectados sozinhos),
 * "outro grupo (digitar ID)", "link de convite" e, no plano, "usar entrega padrão".
 */
function DeliveryPicker({ id, label, chats, value, onChange, defaultName }: {
  id: string; label: string; chats: Chat[]; value: DeliveryValue; onChange: (v: DeliveryValue) => void;
  /** Só no plano: mostra "Usar entrega padrão" com o nome do destino padrão. */
  defaultName?: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const known = chats.find((ch) => ch.chatId === value.groupId);
  const [manual, setManual] = useState(value.type === "group" && !!value.groupId && !known);
  const allowDefault = defaultName !== undefined;
  const sel = allowDefault && value.useDefault ? "default" : value.type === "link" ? "link" : known && !manual ? `chat:${known.chatId}` : manual || value.groupId ? "manual" : "";

  const pick = (v: string) => {
    if (v === "default") return onChange({ ...value, useDefault: true });
    if (v === "link") return onChange({ ...value, useDefault: false, type: "link" });
    if (v === "manual") { setManual(true); return onChange({ ...value, useDefault: false, type: "group", groupId: known ? "" : value.groupId }); }
    if (v.startsWith("chat:")) { setManual(false); return onChange({ ...value, useDefault: false, type: "group", groupId: v.slice(5) }); }
  };

  const chosen = sel === "default" ? "" : deliveryName({ deliveryType: value.type, groupId: value.groupId, link: value.link }, chats);
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <Label>{label}</Label>
      <span className="flex gap-2">
        <select id={id} value={sel} onChange={(e) => pick(e.target.value)} className={INPUT}>
          {allowDefault ? <option value="default">📦 Usar entrega padrão{defaultName ? ` (${defaultName})` : " (ainda não definida)"}</option> : <option value="" disabled>Escolha onde entregar…</option>}
          {chats.length > 0 && (
            <optgroup label="Grupos e canais do bot">
              {chats.map((ch) => (
                <option key={ch.chatId} value={`chat:${ch.chatId}`}>
                  {ch.type === "channel" ? "📢" : "👥"} {ch.title} ({chatKind(ch.type)}){ch.canInvite === false ? " · ⚠ sem permissão" : " · ✓ admin"}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Outros">
            <option value="manual">🎯 Outro grupo ou canal (digitar ID)</option>
            <option value="link">🔗 Link de convite (t.me)</option>
          </optgroup>
        </select>
        <button type="button" title="Atualizar a lista de grupos" aria-label="Atualizar a lista de grupos" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="shrink-0 w-11 rounded-[10px] border border-white/[0.13] text-zinc-300 hover:bg-white/[0.05] flex items-center justify-center">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </span>
      {sel === "manual" && (
        <input id={`${id}-manual`} aria-label="ID do grupo ou canal" value={value.groupId} placeholder="-1001234567890" maxLength={20} onChange={(e) => onChange({ ...value, useDefault: false, type: "group", groupId: e.target.value.replace(/[^\d-]/g, "") })} className={INPUT} />
      )}
      {sel === "link" && (
        <input id={`${id}-link`} aria-label="Link de convite" value={value.link} placeholder="https://t.me/+AbCdEf123" maxLength={1000} onChange={(e) => onChange({ ...value, useDefault: false, type: "link", link: e.target.value })} className={INPUT} />
      )}
      {sel.startsWith("chat:") && known?.canInvite === false ? (
        <span className="text-[12px] text-amber-400">O bot não tem permissão de convidar usuários em “{known.title}”. Dê admin com “Convidar usuários” e “Banir usuários”.</span>
      ) : chosen ? (
        <span className="text-[12px] px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400">
          ✓ {value.type === "link" ? "Envia o link de convite (sem remoção no vencimento)" : `Entrega em: ${chosen} · convite individual e remoção no vencimento`}
        </span>
      ) : sel !== "default" ? (
        <span className="text-[12px] text-zinc-500">
          {chats.length ? "" : "Nenhum grupo encontrado. "}Coloque o bot como admin no grupo ou canal (com “Convidar usuários” e “Banir usuários”) e toque em atualizar. Se não aparecer, tire e coloque o bot de novo, ou digite o ID.
        </span>
      ) : null}
    </div>
  );
}

function DeliveryFields({ prefix, type, groupId, link, chats, onType, onGroup, onLink, optionalGroup }: {
  prefix: string; type: DeliveryKind; groupId: string; link: string; chats: Chat[];
  onType: (v: DeliveryKind) => void; onGroup: (v: string) => void; onLink: (v: string) => void; optionalGroup?: boolean;
}) {
  return (
    <>
      <Seg label="Tipo de entrega" value={type} onChange={onType} options={[["group", "🎯 Pelo ID"], ["link", "🔗 Pelo link"]]} />
      {type === "group" ? (
        <GroupField id={`${prefix}-group`} label={optionalGroup ? "ID do grupo, supergrupo ou canal (opcional)" : "ID do grupo, supergrupo ou canal"} value={groupId} onChange={onGroup} chats={chats} hint={optionalGroup ? "Deixe vazio para usar o grupo VIP padrão do bot." : "O bot precisa ser admin com permissão de criar links e banir usuários."} />
      ) : (
        <TextField id={`${prefix}-link`} label="Link do grupo, supergrupo ou canal" max={1000} placeholder="https://t.me/+AbCdEf123" value={link} onChange={onLink} hint="Link de convite do Telegram. O bot só envia o link: não controla quem entra nem remove no vencimento." />
      )}
    </>
  );
}

function Section({ step, c, update, chats, goto, flowId, published }: { step: BasicStepId; c: BasicFlowConfig; update: Updater; chats: Chat[]; goto: (s: BasicStepId) => void; flowId: string; published: boolean }) {
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [bumpTab, setBumpTab] = useState<Record<string, "principal" | "aceitar" | "recusar">>({});

  switch (step) {
    case "inicio":
      return (
        <>
          <Card title="🛡️ Anti-Clone" sub="Impede que usuários baixem mídias, copiem textos, encaminhem ou compartilhem as mensagens do bot." right={<Switch checked={c.inicio.antiClone} onChange={(v) => update((d) => { d.inicio.antiClone = v; })} label="Anti-Clone" />} />
          <Card title="Áudio de boas-vindas" sub="Enviado antes das mídias. Use .ogg para aparecer como mensagem de voz.">
            <MediaField label="Áudio" accept="audio" value={c.inicio.audioUrl} onChange={(v) => update((d) => { d.inicio.audioUrl = v; })} hint="Até 4 MB." />
          </Card>
          <Card title="Mídias iniciais" sub={`Até ${MAX_MEDIA} fotos ou vídeos curtos (vídeo até 4 MB).`}>
            <InitialMedia c={c} update={update} />
            <Seg label="Como enviar" value={c.inicio.sendMode} onChange={(v) => update((d) => { d.inicio.sendMode = v; })} options={[["album", "Álbum"], ["seq", "Uma por vez"]]} />
            <Toggle title="Mídia dinâmica" desc="Usa nome e idade da modelo nas mensagens. A cidade vem do link de rastreamento." checked={c.inicio.dynamic} onChange={(v) => update((d) => { d.inicio.dynamic = v; })} />
            {c.inicio.dynamic && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <TextField id="f-dyn-name" label="Nome da modelo (opcional)" max={60} placeholder="Ex.: Maria Clara" value={c.inicio.dynamicName} onChange={(v) => update((d) => { d.inicio.dynamicName = v; })} />
                <NumField id="f-dyn-age" label="Idade (opcional)" min={0} max={120} value={c.inicio.dynamicAge} onChange={(v) => update((d) => { d.inicio.dynamicAge = Math.round(v) || 0; })} />
              </div>
            )}
          </Card>
          <Card title="Mensagem principal" right={<span className="flex items-center gap-2 text-[12px] text-zinc-400">Emoji Premium <Switch checked={c.inicio.emojiPremium} onChange={(v) => update((d) => { d.inicio.emojiPremium = v; })} label="Emoji Premium" /></span>}>
            {c.inicio.emojiPremium && <p className="text-[12px] text-zinc-500 -mt-1">Para os emojis premium funcionarem, a conta que criou o bot no @BotFather precisa ter Telegram Premium.</p>}
            <AreaField id="f-inicio-msg" label="Mensagem principal" value={c.inicio.msg} onChange={(v) => update((d) => { d.inicio.msg = v; })} vars={V_START} />
            <AreaField id="f-inicio-msg2" label="Mensagem secundária (opcional)" rows={3} value={c.inicio.msg2} onChange={(v) => update((d) => { d.inicio.msg2 = v; })} vars={V_START} hint="Enviada depois da principal." />
          </Card>
          <Card
            title="Planos na boas-vindas"
            sub="Ligado: os botões dos planos já vêm embaixo da mensagem e o cliente vai direto para o Pix. Desligado: aparece o botão “Ver planos” antes."
            right={<Switch checked={c.inicio.showPlans} onChange={(v) => update((d) => { d.inicio.showPlans = v; })} label="Planos na boas-vindas" />}
          >
            {!c.inicio.showPlans && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3.5 items-end">
                <TextField id="f-inicio-btn" label="Texto do botão" max={64} placeholder="Ex.: 🔥 Ver Planos" value={c.inicio.btn} onChange={(v) => update((d) => { d.inicio.btn = v; })} />
                <div className="flex flex-col gap-1.5 pb-1"><Label>Cor</Label><ColorPick value={c.botoes.cta} onChange={(v) => update((d) => { d.botoes.cta = v; })} /></div>
              </div>
            )}
          </Card>
          <Card title="Redirecionadores" sub="Botões extras com link, embaixo da mensagem principal." right={c.inicio.redirects.length < MAX_REDIRECTS ? <button type="button" className={addBtn} onClick={() => update((d) => { d.inicio.redirects.push({ text: "", url: "" }); })}><Plus className="w-3.5 h-3.5" />Adicionar</button> : undefined}>
            {c.inicio.redirects.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum redirecionador.</p>}
            {c.inicio.redirects.map((r, i) => (
              <ItemShell key={i} title={`Botão ${i + 1}`} onRemove={() => update((d) => { d.inicio.redirects.splice(i, 1); })}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <TextField id={`f-redir-text-${i}`} label="Texto" max={64} placeholder="Ex.: 📸 Instagram" value={r.text} onChange={(v) => update((d) => { d.inicio.redirects[i].text = v; })} />
                  <TextField id={`f-redir-url-${i}`} label="Link" max={1000} placeholder="https://" value={r.url} onChange={(v) => update((d) => { d.inicio.redirects[i].url = v; })} />
                </div>
              </ItemShell>
            ))}
          </Card>
        </>
      );

    case "planos":
      return (
        <>
          <Card title="📦 Entrega padrão" sub="Para onde vai quem compra um plano marcado como “Usar entrega padrão”. Cada plano pode ter a sua própria entrega.">
            <DeliveryPicker id="f-default-deliv" label="Destino da entrega" chats={chats} value={{ useDefault: false, type: c.vip.deliveryType, groupId: c.vip.groupId, link: c.vip.link }} onChange={(v) => update((d) => { d.vip.deliveryType = v.type; d.vip.groupId = v.groupId; d.vip.link = v.link; })} />
          </Card>
          <Card
            title="Planos"
            sub="Gerencie os planos de assinatura do seu bot."
            right={c.planos.items.length < MAX_PLANS ? (
              <button type="button" className={addBtn} onClick={() => { const p = blankPlan(); update((d) => { d.planos.items.push(p); }); setOpenPlan(p.id); }}><Plus className="w-3.5 h-3.5" />Novo Plano</button>
            ) : undefined}
          >
            {c.planos.items.length === 0 && <Callout>Crie o primeiro plano: nome, preço e por quanto tempo o acesso vale.</Callout>}
            {c.planos.items.map((p, i) => {
              const open = openPlan === p.id;
              const deliv = planDelivery(p, c);
              return (
                <div key={p.id} className="rounded-[14px] border border-white/[0.08] bg-[#0d0e12]">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button type="button" onClick={() => setOpenPlan(open ? null : p.id)} className="flex-1 min-w-0 text-left">
                      <p className="text-[14px] font-semibold text-white truncate">✨ {p.name || "Plano sem nome"}</p>
                      <p className="text-[12.5px] text-zinc-500"><span className="text-emerald-400 font-semibold tabular-nums">{brl(p.price)}</span> · {planPeriodLabel(p)} · {p.vipExclusive ? deliveryName(p, chats) || "entrega própria" : "entrega padrão"}{!deliv && <span className="text-amber-400"> · sem entrega</span>}</p>
                    </button>
                    <button type="button" aria-label="Duplicar plano" title="Duplicar" disabled={c.planos.items.length >= MAX_PLANS} onClick={() => update((d) => { d.planos.items.splice(i + 1, 0, { ...structuredClone(p), id: newId(), name: p.name + " (cópia)" }); })} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center"><Copy className="w-4 h-4" /></button>
                    <button type="button" aria-label={open ? "Fechar" : "Editar"} onClick={() => setOpenPlan(open ? null : p.id)} className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                    <button type="button" aria-label="Excluir plano" onClick={() => update((d) => { d.planos.items.splice(i, 1); d.downsell.items.forEach((x) => { x.planIds = x.planIds.filter((pid) => pid !== p.id); }); d.bumps.items.forEach((b) => { if (b.planId === p.id) b.planId = ""; }); })} className="text-[12.5px] text-red-400 hover:text-red-300 px-1.5">Excluir</button>
                  </div>
                  {open && (
                    <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] flex flex-col gap-3.5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <TextField id={`f-plan-name-${p.id}`} label="Nome do plano" max={100} placeholder="Ex.: Acesso Mensal" value={p.name} onChange={(v) => update((d) => { d.planos.items[i].name = v; })} />
                        <MoneyField id={`f-plan-price-${p.id}`} label="Preço (R$)" value={p.price} onChange={(v) => update((d) => { d.planos.items[i].price = v; })} hint="Mínimo R$ 1,00." />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <Select id={`f-plan-unit-${p.id}`} label="Período" value={p.unit} onChange={(v) => update((d) => { d.planos.items[i].unit = v as typeof p.unit; })} options={PERIOD_UNITS} />
                        {p.unit !== "vitalicio" && <NumField id={`f-plan-amount-${p.id}`} label="Duração" min={1} max={1000} value={p.amount} onChange={(v) => update((d) => { d.planos.items[i].amount = Math.max(1, Math.round(v) || 1); })} />}
                      </div>
                      <DeliveryPicker
                        id={`f-plan-deliv-${p.id}`}
                        label="Entrega deste plano"
                        chats={chats}
                        defaultName={deliveryName(c.vip, chats)}
                        value={{ useDefault: !p.vipExclusive, type: p.deliveryType, groupId: p.groupId, link: p.link }}
                        onChange={(v) => update((d) => { const it = d.planos.items[i]; it.vipExclusive = !v.useDefault; it.deliveryType = v.type; it.groupId = v.groupId; it.link = v.link; })}
                      />
                      <div className="flex items-center justify-between gap-3"><Label>Cor do botão</Label><ColorPick value={p.color} onChange={(v) => update((d) => { d.planos.items[i].color = v; })} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
          <Card title="Variação de preço" sub="Altera os centavos automaticamente em cada cobrança para evitar bloqueios por padrão de antifraude." right={<Switch checked={c.planos.varOn} onChange={(v) => update((d) => { d.planos.varOn = v; })} label="Variação de preço" />}>
            {c.planos.varOn && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <NumField id="f-var-cents" label="Variação em centavos" suffix="centavos" min={1} max={99} hint="Valor máximo somado ou subtraído do preço original." value={c.planos.varCents} onChange={(v) => update((d) => { d.planos.varCents = Math.min(99, Math.max(1, Math.round(v) || 1)); })} />
                <Seg label="Direção da variação" value={c.planos.varDir} onChange={(v) => update((d) => { d.planos.varDir = v; })} options={[["ambos", "↕ Ambos"], ["cima", "↑ Para cima"], ["baixo", "↓ Para baixo"]]} />
              </div>
            )}
          </Card>
        </>
      );

    case "upsell":
      return (
        <>
          <Card title="📈 Upsells" sub={`Ofertas enviadas depois da compra. Máximo ${MAX_UPSELLS}.`} right={c.upsell.items.length < MAX_UPSELLS ? <button type="button" className={addBtn} onClick={() => update((d) => { d.upsell.items.push(blankUpsell()); })}><Plus className="w-3.5 h-3.5" />Adicionar</button> : undefined}>
            {c.upsell.items.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum upsell configurado. Clique em “Adicionar” para começar.</p>}
            {c.upsell.items.map((u, i) => (
              <ItemShell key={u.id} title={`${i + 1}. ${u.name || "Nova oferta"}`} onRemove={() => update((d) => { d.upsell.items.splice(i, 1); })}>
                <TextField id={`f-up-name-${u.id}`} label="Nome da oferta" max={100} placeholder="Ex.: Pack Premium Plus" value={u.name} onChange={(v) => update((d) => { d.upsell.items[i].name = v; })} />
                <MediaField label="Mídia (opcional)" accept="visual" value={u.mediaUrl} onChange={(v) => update((d) => { d.upsell.items[i].mediaUrl = v; })} />
                <AreaField id={`f-up-msg-${u.id}`} label="Mensagem" rows={3} value={u.msg} onChange={(v) => update((d) => { d.upsell.items[i].msg = v; })} vars={V_OFFER} />
                <MoneyField id={`f-up-price-${u.id}`} label="Preço (R$)" value={u.price} onChange={(v) => update((d) => { d.upsell.items[i].price = v; })} />
                <DeliveryFields prefix={`f-up-${u.id}`} optionalGroup type={u.deliveryType} groupId={u.groupId} link={u.link} chats={chats} onType={(v) => update((d) => { d.upsell.items[i].deliveryType = v; })} onGroup={(v) => update((d) => { d.upsell.items[i].groupId = v; })} onLink={(v) => update((d) => { d.upsell.items[i].link = v; })} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <Select id={`f-up-dt-${u.id}`} label="Tipo de delay" value={u.delayUnit} onChange={(v) => update((d) => { d.upsell.items[i].delayUnit = v as typeof u.delayUnit; })} options={DELAY_UNITS} />
                  {u.delayUnit !== "imediato" && <NumField id={`f-up-dv-${u.id}`} label="Valor do delay" min={0} value={u.delayValue} onChange={(v) => update((d) => { d.upsell.items[i].delayValue = Math.max(0, Math.round(v) || 0); })} />}
                </div>
                <div className="rounded-xl border border-white/[0.08] p-3.5 flex flex-col gap-3.5">
                  <Toggle title="Order Bump" desc="Oferta complementar antes do PIX do upsell." checked={u.bump.on} onChange={(v) => update((d) => { d.upsell.items[i].bump.on = v; })} />
                  {u.bump.on && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <TextField id={`f-upb-name-${u.id}`} label="Nome do bump" max={100} placeholder="Ex.: Pack Extra VIP" value={u.bump.name} onChange={(v) => update((d) => { d.upsell.items[i].bump.name = v; })} />
                        <MoneyField id={`f-upb-price-${u.id}`} label="Preço (R$)" value={u.bump.price} onChange={(v) => update((d) => { d.upsell.items[i].bump.price = v; })} />
                      </div>
                      <MediaField label="Mídia (opcional)" accept="visual" value={u.bump.mediaUrl} onChange={(v) => update((d) => { d.upsell.items[i].bump.mediaUrl = v; })} />
                      <AreaField id={`f-upb-msg-${u.id}`} label="Mensagem do bump" rows={2} value={u.bump.msg} onChange={(v) => update((d) => { d.upsell.items[i].bump.msg = v; })} vars={V_OFFER} />
                      <DeliveryFields prefix={`f-upb-${u.id}`} type={u.bump.deliveryType} groupId={u.bump.groupId} link={u.bump.link} chats={chats} onType={(v) => update((d) => { d.upsell.items[i].bump.deliveryType = v; })} onGroup={(v) => update((d) => { d.upsell.items[i].bump.groupId = v; })} onLink={(v) => update((d) => { d.upsell.items[i].bump.link = v; })} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <TextField id={`f-upb-yes-${u.id}`} label="Botão aceitar" max={64} value={u.bump.yes} onChange={(v) => update((d) => { d.upsell.items[i].bump.yes = v; })} />
                        <TextField id={`f-upb-no-${u.id}`} label="Botão recusar" max={64} value={u.bump.no} onChange={(v) => update((d) => { d.upsell.items[i].bump.no = v; })} />
                      </div>
                    </>
                  )}
                </div>
              </ItemShell>
            ))}
          </Card>
          <Card title="⚙️ Modo de envio">
            <ChoiceCards value={c.upsell.mode} onChange={(v) => update((d) => { d.upsell.mode = v; })} options={[["padrao", "💡 Padrão", "Todas as mensagens de upsell disparam no tempo de cada uma."], ["sequencial", "🔗 Sequencial", "Uma oferta de cada vez: a próxima só depois da resposta."]]} />
          </Card>
          <Card title="✉️ Mensagem de entrega (opcional)" sub="Mensagem depois de pagar um upsell. {link_vip} vira o link de acesso.">
            <AreaField id="f-up-deliv" label="Mensagem de entrega" value={c.upsell.deliveryMsg} onChange={(v) => update((d) => { d.upsell.deliveryMsg = v; })} vars={V_DELIVERY} />
            <MediaField label="Mídia (opcional)" accept="visual" value={c.upsell.deliveryMediaUrl} onChange={(v) => update((d) => { d.upsell.deliveryMediaUrl = v; })} />
          </Card>
        </>
      );

    case "downsell":
      return (
        <>
          <Card title="🛒 Downsells" sub={`Mensagens de recuperação. Máximo ${MAX_DOWNSELLS}.`} right={c.downsell.items.length < MAX_DOWNSELLS ? <button type="button" className={addBtn} onClick={() => update((d) => { d.downsell.items.push(blankDownsell()); })}><Plus className="w-3.5 h-3.5" />Adicionar</button> : undefined}>
            {c.downsell.items.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum downsell configurado. Clique em “Adicionar” para criar sua primeira oferta de recuperação.</p>}
            {c.downsell.items.map((r, i) => (
              <ItemShell key={r.id} title={`${i + 1}. ${r.name || "Nova oferta"}`} onRemove={() => update((d) => { d.downsell.items.splice(i, 1); })}>
                <TextField id={`f-ds-name-${r.id}`} label="Nome da oferta" max={100} placeholder="Ex.: Oferta Especial" value={r.name} onChange={(v) => update((d) => { d.downsell.items[i].name = v; })} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <MediaField label="Mídia (opcional)" accept="visual" value={r.mediaUrl} onChange={(v) => update((d) => { d.downsell.items[i].mediaUrl = v; })} />
                  <MediaField label="Áudio (opcional)" accept="audio" value={r.audioUrl} onChange={(v) => update((d) => { d.downsell.items[i].audioUrl = v; })} hint="Enviado antes da mensagem (.ogg = voz)." />
                </div>
                <AreaField id={`f-ds-msg-${r.id}`} label="Mensagem" rows={3} value={r.msg} onChange={(v) => update((d) => { d.downsell.items[i].msg = v; })} vars={V_OFFER} />
                <ChoiceCards label="Tipo de envio do downsell" value={r.audience} onChange={(v) => update((d) => { d.downsell.items[i].audience = v; })} options={[["start", "Todos que iniciaram", "Deu /start e não comprou"], ["pix", "Só quem gerou PIX", "Gerou o PIX e não pagou"]]} />
                <div className="flex flex-col gap-1.5">
                  <Label>Planos do downsell</Label>
                  <span className="text-[12px] text-zinc-500">Marque os planos que aparecem como botões nesta oferta.</span>
                  {c.planos.items.length === 0 && <span className="text-[12.5px] text-amber-400">Crie planos na seção Planos.</span>}
                  {c.planos.items.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                      <input type="checkbox" className="w-[18px] h-[18px] accent-[#3984FF]" checked={r.planIds.includes(p.id)} onChange={(e) => update((d) => { const it = d.downsell.items[i]; it.planIds = e.target.checked ? [...it.planIds, p.id] : it.planIds.filter((x) => x !== p.id); })} />
                      {p.name || "Plano sem nome"} · {brl(p.price)}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <Select id={`f-ds-dtype-${r.id}`} label="Tipo de desconto" value={r.discountType} onChange={(v) => update((d) => { d.downsell.items[i].discountType = v as "percent" | "fixed"; })} options={[["percent", "Porcentagem"], ["fixed", "Valor fixo"]]} />
                  {r.discountType === "percent" ? (
                    <NumField id={`f-ds-disc-${r.id}`} label="Desconto (%)" min={0} max={90} value={r.discount} onChange={(v) => update((d) => { d.downsell.items[i].discount = Math.min(90, Math.max(0, Math.round(v) || 0)); })} hint="0 a 90%." />
                  ) : (
                    <MoneyField id={`f-ds-disc-${r.id}`} label="Desconto (R$)" value={r.discount} onChange={(v) => update((d) => { d.downsell.items[i].discount = v; })} />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <Select id={`f-ds-du-${r.id}`} label="Tipo de delay" value={r.delayUnit} onChange={(v) => update((d) => { d.downsell.items[i].delayUnit = v as typeof r.delayUnit; })} options={DELAY_UNITS.filter(([u]) => u !== "imediato") as [string, string][]} />
                  <NumField id={`f-ds-dv-${r.id}`} label="Valor do delay" min={0} value={r.delayValue} onChange={(v) => update((d) => { d.downsell.items[i].delayValue = Math.max(0, Math.round(v) || 0); })} />
                </div>
              </ItemShell>
            ))}
          </Card>
          <Card title="Como funciona?" sub="Mensagens de recuperação enviadas depois que o cliente dá /start e não finaliza a compra. Você define o delay e o desconto oferecido." />
        </>
      );

    case "bump": {
      const used = new Set(c.bumps.items.map((b) => b.planId).filter(Boolean));
      return (
        <>
          <Card title="🎁 Order Bumps" sub="Cada plano pode ter no máximo 1 Order Bump." right={c.bumps.items.length < Math.max(1, c.planos.items.length) ? <button type="button" className={addBtn} onClick={() => update((d) => { d.bumps.items.push(blankOrderBump()); })}><Plus className="w-3.5 h-3.5" />Adicionar</button> : undefined}>
            {c.bumps.items.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum Order Bump configurado. Clique em “Adicionar” para criar sua primeira oferta complementar.</p>}
            {c.bumps.items.map((b, i) => {
              const tab = bumpTab[b.id] || "principal";
              const follow = tab === "aceitar" ? "ifAccept" : "ifDecline";
              return (
                <ItemShell key={b.id} title={`📝 ${b.name || "Nova oferta"}`} onRemove={() => update((d) => { d.bumps.items.splice(i, 1); })}>
                  <ChoiceCards value={tab} onChange={(v) => setBumpTab((s) => ({ ...s, [b.id]: v }))} options={[["principal", "Principal", "Oferta inicial, antes do pagamento"], ["aceitar", "Se aceitar", "Depois do aceite"], ["recusar", "Se recusar", "Depois da recusa"]]} />
                  {tab === "principal" ? (
                    <>
                      <Select id={`f-bp-plan-${b.id}`} label="Plano vinculado" value={b.planId} onChange={(v) => update((d) => { d.bumps.items[i].planId = v; })} options={[["", "-- Selecionar plano --"], ...c.planos.items.filter((p) => p.id === b.planId || !used.has(p.id)).map((p) => [p.id, p.name || "Plano sem nome"] as [string, string])]} />
                      <TextField id={`f-bp-name-${b.id}`} label="Nome da oferta" max={100} placeholder="Ex.: Pack Premium" value={b.name} onChange={(v) => update((d) => { d.bumps.items[i].name = v; })} />
                      <MediaField label="Mídia (opcional)" accept="visual" value={b.mediaUrl} onChange={(v) => update((d) => { d.bumps.items[i].mediaUrl = v; })} />
                      <AreaField id={`f-bp-msg-${b.id}`} label="Mensagem" rows={3} value={b.msg} onChange={(v) => update((d) => { d.bumps.items[i].msg = v; })} vars={V_OFFER} />
                      <MoneyField id={`f-bp-price-${b.id}`} label="Preço (R$)" value={b.price} onChange={(v) => update((d) => { d.bumps.items[i].price = v; })} />
                      <DeliveryFields prefix={`f-bp-${b.id}`} optionalGroup type={b.deliveryType} groupId={b.groupId} link={b.link} chats={chats} onType={(v) => update((d) => { d.bumps.items[i].deliveryType = v; })} onGroup={(v) => update((d) => { d.bumps.items[i].groupId = v; })} onLink={(v) => update((d) => { d.bumps.items[i].link = v; })} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <TextField id={`f-bp-yes-${b.id}`} label="Texto do botão aceitar" max={64} value={b.yes} onChange={(v) => update((d) => { d.bumps.items[i].yes = v; })} />
                        <TextField id={`f-bp-no-${b.id}`} label="Texto do botão recusar" max={64} value={b.no} onChange={(v) => update((d) => { d.bumps.items[i].no = v; })} />
                      </div>
                      <MediaField label="Áudio (opcional)" accept="audio" value={b.audioUrl} onChange={(v) => update((d) => { d.bumps.items[i].audioUrl = v; })} hint="Enviado antes da mensagem (.ogg = voz)." />
                    </>
                  ) : (
                    <>
                      <Toggle title="Ativar este follow-up" desc={tab === "aceitar" ? "Aparece somente se o cliente aceitar a oferta principal." : "Aparece somente se o cliente recusar a oferta principal."} checked={b[follow].on} onChange={(v) => update((d) => { d.bumps.items[i][follow].on = v; })} />
                      {b[follow].on && (
                        <>
                          <AreaField id={`f-bp-${follow}-${b.id}`} label="Mensagem" rows={3} value={b[follow].msg} onChange={(v) => update((d) => { d.bumps.items[i][follow].msg = v; })} vars={V_OFFER} />
                          <MediaField label="Mídia (opcional)" accept="visual" value={b[follow].mediaUrl} onChange={(v) => update((d) => { d.bumps.items[i][follow].mediaUrl = v; })} />
                        </>
                      )}
                    </>
                  )}
                </ItemShell>
              );
            })}
          </Card>
          <Card title="Como funciona?" sub="Depois que o cliente escolhe um plano, aparece uma oferta adicional que pode ser incluída na mesma compra." />
        </>
      );
    }

    case "pix":
      return (
        <>
          <Card title="💠 Mensagem PIX" right={<button type="button" className={`${BTN_GHOST} !h-8 !text-[12.5px]`} onClick={() => update((d) => { d.pix.msg = ""; })}>Restaurar padrão</button>}>
            <AreaField id="f-pix-msg" label="Mensagem do PIX" value={c.pix.msg} onChange={(v) => update((d) => { d.pix.msg = v; })} vars={[...V_PIX, "{nome}"]} hint="Em branco usa a mensagem padrão. Sem {codigo_pix}, o código vai conforme a posição abaixo." />
            <ChoiceCards label="Posição do código PIX" value={c.pix.pos} onChange={(v) => update((d) => { d.pix.pos = v; })} options={[["junto", "Junto com o texto", "Código integrado na mensagem"], ["separada", "Mensagem separada", "Código em mensagem própria"]]} />
            <ChoiceCards label="Formato do código" value={c.pix.fmt} onChange={(v) => update((d) => { d.pix.fmt = v; })} options={[["caixa", "Caixa destacada", "00020126580014BR.GOV.BCB.PIX…"], ["pre", "Texto formatado", "00020126580014BR.GOV.BCB.PIX…"], ["code", "Código simples", "00020126580014BR.GOV.BCB.PIX…"]]} />
          </Card>
          <Card title="📱 QR Code do PIX" sub="Exibe o QR Code como imagem para o cliente escanear com o app do banco." right={<Switch checked={c.pix.qrOn} onChange={(v) => update((d) => { d.pix.qrOn = v; })} label="QR Code" />}>
            {c.pix.qrOn && (
              <>
                <ChoiceCards label="Modo de exibição" value={c.pix.qrMode} onChange={(v) => update((d) => { d.pix.qrMode = v; })} options={[["botao", "🔘 Botão no chat", "Botão abaixo do Verificar Pagamento"], ["direto", "📨 Direto no chat", "Enviado junto com o PIX copia e cola"]]} />
                {c.pix.qrMode === "botao" && <TextField id="f-qr-btn" label="Texto do botão QR Code" max={64} value={c.pix.qrBtn} onChange={(v) => update((d) => { d.pix.qrBtn = v; })} />}
              </>
            )}
          </Card>
          <Card title="🔍 Texto do botão verificar">
            <TextField id="f-verify" label="Texto exibido no botão de verificar pagamento" max={64} value={c.pix.verifyBtn} onChange={(v) => update((d) => { d.pix.verifyBtn = v; })} />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="📷 Mídia do PIX"><MediaField label="Mídia" accept="visual" value={c.pix.mediaUrl} onChange={(v) => update((d) => { d.pix.mediaUrl = v; })} /></Card>
            <Card title="🎵 Áudio do PIX" sub="Enviado ANTES da mensagem do PIX."><MediaField label="Áudio" accept="audio" value={c.pix.audioUrl} onChange={(v) => update((d) => { d.pix.audioUrl = v; })} /></Card>
          </div>
          <Card title="🔥 Provas sociais" sub="Mensagens rotativas abaixo do PIX para criar urgência. Chegam ao bot numa próxima etapa." right={<Switch checked={c.pix.proofOn} onChange={(v) => update((d) => { d.pix.proofOn = v; })} label="Provas sociais" />}>
            {c.pix.proofOn && (
              <>
                <NumField id="f-proof-int" label="Intervalo (segundos)" min={3} max={30} hint="mín: 3 — máx: 30" value={c.pix.proofInterval} onChange={(v) => update((d) => { d.pix.proofInterval = Math.min(30, Math.max(3, Math.round(v) || 3)); })} />
                <ProofAdder onAdd={(m) => update((d) => { d.pix.proofMsgs.push(m); })} />
                {c.pix.proofMsgs.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Prova social ${i + 1}`} value={m} maxLength={300} onChange={(e) => update((d) => { d.pix.proofMsgs[i] = e.target.value; })} className={INPUT} />
                    <button type="button" onClick={() => update((d) => { d.pix.proofMsgs.splice(i, 1); })} className="shrink-0 px-3 rounded-[10px] text-[12.5px] text-red-400 hover:bg-red-500/10">Remover</button>
                  </div>
                ))}
                <p className="text-[12px] text-zinc-500">Use <code className="text-[#60a5fa]">{"{random}"}</code> para um número entre 3 e 10 e <code className="text-[#60a5fa]">{"{localizacao}"}</code> para a cidade.</p>
              </>
            )}
          </Card>
          <Card title="🔄 PIX Fallback" sub="Botão para gerar PIX no gateway secundário quando o banco do cliente recusa." right={<Switch checked={c.pix.fallbackOn} onChange={(v) => update((d) => { d.pix.fallbackOn = v; })} label="PIX Fallback" />}>
            {c.pix.fallbackOn && (
              <>
                <Callout tone="warn">Necessário pelo menos <b>2 gateways ativos</b> em Gateways. Chega ao bot numa próxima etapa.</Callout>
                <TextField id="f-fb-btn" label="Texto do botão" max={64} value={c.pix.fallbackBtn} onChange={(v) => update((d) => { d.pix.fallbackBtn = v; })} />
                <AreaField id="f-fb-msg" label="Mensagem do PIX fallback" rows={4} value={c.pix.fallbackMsg} onChange={(v) => update((d) => { d.pix.fallbackMsg = v; })} vars={V_PIX} />
                <MediaField label="📷 Mídia do PIX fallback" accept="visual" value={c.pix.fallbackMediaUrl} onChange={(v) => update((d) => { d.pix.fallbackMediaUrl = v; })} />
              </>
            )}
          </Card>
        </>
      );

    case "mimos":
      return (
        <>
          <Card title="🎁 Mimos" right={<Switch checked={c.mimos.on} onChange={(v) => update((d) => { d.mimos.on = v; })} label="Ativar mimos" />} sub="Liga ou desliga os mimos no bot. Ligado, os clientes podem enviar mimos pelo /start." />
          <Card title="Textos">
            <AreaField id="f-mimo-msg" label="Texto do mimo" rows={3} value={c.mimos.msg} onChange={(v) => update((d) => { d.mimos.msg = v; })} vars={V_OFFER} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <TextField id="f-mimo-btn" label="Texto do botão no /start" max={50} value={c.mimos.btn} onChange={(v) => update((d) => { d.mimos.btn = v; })} />
              <TextField id="f-mimo-thanks" label="Mensagem de obrigado" max={2000} placeholder="Ex.: Obrigado pelo mimo! ❤️" value={c.mimos.thanks} onChange={(v) => update((d) => { d.mimos.thanks = v; })} hint="Enviada depois do pagamento." />
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="📸 Mídia inicial" sub="Foto ou vídeo exibido quando o cliente toca no botão de mimo."><MediaField label="Mídia" accept="visual" value={c.mimos.mediaUrl} onChange={(v) => update((d) => { d.mimos.mediaUrl = v; })} /></Card>
            <Card title="🔊 Áudio" sub="Enviado ANTES da mídia e do texto."><MediaField label="Áudio" accept="audio" value={c.mimos.audioUrl} onChange={(v) => update((d) => { d.mimos.audioUrl = v; })} /></Card>
          </div>
          <Card title="💰 Mimos (valores)" sub={`Máximo de ${MAX_MIMOS} mimos. Cada mimo vira um botão de pagamento.`}>
            {c.mimos.values.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum mimo configurado.</p>}
            {c.mimos.values.map((m, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_130px_auto] gap-2 items-end">
                <TextField id={`f-mimo-l-${i}`} label="Texto do botão" max={50} placeholder="Ex.: Presentinho 💕" value={m.label} onChange={(v) => update((d) => { d.mimos.values[i].label = v; })} />
                <MoneyField id={`f-mimo-v-${i}`} label="Valor (R$)" value={m.value} onChange={(v) => update((d) => { d.mimos.values[i].value = v; })} />
                <button type="button" onClick={() => update((d) => { d.mimos.values.splice(i, 1); })} className="h-[38px] px-3 rounded-[10px] text-[12.5px] text-red-400 hover:bg-red-500/10">Remover</button>
              </div>
            ))}
            {c.mimos.values.length < MAX_MIMOS && <button type="button" className={`${BTN_SEC} self-start`} onClick={() => update((d) => { d.mimos.values.push({ label: "", value: 20 }); })}><Plus className="w-4 h-4" />Adicionar</button>}
          </Card>
        </>
      );

    case "rastreio":
      return (
        <>
          <Card title="📊 Rastreamento" sub="Configure suas integrações para medir ROI, conversões e otimizar campanhas." right={<span className="text-[12px] text-zinc-400 tabular-nums">{[c.rastreio.fbPixelId, c.rastreio.ttPixelId, c.rastreio.utmToken].filter(Boolean).length} / 3</span>} />
          <Card title="Facebook Pixel" sub="Conversions API (servidor)" right={c.rastreio.fbPixelId ? <span className="text-[11.5px] font-semibold text-emerald-400">Conectado</span> : undefined}>
            <TextField id="f-fb-pixel" label="Pixel ID" max={32} placeholder="Ex.: 1024404363116287" value={c.rastreio.fbPixelId} onChange={(v) => update((d) => { d.rastreio.fbPixelId = v.replace(/\D/g, ""); })} hint="No Gerenciador de Eventos do Facebook." />
            <TextField id="f-fb-token" label="Access token" max={500} placeholder="Token que começa com EAA…" value={c.rastreio.fbToken} onChange={(v) => update((d) => { d.rastreio.fbToken = v.trim(); })} hint="Gerenciador de Eventos → seu Pixel → Configurações → Conversions API → Gerar token de acesso." />
          </Card>
          <Card title="TikTok Pixel" sub="Events API v1.3 (servidor)" right={c.rastreio.ttPixelId ? <span className="text-[11.5px] font-semibold text-emerald-400">Conectado</span> : undefined}>
            <TextField id="f-tt-pixel" label="Pixel ID" max={40} placeholder="Ex.: CXXXXXXXXXXXXXXXXX" value={c.rastreio.ttPixelId} onChange={(v) => update((d) => { d.rastreio.ttPixelId = v.trim(); })} hint="TikTok Ads Manager → Assets → Events." />
            <TextField id="f-tt-token" label="Access token" max={500} placeholder="Token de acesso da API do TikTok" value={c.rastreio.ttToken} onChange={(v) => update((d) => { d.rastreio.ttToken = v.trim(); })} hint="Events → Settings → Generate Token." />
          </Card>
          <Card title="UTMify" sub="Rastreamento de UTMs e atribuição" right={c.rastreio.utmToken ? <span className="text-[11.5px] font-semibold text-emerald-400">Conectado</span> : undefined}>
            <TextField id="f-utm-token" label="API token" max={200} placeholder="Cole o token gerado na UTMify" value={c.rastreio.utmToken} onChange={(v) => update((d) => { d.rastreio.utmToken = v.trim(); })} hint="utmify.com.br → Integrações → Webhooks → Credenciais de API." />
          </Card>
          <Callout>Os tokens não vão junto quando você exporta o fluxo.</Callout>
        </>
      );

    case "expiracao":
      return (
        <>
          <Card title="⏰ Expiração" right={<button type="button" className={`${BTN_GHOST} !h-8 !text-[12.5px]`} onClick={() => update((d) => { d.expiracao = { msg: "", discount: 0, mediaUrl: "" }; })}>Restaurar padrão</button>}>
            <AreaField id="f-exp-msg" label="Mensagem de expiração" rows={3} value={c.expiracao.msg} onChange={(v) => update((d) => { d.expiracao.msg = v; })} vars={["{nome}"]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Select id="f-exp-disc" label="Desconto para renovação" value={String(c.expiracao.discount)} onChange={(v) => update((d) => { d.expiracao.discount = Number(v); })} options={[["0", "Sem desconto"], ...Array.from({ length: 15 }, (_, k) => (k + 1) * 5).map((v) => [String(v), `${v}% OFF`] as [string, string])]} hint="Aplicado em todos os planos na renovação." />
              <MediaField label="📎 Mídia (opcional)" accept="visual" value={c.expiracao.mediaUrl} onChange={(v) => update((d) => { d.expiracao.mediaUrl = v; })} hint="Foto ou vídeo anexado à mensagem." />
            </div>
          </Card>
          <Card title="💡 Como funciona?" sub="Quando o plano de um cliente expira, o bot envia esta mensagem com um botão de renovação. Com desconto configurado, todos os planos saem com o preço reduzido." />
        </>
      );

    case "botoes":
      return (
        <Card title="🎨 Cores dos botões" sub="Personalize as cores dos botões que aparecem para o cliente no Telegram. O primeiro círculo (pontilhado) é sem cor, o padrão do Telegram.">
          {BUTTON_KEYS.map((k) => (
            <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#0d0e12]">
              <span className="min-w-0"><span className="block text-[13.5px] font-semibold text-white">{BUTTON_LABELS[k][0]}</span><span className="block text-[12px] text-zinc-500">{BUTTON_LABELS[k][1]}</span></span>
              <ColorPick value={c.botoes[k]} onChange={(v) => update((d) => { d.botoes[k] = v; })} />
            </div>
          ))}
        </Card>
      );

    case "vip":
      return (
        <>
          <Card title="⭐ Entregável" sub="Destino dos planos marcados como “Usar entrega padrão”. Também dá para escolher em Planos." right={<button type="button" className={`${BTN_GHOST} !h-8 !text-[12.5px]`} onClick={() => update((d) => { d.vip.groupId = ""; d.vip.link = ""; })}>Remover entregável</button>}>
            <DeliveryPicker id="f-vip-deliv" label="Destino da entrega padrão" chats={chats} value={{ useDefault: false, type: c.vip.deliveryType, groupId: c.vip.groupId, link: c.vip.link }} onChange={(v) => update((d) => { d.vip.deliveryType = v.type; d.vip.groupId = v.groupId; d.vip.link = v.link; })} />
            {c.planos.items.some((p) => !planDelivery(p, c)) && (
              <Callout tone="warn">Planos sem entrega: {c.planos.items.filter((p) => !planDelivery(p, c)).map((p) => p.name || "sem nome").join(", ")}. <button type="button" className="underline" onClick={() => goto("planos")}>Ver planos</button></Callout>
            )}
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="🎯 Pelo ID" sub="Depois do pagamento o bot gera um convite só para aquele cliente e, quando o plano vence, tira ele do grupo ou canal. O bot precisa ser admin com permissão de convidar e banir usuários." />
            <Card title="🔗 Pelo link" sub="O bot envia o link de convite do grupo ou canal depois do pagamento. Como o link é o mesmo para todos, o bot não consegue remover a pessoa quando o plano vence." />
          </div>
          <Card title="✉️ Mensagem de entrega (opcional)" sub="Mensagem depois do pagamento. {link_vip} vira o link de acesso." right={<button type="button" className={`${BTN_GHOST} !h-8 !text-[12.5px]`} onClick={() => update((d) => { d.vip.msg = ""; })}>Restaurar padrão</button>}>
            <AreaField id="f-vip-msg" label="Mensagem de entrega" value={c.vip.msg} onChange={(v) => update((d) => { d.vip.msg = v; })} vars={V_DELIVERY} />
            <MediaField label="Mídia (opcional)" accept="visual" value={c.vip.mediaUrl} onChange={(v) => update((d) => { d.vip.mediaUrl = v; })} />
          </Card>
        </>
      );

    case "disparo":
      return (
        <BroadcastPanel flowId={flowId} published={published} />
      );

    case "suporte":
      return (
        <>
          <Card title="🙋 Suporte" right={c.suporte.user ? <button type="button" className={`${BTN_GHOST} !h-8 !text-[12.5px]`} onClick={() => update((d) => { d.suporte.user = ""; })}>Remover suporte</button> : undefined}>
            <TextField id="f-sup-user" label="Username do suporte" max={64} placeholder="Ex.: @meu_suporte" value={c.suporte.user} onChange={(v) => update((d) => { d.suporte.user = v; })} hint="Username do Telegram (com ou sem @). Pode ser um usuário ou bot." />
          </Card>
          <Card title="💡 Como funciona?" sub="Quando um cliente usa o comando /suporte no bot, ele recebe um botão para falar direto com o usuário ou bot de suporte configurado aqui." />
        </>
      );
  }
}

function ProofAdder({ onAdd }: { onAdd: (m: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Adicionar mensagem</Label>
      <span className="flex gap-2">
        <input value={v} maxLength={300} placeholder="Ex.: 🔥 {random} usuários de {localizacao} acabaram de comprar!" onChange={(e) => setV(e.target.value)} className={INPUT} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); } }} />
        <button type="button" className={`${BTN_SEC} shrink-0`} disabled={!v.trim()} onClick={() => { onAdd(v.trim()); setV(""); }}><Plus className="w-4 h-4" />Adicionar</button>
      </span>
    </div>
  );
}

function InitialMedia({ c, update }: { c: BasicFlowConfig; update: Updater }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File) => {
    setBusy(true);
    try {
      const url = await uploadFlowFile(f);
      update((d) => { if (d.inicio.media.length < MAX_MEDIA) d.inicio.media.push(url); });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha no envio.", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2.5">
      {c.inicio.media.map((url, i) => <MediaThumb key={url + i} url={url} onRemove={() => update((d) => { d.inicio.media.splice(i, 1); })} />)}
      {c.inicio.media.length < MAX_MEDIA && (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-[92px] h-[92px] rounded-xl border border-dashed border-white/[0.2] text-[#60a5fa] text-[12px] flex flex-col items-center justify-center gap-1 hover:bg-white/[0.03]">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          {busy ? "Enviando" : "Adicionar"}
        </button>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prévia                                                              */
/* ------------------------------------------------------------------ */
function pixCodeHtml(fmt: BasicFlowConfig["pix"]["fmt"]) {
  if (fmt === "caixa") return `<div style="border-left:3px solid #60a5fa;background:rgba(57,132,255,.1);padding:6px 8px;border-radius:4px;font-family:monospace;font-size:11.5px;margin-top:6px;word-break:break-all">${PIX_SAMPLE}</div>`;
  if (fmt === "pre") return `<div style="background:rgba(0,0,0,.25);padding:6px 8px;border-radius:6px;font-family:monospace;font-size:11.5px;margin-top:6px;word-break:break-all">${PIX_SAMPLE}</div>`;
  return `<br><code>${PIX_SAMPLE}</code>`;
}

function buildPreview(step: BasicStepId, c: BasicFlowConfig): PreviewItem[] {
  const B = c.botoes;
  const plan = c.planos.items[0];
  const pv: Record<string, string> = plan
    ? { "{plano}": plan.name, "{nome_plano}": plan.name, "{valor}": brl(plan.price), "{valor_final}": (plan.price || 0).toFixed(2).replace(".", ","), "{duracao}": planPeriodLabel(plan) }
    : { "{plano}": "Seu plano", "{nome_plano}": "Seu plano", "{valor}": "R$ 0,00", "{valor_final}": "0,00", "{duracao}": "1 mês" };
  const plansKb = (disc = 0, fixed = false, ids?: string[]): PreviewButton[][] => {
    const list = ids ? c.planos.items.filter((p) => ids.includes(p.id)) : c.planos.items;
    if (!list.length) return [[{ t: "Nenhum plano" }]];
    return list.map((p) => {
      const price = fixed ? Math.max(0, p.price - disc) : p.price * (1 - disc / 100);
      return [{ t: `${p.name || "Plano"} - ${brl(price)}`, c: disc ? B.desconto : p.color }];
    });
  };
  const media = (url?: string) => (url ? [{ url: isVideoUrl(url) ? undefined : url, label: isVideoUrl(url) ? "▶ Vídeo" : "Mídia" }] : undefined);
  const bot = (text: string, kb?: PreviewButton[][], mediaUrl?: string, src?: string): PreviewItem => ({ kind: "bot", html: text.trim() ? previewHtml(text, pv) : undefined, kb, media: media(mediaUrl), src });

  switch (step) {
    case "inicio": {
      const out: PreviewItem[] = [{ kind: "me", text: "/start" }];
      if (c.inicio.audioUrl) out.push({ kind: "bot", voice: true });
      const m = c.inicio.media.map((url, i) => ({ url: isVideoUrl(url) ? undefined : url, label: isVideoUrl(url) ? "▶ Vídeo" : `Mídia ${i + 1}` }));
      if (m.length) {
        if (c.inicio.sendMode === "album") out.push({ kind: "bot", media: m });
        else m.forEach((x) => out.push({ kind: "bot", media: [x] }));
      }
      const direct = c.inicio.showPlans && c.planos.items.some((p) => p.name.trim() && p.price >= 1);
      const kb: PreviewButton[][] = [...(direct ? plansKb() : [[{ t: c.inicio.btn || "🔥 Ver Planos", c: B.cta }]]), ...c.inicio.redirects.filter((r) => r.text).map((r) => [{ t: r.text }]), ...(c.mimos.on ? [[{ t: c.mimos.btn, c: B.mimo }]] : [])];
      out.push(bot(c.inicio.msg || "(escreva a mensagem principal)", kb, undefined, "f-inicio-msg"));
      if (c.inicio.msg2.trim()) out.push(bot(c.inicio.msg2, undefined, undefined, "f-inicio-msg2"));
      if (c.inicio.antiClone) out.push({ kind: "sys", text: "🔒 Encaminhar e salvar está bloqueado" });
      return out;
    }
    case "planos":
      return [{ kind: "me", text: c.inicio.showPlans ? "/start" : c.inicio.btn || "Ver Planos" }, bot(c.inicio.showPlans ? c.inicio.msg || "(mensagem de boas-vindas)" : "Escolha seu plano 👇", plansKb()), ...(c.planos.varOn ? [{ kind: "sys", text: `Preço varia até ${c.planos.varCents} centavos` } as PreviewItem] : [])];
    case "upsell": {
      const out: PreviewItem[] = [{ kind: "sys", text: "Pagamento aprovado · acesso entregue" }];
      c.upsell.items.forEach((u, i) => {
        if (c.upsell.mode === "sequencial" && i > 0) out.push({ kind: "sys", text: "Próxima oferta só depois da resposta", wait: true });
        out.push({ kind: "sys", text: u.delayUnit === "imediato" ? "Na hora" : `⏱ ${u.delayValue} ${u.delayUnit} depois`, wait: true }, bot(u.msg || u.name || "(mensagem da oferta)", [[{ t: `Pagar ${brl(u.price)}`, c: B.upsell }], [{ t: "❌ Não tenho interesse" }]], u.mediaUrl, `f-up-msg-${u.id}`));
      });
      if (!c.upsell.items.length) out.push({ kind: "sys", text: "Nenhum upsell configurado" });
      return out;
    }
    case "downsell": {
      const out: PreviewItem[] = [];
      c.downsell.items.forEach((r) => {
        out.push({ kind: "sys", text: r.audience === "pix" ? "Gerou PIX e não pagou" : "Deu /start e não comprou" }, { kind: "sys", text: `⏱ ${r.delayValue} ${r.delayUnit} depois`, wait: true });
        if (r.audioUrl) out.push({ kind: "bot", voice: true });
        out.push(bot(r.msg || "(mensagem de recuperação)", plansKb(r.discount, r.discountType === "fixed", r.planIds.length ? r.planIds : undefined), r.mediaUrl, `f-ds-msg-${r.id}`));
      });
      if (!out.length) out.push({ kind: "sys", text: "Nenhum downsell configurado" });
      return out;
    }
    case "bump": {
      const b = c.bumps.items[0];
      if (!b) return [{ kind: "sys", text: "Nenhum Order Bump configurado" }];
      const p = c.planos.items.find((x) => x.id === b.planId);
      const out: PreviewItem[] = [{ kind: "me", text: p ? `${p.name} - ${brl(p.price)}` : "Plano" }];
      if (b.audioUrl) out.push({ kind: "bot", voice: true });
      out.push(bot(b.msg || `Leve também ${b.name || "a oferta"} por ${brl(b.price)}?`, [[{ t: b.yes, c: B.aceitar }], [{ t: b.no, c: B.recusar }]], b.mediaUrl, `f-bp-msg-${b.id}`));
      if (b.ifAccept.on) out.push({ kind: "sys", text: "Se aceitar" }, bot(b.ifAccept.msg, undefined, b.ifAccept.mediaUrl, `f-bp-ifAccept-${b.id}`));
      if (b.ifDecline.on) out.push({ kind: "sys", text: "Se recusar" }, bot(b.ifDecline.msg, undefined, b.ifDecline.mediaUrl, `f-bp-ifDecline-${b.id}`));
      return out;
    }
    case "pix": {
      const out: PreviewItem[] = [{ kind: "me", text: plan ? `${plan.name} - ${brl(plan.price)}` : "Plano" }];
      if (c.pix.audioUrl) out.push({ kind: "bot", voice: true });
      if (c.pix.mediaUrl) out.push({ kind: "bot", media: media(c.pix.mediaUrl) });
      if (c.pix.qrOn && c.pix.qrMode === "direto") out.push({ kind: "bot", media: [{ label: "QR", qr: true }] });
      const kb: PreviewButton[][] = [[{ t: c.pix.verifyBtn || "🔍 VERIFICAR PAGAMENTO", c: B.verificar }]];
      if (c.pix.qrOn && c.pix.qrMode === "botao") kb.push([{ t: c.pix.qrBtn || "📱 Mostrar QR Code", c: B.qr }]);
      if (c.pix.fallbackOn) kb.push([{ t: c.pix.fallbackBtn }]);
      const msg = c.pix.msg.trim() ? c.pix.msg : "🌟 Você selecionou o seguinte plano:\n\n🎁 Plano: {nome_plano}\n💰 Valor: R$ {valor_final}\n\n💠 Pague via Pix Copia e Cola:";
      const msgHtml = previewHtml(msg.replace("{codigo_pix}", ""), pv);
      if (c.pix.pos === "junto" || msg.includes("{codigo_pix}")) out.push({ kind: "bot", html: msgHtml + pixCodeHtml(c.pix.fmt), kb, src: "f-pix-msg" });
      else out.push({ kind: "bot", html: msgHtml, src: "f-pix-msg" }, { kind: "bot", html: pixCodeHtml(c.pix.fmt).replace(/^<br>/, ""), kb });
      if (c.pix.proofOn && c.pix.proofMsgs[0]) out.push({ kind: "proof", text: c.pix.proofMsgs[0] });
      return out;
    }
    case "mimos": {
      if (!c.mimos.on) return [{ kind: "sys", text: "Mimos desligados" }];
      const out: PreviewItem[] = [{ kind: "me", text: c.mimos.btn }];
      if (c.mimos.audioUrl) out.push({ kind: "bot", voice: true });
      out.push(bot(c.mimos.msg || "🎁 Envie um mimo!", c.mimos.values.map((m) => [{ t: `${m.label || "Mimo"} - ${brl(m.value)}`, c: B.mimoFixo }]), c.mimos.mediaUrl, "f-mimo-msg"));
      if (c.mimos.thanks) out.push({ kind: "sys", text: "Depois do pagamento" }, bot(c.mimos.thanks));
      return out;
    }
    case "rastreio":
      return [{ kind: "sys", text: "Eventos: /start (Lead) · PIX gerado (InitiateCheckout) · compra (Purchase)" }];
    case "expiracao":
      return [{ kind: "sys", text: "Plano expirou · removido do grupo" }, bot(c.expiracao.msg || "⏰ Seu plano expirou! Renove agora 👇", plansKb(c.expiracao.discount), c.expiracao.mediaUrl, "f-exp-msg")];
    case "botoes":
      return [bot("Assim ficam os botões do seu bot:", BUTTON_KEYS.map((k) => [{ t: BUTTON_LABELS[k][0], c: B[k] }]))];
    case "vip":
      return [{ kind: "sys", text: "Pagamento aprovado" }, bot(c.vip.msg || "🎉 PAGAMENTO CONFIRMADO! (mensagem padrão)", [[{ t: "🔓 Acessar agora", c: "green" }]], c.vip.mediaUrl, "f-vip-msg")];
    case "disparo":
      return [{ kind: "sys", text: "Disparo para os leads do bot" }, bot("{saudacao}, {nome}! 🔥 Novidade no grupo VIP…", plansKb())];
    case "suporte":
      return [{ kind: "me", text: "/suporte" }, bot("Precisa de ajuda? Fale com a gente 👇", [[{ t: `💬 Falar com ${c.suporte.user || "o suporte"}` }]])];
  }
}
