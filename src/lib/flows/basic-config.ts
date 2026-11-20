/**
 * Configuração do Fluxo Básico ("venda na conversa"), versão 2.
 * Mesma organização de seções da referência (Início, Planos, Upsell, Downsell,
 * Order Bump, PIX, Mimos, Rastreamento, Expiração, Botões, VIP, Disparo, Suporte).
 *
 * Módulo puro (sem banco): o servidor valida o que salva e o editor usa os tipos.
 * normalizeBasicConfig completa com padrões, descarta lixo e aceita a versão 1.
 */

export type ButtonColor = "none" | "blue" | "green" | "red";
export type PeriodUnit = "segundos" | "minutos" | "horas" | "dias" | "semanas" | "meses" | "anos" | "vitalicio";
export type DelayUnit = "imediato" | "segundos" | "minutos" | "horas" | "dias";
export type DeliveryKind = "group" | "link";

export interface FlowPlan {
  id: string;
  name: string;
  price: number;
  unit: PeriodUnit;
  amount: number;
  /** Entrega própria do plano. Desligado = usa o Entregável da seção VIP. */
  vipExclusive: boolean;
  deliveryType: DeliveryKind;
  groupId: string;
  link: string;
  color: ButtonColor;
}

export interface BumpOffer {
  on: boolean;
  name: string;
  price: number;
  mediaUrl: string;
  msg: string;
  deliveryType: DeliveryKind;
  groupId: string;
  link: string;
  yes: string;
  no: string;
}

export interface UpsellOffer {
  id: string;
  name: string;
  mediaUrl: string;
  msg: string;
  price: number;
  deliveryType: DeliveryKind;
  groupId: string;
  link: string;
  delayUnit: DelayUnit;
  delayValue: number;
  bump: BumpOffer;
}

export interface DownsellOffer {
  id: string;
  name: string;
  mediaUrl: string;
  audioUrl: string;
  msg: string;
  audience: "start" | "pix";
  planIds: string[];
  discountType: "percent" | "fixed";
  discount: number;
  delayUnit: Exclude<DelayUnit, "imediato">;
  delayValue: number;
}

export interface FollowUp {
  on: boolean;
  msg: string;
  mediaUrl: string;
}

export interface OrderBump {
  id: string;
  planId: string;
  name: string;
  mediaUrl: string;
  audioUrl: string;
  msg: string;
  price: number;
  deliveryType: DeliveryKind;
  groupId: string;
  link: string;
  yes: string;
  no: string;
  ifAccept: FollowUp;
  ifDecline: FollowUp;
}

export interface MimoValue {
  label: string;
  value: number;
}

export const BUTTON_KEYS = ["cta", "comprar", "verificar", "qr", "aceitar", "recusar", "upsell", "desconto", "mimo", "mimoFixo"] as const;
export type ButtonKey = (typeof BUTTON_KEYS)[number];

export interface BasicFlowConfig {
  version: 2;
  inicio: {
    antiClone: boolean;
    audioUrl: string;
    media: string[];
    sendMode: "album" | "seq";
    dynamic: boolean;
    dynamicName: string;
    dynamicAge: number;
    emojiPremium: boolean;
    msg: string;
    msg2: string;
    btn: string;
    redirects: { text: string; url: string }[];
  };
  planos: { items: FlowPlan[]; varOn: boolean; varCents: number; varDir: "ambos" | "cima" | "baixo" };
  upsell: { mode: "padrao" | "sequencial"; items: UpsellOffer[]; deliveryMsg: string; deliveryMediaUrl: string };
  downsell: { items: DownsellOffer[] };
  bumps: { items: OrderBump[] };
  pix: {
    msg: string;
    pos: "junto" | "separada";
    fmt: "caixa" | "pre" | "code";
    qrOn: boolean;
    qrMode: "botao" | "direto";
    qrBtn: string;
    verifyBtn: string;
    mediaUrl: string;
    audioUrl: string;
    proofOn: boolean;
    proofInterval: number;
    proofMsgs: string[];
    fallbackOn: boolean;
    fallbackBtn: string;
    fallbackMsg: string;
    fallbackMediaUrl: string;
  };
  mimos: { on: boolean; msg: string; btn: string; thanks: string; mediaUrl: string; audioUrl: string; values: MimoValue[] };
  rastreio: { fbPixelId: string; fbToken: string; ttPixelId: string; ttToken: string; utmToken: string };
  expiracao: { msg: string; discount: number; mediaUrl: string };
  botoes: Record<ButtonKey, ButtonColor>;
  vip: { deliveryType: DeliveryKind; groupId: string; link: string; msg: string; mediaUrl: string };
  suporte: { user: string };
}

export const PERIOD_UNITS: [PeriodUnit, string][] = [
  ["segundos", "Segundos"], ["minutos", "Minutos"], ["horas", "Horas"], ["dias", "Dias"],
  ["semanas", "Semanas"], ["meses", "Meses"], ["anos", "Anos"], ["vitalicio", "Vitalício"],
];
export const DELAY_UNITS: [DelayUnit, string][] = [["imediato", "⚡ Imediato"], ["segundos", "⏱️ Segundos"], ["minutos", "⏰ Minutos"], ["horas", "🕒 Horas"], ["dias", "📅 Dias"]];
export const BUTTON_LABELS: Record<ButtonKey, [string, string]> = {
  cta: ["Ver Planos (CTA)", "Botão de listar planos"],
  comprar: ["Comprar Plano", "Botão de cada plano na lista de preços"],
  verificar: ["Verificar Pagamento", "Botão para checar se o Pix caiu"],
  qr: ["QR Code", "Botão para exibir o QR Code do Pix"],
  aceitar: ["Aceitar Oferta Extra", "Quando o cliente aceita o Order Bump"],
  recusar: ["Recusar Oferta Extra", "Quando o cliente recusa o Order Bump"],
  upsell: ["Pagar Upsell", "Botão de compra na mensagem de upsell"],
  desconto: ["Comprar com Desconto", "Botão na oferta de downsell"],
  mimo: ["Enviar Mimo", "Cor do botão de enviar mimo"],
  mimoFixo: ["Mimo com Valor Fixo", "Cada botão de valor de mimo"],
};

export const MAX_PLANS = 10;
export const MAX_UPSELLS = 25;
export const MAX_DOWNSELLS = 25;
export const MAX_MEDIA = 5;
export const MAX_MIMOS = 10;
export const MAX_REDIRECTS = 6;

/* ------------------------------------------------------------------ */
/* Padrões                                                             */
/* ------------------------------------------------------------------ */
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function blankBump(): BumpOffer {
  return { on: false, name: "", price: 0, mediaUrl: "", msg: "", deliveryType: "group", groupId: "", link: "", yes: "✅ Quero aproveitar!", no: "❌ Não, obrigado" };
}
export function blankPlan(): FlowPlan {
  return { id: newId(), name: "", price: 0, unit: "meses", amount: 1, vipExclusive: false, deliveryType: "group", groupId: "", link: "", color: "none" };
}
export function blankUpsell(): UpsellOffer {
  return { id: newId(), name: "", mediaUrl: "", msg: "", price: 0, deliveryType: "group", groupId: "", link: "", delayUnit: "imediato", delayValue: 0, bump: blankBump() };
}
export function blankDownsell(): DownsellOffer {
  return { id: newId(), name: "", mediaUrl: "", audioUrl: "", msg: "", audience: "pix", planIds: [], discountType: "percent", discount: 10, delayUnit: "minutos", delayValue: 15 };
}
export function blankOrderBump(): OrderBump {
  return { id: newId(), planId: "", name: "", mediaUrl: "", audioUrl: "", msg: "", price: 0, deliveryType: "group", groupId: "", link: "", yes: "✅ Quero aproveitar!", no: "❌ Não, obrigado", ifAccept: { on: false, msg: "", mediaUrl: "" }, ifDecline: { on: false, msg: "", mediaUrl: "" } };
}

export function blankBasicConfig(): BasicFlowConfig {
  return {
    version: 2,
    inicio: { antiClone: false, audioUrl: "", media: [], sendMode: "album", dynamic: false, dynamicName: "", dynamicAge: 0, emojiPremium: false, msg: "", msg2: "", btn: "🔥 Ver Planos", redirects: [] },
    planos: { items: [], varOn: false, varCents: 50, varDir: "ambos" },
    upsell: { mode: "padrao", items: [], deliveryMsg: "", deliveryMediaUrl: "" },
    downsell: { items: [] },
    bumps: { items: [] },
    pix: {
      msg: "", pos: "junto", fmt: "caixa", qrOn: false, qrMode: "botao", qrBtn: "📱 Mostrar QR Code", verifyBtn: "🔍 VERIFICAR PAGAMENTO",
      mediaUrl: "", audioUrl: "", proofOn: false, proofInterval: 5, proofMsgs: [], fallbackOn: false, fallbackBtn: "⚠️ Problemas para pagar?", fallbackMsg: "", fallbackMediaUrl: "",
    },
    mimos: { on: false, msg: "", btn: "🎁 Enviar Mimo", thanks: "", mediaUrl: "", audioUrl: "", values: [] },
    rastreio: { fbPixelId: "", fbToken: "", ttPixelId: "", ttToken: "", utmToken: "" },
    expiracao: { msg: "", discount: 0, mediaUrl: "" },
    botoes: { cta: "none", comprar: "none", verificar: "none", qr: "none", aceitar: "none", recusar: "none", upsell: "none", desconto: "none", mimo: "none", mimoFixo: "none" },
    vip: { deliveryType: "group", groupId: "", link: "", msg: "", mediaUrl: "" },
    suporte: { user: "" },
  };
}

/** Fluxo com textos prontos (opção "Começar com textos prontos"). */
export function templateBasicConfig(): BasicFlowConfig {
  const c = blankBasicConfig();
  c.inicio.msg = "{saudacao}, {nome}! 👋\nSeja bem-vindo.\n\nToque no botão abaixo para ver os planos e liberar seu acesso na hora.";
  c.planos.items = [{ ...blankPlan(), name: "Acesso Mensal", price: 29.9, unit: "meses", amount: 1 }];
  c.pix.msg = "💳 Pague agora e garanta acesso ao <b>{nome_plano}</b>!\n\nValor: <b>R$ {valor_final}</b>\nDuração: {duracao}\n\nCopie o código Pix abaixo:";
  c.vip.msg = "✅ <b>Pagamento Confirmado!</b>\n\nOlá {nome}! Obrigado pela compra do {plano} no valor de {valor}.\n\n{link_vip}\n\nObrigado pela confiança! 🎉";
  c.downsell.items = [{ ...blankDownsell(), name: "Lembrete do Pix", msg: "{nome}, seu Pix ainda está esperando 👀\nPague agora com 10% off." }];
  c.expiracao.msg = "⏰ Seu plano expirou! Renove agora para continuar com acesso ao grupo VIP 👇";
  c.expiracao.discount = 10;
  return c;
}

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback: string, max = 4000) => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}
const COLORS: ButtonColor[] = ["none", "blue", "green", "red"];
const color = (v: unknown) => oneOf(v, COLORS, "none");
const httpsUrl = (v: unknown) => {
  const s = str(v, "", 1000).trim();
  return /^https:\/\/[^\s]+$/i.test(s) ? s : "";
};
const anyUrl = (v: unknown) => {
  const s = str(v, "", 1000).trim();
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : "";
};
/** Link de convite de grupo/supergrupo/canal do Telegram (t.me ou telegram.me) ou vazio. */
const tgLink = (v: unknown) => {
  const s = str(v, "", 300).trim().replace(/^http:\/\//i, "https://");
  return /^https:\/\/(t\.me|telegram\.me)\/[^\s]+$/i.test(s) ? s : "";
};
/** ID de grupo/canal do Telegram (-100123…) ou vazio. */
const chatId = (v: unknown) => {
  const s = str(v, "", 32).trim();
  return /^-?\d{5,20}$/.test(s) ? s : "";
};
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{4,24}$/i.test(v) ? v : newId());
const strList = (v: unknown, max: number, itemMax = 300) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, itemMax)).slice(0, max) : [];
const DELIVERY: readonly DeliveryKind[] = ["group", "link"];
const PERIODS = PERIOD_UNITS.map(([u]) => u);
const DELAYS = DELAY_UNITS.map(([u]) => u);

function normBump(v: unknown): BumpOffer {
  const b = isObj(v) ? v : {};
  const d = blankBump();
  return {
    on: bool(b.on, false),
    name: str(b.name, "", 100),
    price: num(b.price, 0, 0, 100000),
    mediaUrl: httpsUrl(b.mediaUrl),
    msg: str(b.msg, ""),
    deliveryType: oneOf(b.deliveryType, DELIVERY, "group"),
    groupId: chatId(b.groupId),
    link: anyUrl(b.link),
    yes: str(b.yes, d.yes, 64),
    no: str(b.no, d.no, 64),
  };
}
function normFollow(v: unknown): FollowUp {
  const f = isObj(v) ? v : {};
  return { on: bool(f.on, false), msg: str(f.msg, ""), mediaUrl: httpsUrl(f.mediaUrl) };
}

/** Completa com os padrões e descarta campos inválidos. Aceita a versão 1. Nunca lança erro. */
export function normalizeBasicConfig(input: unknown): BasicFlowConfig {
  const d = blankBasicConfig();
  const i = isObj(input) ? input : {};
  const g = (k: string): Obj => (isObj(i[k]) ? (i[k] as Obj) : {});
  const v1 = i.version !== 2;

  const ini = g("inicio");
  const pl = g("planos");
  const up = g("upsell");
  const ds = v1 ? g("recup") : g("downsell");
  const bp = g("bumps");
  const px = g("pix");
  const mm = g("mimos");
  const rs = g("rastreio");
  const ex = v1 ? g("renov") : g("expiracao");
  const bt = g("botoes");
  const vp = v1 ? g("entrega") : g("vip");
  const sp = g("suporte");

  const planItems = (Array.isArray(pl.items) ? pl.items : [])
    .filter(isObj)
    .filter((p) => typeof p.name === "string") // v1 (produtos) não tinha nome: descarta
    .slice(0, MAX_PLANS)
    .map((p) => ({
      id: id(p.id),
      name: str(p.name, "", 100),
      price: num(p.price, 0, 0, 100000),
      unit: oneOf(p.unit, PERIODS, "meses"),
      amount: Math.round(num(p.amount, 1, 1, 1000)),
      vipExclusive: bool(p.vipExclusive, false),
      deliveryType: oneOf(p.deliveryType, DELIVERY, "group"),
      groupId: chatId(p.groupId),
      link: tgLink(p.link),
      color: color(p.color),
    }));
  const planIds = new Set(planItems.map((p) => p.id));

  return {
    version: 2,
    inicio: {
      antiClone: bool(ini.antiClone, false),
      audioUrl: httpsUrl(ini.audioUrl),
      media: strList(ini.media, 50, 1000).filter((u) => /^https:\/\/[^\s]+$/i.test(u)).slice(0, MAX_MEDIA),
      sendMode: oneOf(ini.sendMode, ["album", "seq"] as const, "album"),
      dynamic: bool(ini.dynamic, false),
      dynamicName: str(ini.dynamicName, "", 60),
      dynamicAge: Math.round(num(ini.dynamicAge, 0, 0, 120)),
      emojiPremium: bool(ini.emojiPremium, false),
      msg: str(ini.msg, ""),
      msg2: str(ini.msg2, ""),
      btn: str(ini.btn, d.inicio.btn, 64),
      redirects: (Array.isArray(ini.redirects) ? ini.redirects : [])
        .filter(isObj)
        .map((r) => ({ text: str(r.text, "", 64), url: anyUrl(r.url) }))
        .filter((r) => r.text && r.url)
        .slice(0, MAX_REDIRECTS),
    },
    planos: {
      items: planItems,
      varOn: bool(pl.varOn, false),
      varCents: Math.round(num(pl.varCents, 50, 1, 99)),
      varDir: oneOf(pl.varDir, ["ambos", "cima", "baixo"] as const, "ambos"),
    },
    upsell: {
      mode: oneOf(up.mode, ["padrao", "sequencial"] as const, "padrao"),
      items: (Array.isArray(up.items) ? up.items : []).filter(isObj).slice(0, MAX_UPSELLS).map((u) => ({
        id: id(u.id),
        name: str(u.name, "", 100),
        mediaUrl: httpsUrl(u.mediaUrl),
        msg: str(u.msg, ""),
        price: num(u.price, 0, 0, 100000),
        deliveryType: oneOf(u.deliveryType, DELIVERY, "group"),
        groupId: chatId(u.groupId),
        link: anyUrl(u.link),
        delayUnit: oneOf(u.delayUnit, DELAYS, "imediato"),
        delayValue: Math.round(num(u.delayValue, 0, 0, 100000)),
        bump: normBump(u.bump),
      })),
      deliveryMsg: str(up.deliveryMsg, ""),
      deliveryMediaUrl: httpsUrl(up.deliveryMediaUrl),
    },
    downsell: {
      items: (Array.isArray(ds.items) ? ds.items : []).filter(isObj).slice(0, MAX_DOWNSELLS).map((r) => ({
        id: id(r.id),
        name: str(r.name, "", 100),
        mediaUrl: httpsUrl(r.mediaUrl),
        audioUrl: httpsUrl(r.audioUrl),
        msg: str(r.msg, ""),
        audience: oneOf(r.audience, ["start", "pix"] as const, "pix"),
        planIds: strList(r.planIds, MAX_PLANS, 30).filter((x) => planIds.has(x)),
        discountType: oneOf(r.discountType, ["percent", "fixed"] as const, "percent"),
        discount: num(r.discount, 0, 0, r.discountType === "fixed" ? 100000 : 90),
        delayUnit: oneOf(r.delayUnit, ["segundos", "minutos", "horas", "dias"] as const, "minutos"),
        delayValue: Math.round(num(r.delayValue, 15, 0, 100000)),
      })),
    },
    bumps: {
      items: (Array.isArray(bp.items) ? bp.items : [])
        .filter(isObj)
        .slice(0, MAX_PLANS)
        .map((b) => ({
          id: id(b.id),
          planId: typeof b.planId === "string" && planIds.has(b.planId) ? b.planId : "",
          name: str(b.name, "", 100),
          mediaUrl: httpsUrl(b.mediaUrl),
          audioUrl: httpsUrl(b.audioUrl),
          msg: str(b.msg, ""),
          price: num(b.price, 0, 0, 100000),
          deliveryType: oneOf(b.deliveryType, DELIVERY, "group"),
          groupId: chatId(b.groupId),
          link: anyUrl(b.link),
          yes: str(b.yes, "✅ Quero aproveitar!", 64),
          no: str(b.no, "❌ Não, obrigado", 64),
          ifAccept: normFollow(b.ifAccept),
          ifDecline: normFollow(b.ifDecline),
        })),
    },
    pix: {
      msg: str(px.msg, ""),
      pos: oneOf(px.pos, ["junto", "separada"] as const, "junto"),
      fmt: oneOf(px.fmt, ["caixa", "pre", "code"] as const, "caixa"),
      qrOn: bool(px.qrOn, v1 ? px.qr === "botao" || px.qr === "direto" : false),
      qrMode: oneOf(px.qrMode, ["botao", "direto"] as const, px.qr === "direto" ? "direto" : "botao"),
      qrBtn: str(px.qrBtn, d.pix.qrBtn, 64),
      verifyBtn: str(px.verifyBtn ?? px.verify, d.pix.verifyBtn, 64),
      mediaUrl: httpsUrl(px.mediaUrl),
      audioUrl: httpsUrl(px.audioUrl),
      proofOn: bool(px.proofOn ?? px.proof, false),
      proofInterval: Math.round(num(px.proofInterval, 5, 3, 30)),
      proofMsgs: strList(px.proofMsgs, 20),
      fallbackOn: bool(px.fallbackOn ?? px.fallback, false),
      fallbackBtn: str(px.fallbackBtn, d.pix.fallbackBtn, 64),
      fallbackMsg: str(px.fallbackMsg, ""),
      fallbackMediaUrl: httpsUrl(px.fallbackMediaUrl),
    },
    mimos: {
      on: bool(mm.on, false),
      msg: str(mm.msg, ""),
      btn: str(mm.btn, d.mimos.btn, 50),
      thanks: str(mm.thanks, "", 2000),
      mediaUrl: httpsUrl(mm.mediaUrl),
      audioUrl: httpsUrl(mm.audioUrl),
      values: (Array.isArray(mm.values) ? mm.values : [])
        .map((v) => (isObj(v) ? { label: str(v.label, "", 50), value: num(v.value, 0, 0, 100000) } : { label: "", value: num(v, 0, 0, 100000) }))
        .filter((v) => v.value > 0)
        .slice(0, MAX_MIMOS),
    },
    rastreio: {
      fbPixelId: str(rs.fbPixelId, "", 32).replace(/\D/g, ""),
      fbToken: str(rs.fbToken, "", 500).trim(),
      ttPixelId: str(rs.ttPixelId, "", 40).trim(),
      ttToken: str(rs.ttToken, "", 500).trim(),
      utmToken: str(rs.utmToken, "", 200).trim(),
    },
    expiracao: { msg: str(ex.msg, ""), discount: Math.round(num(ex.discount, 0, 0, 75) / 5) * 5, mediaUrl: httpsUrl(ex.mediaUrl) },
    botoes: Object.fromEntries(BUTTON_KEYS.map((k) => [k, color(bt[k])])) as Record<ButtonKey, ButtonColor>,
    vip: {
      deliveryType: v1 ? (vp.tipo === "link" ? "link" : "group") : oneOf(vp.deliveryType, DELIVERY, "group"),
      groupId: chatId(vp.groupId),
      link: tgLink(vp.link),
      msg: str(vp.msg, ""),
      mediaUrl: httpsUrl(vp.mediaUrl),
    },
    suporte: { user: str(sp.user, "", 64).trim() },
  };
}

/** Remove segredos antes de exportar o fluxo para arquivo. */
export function stripSecrets(c: BasicFlowConfig): BasicFlowConfig {
  return { ...c, rastreio: { ...c.rastreio, fbToken: "", ttToken: "", utmToken: "" } };
}

/* ------------------------------------------------------------------ */
/* Planos                                                              */
/* ------------------------------------------------------------------ */
const UNIT_LABEL: Record<PeriodUnit, [string, string]> = {
  segundos: ["segundo", "segundos"], minutos: ["minuto", "minutos"], horas: ["hora", "horas"], dias: ["dia", "dias"],
  semanas: ["semana", "semanas"], meses: ["mês", "meses"], anos: ["ano", "anos"], vitalicio: ["vitalício", "vitalício"],
};

/** "1 mês", "3 meses", "Vitalício". */
export function planPeriodLabel(p: Pick<FlowPlan, "unit" | "amount">): string {
  if (p.unit === "vitalicio") return "Vitalício";
  const [one, many] = UNIT_LABEL[p.unit];
  return `${p.amount} ${p.amount === 1 ? one : many}`;
}

/**
 * Duração gravada no produto que sustenta o plano: "custom:<n>:<unidade>"
 * (lida por calculateAccessExpiration) ou "lifetime".
 */
export function planProductDuration(p: Pick<FlowPlan, "unit" | "amount">): string {
  return p.unit === "vitalicio" ? "lifetime" : `custom:${Math.max(1, Math.round(p.amount))}:${p.unit}`;
}

/** Plano tem entrega definida (própria ou pelo Entregável da seção VIP). */
export function planDelivery(p: FlowPlan, c: BasicFlowConfig): { type: DeliveryKind; value: string } | null {
  const src = p.vipExclusive ? p : c.vip;
  const value = src.deliveryType === "group" ? src.groupId : src.link;
  return value ? { type: src.deliveryType, value } : null;
}

/* ------------------------------------------------------------------ */
/* Etapas                                                              */
/* ------------------------------------------------------------------ */
export type BasicStepId =
  | "inicio" | "planos" | "upsell" | "downsell" | "bump" | "pix" | "mimos"
  | "rastreio" | "expiracao" | "botoes" | "vip" | "disparo" | "suporte";

export type StepState = "ok" | "pend" | "off";

export function basicStepStatus(id: BasicStepId, c: BasicFlowConfig): [StepState, string] {
  switch (id) {
    case "inicio":
      return c.inicio.msg.trim() && c.inicio.btn.trim() ? ["ok", "Pronto"] : ["pend", "Falta a mensagem"];
    case "planos": {
      const n = c.planos.items.length;
      if (!n) return ["pend", "Nenhum plano"];
      if (c.planos.items.some((p) => !p.name.trim() || p.price < 1)) return ["pend", "Plano incompleto"];
      return ["ok", `${n} ${n === 1 ? "plano" : "planos"}`];
    }
    case "upsell":
      return c.upsell.items.length ? ["ok", `${c.upsell.items.length} configurado(s)`] : ["off", "Nenhum"];
    case "downsell":
      return c.downsell.items.length ? ["ok", `${c.downsell.items.length} configurado(s)`] : ["off", "Nenhum"];
    case "bump":
      return c.bumps.items.length ? ["ok", `${c.bumps.items.length} configurado(s)`] : ["off", "Nenhum"];
    case "pix":
      return ["ok", c.pix.msg.trim() ? "Personalizado" : "Mensagem padrão"];
    case "mimos":
      return c.mimos.on ? ["ok", "Ligado"] : ["off", "Desligado"];
    case "rastreio": {
      const n = [c.rastreio.fbPixelId, c.rastreio.ttPixelId, c.rastreio.utmToken].filter(Boolean).length;
      return n ? ["ok", `${n} de 3`] : ["off", "Nenhum"];
    }
    case "expiracao":
      return c.expiracao.msg.trim() ? ["ok", "Configurado"] : ["off", "Padrão"];
    case "botoes":
      return ["ok", "Cores"];
    case "vip": {
      const okAll = c.planos.items.length > 0 && c.planos.items.every((p) => planDelivery(p, c));
      return okAll ? ["ok", "Configurado"] : ["pend", "Falta o entregável"];
    }
    case "disparo":
      return ["off", "Em breve"];
    case "suporte":
      return c.suporte.user.trim() ? ["ok", "Configurado"] : ["off", "Sem suporte"];
  }
}
