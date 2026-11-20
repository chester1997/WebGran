/**
 * Configuração do Fluxo Básico ("venda na conversa").
 * Módulo puro (sem banco): usado no servidor para validar o que é salvo
 * e no cliente pelo editor. Tudo que chega do banco ou do navegador passa
 * por normalizeBasicConfig, que completa com os padrões e descarta lixo.
 */

export type ButtonColor = "none" | "blue" | "green" | "red";
export type DeliveryOwn = "padrao" | "propria";

export interface BasicFlowPlan {
  productId: string;
  on: boolean;
  color: ButtonColor;
}

export interface BasicFlowUpsell {
  name: string;
  price: number;
  delay: string;
  hideDecline: boolean;
  msg: string;
}

export interface BasicFlowRecovery {
  name: string;
  audience: "pix" | "start";
  delay: string;
  discount: number;
  msg: string;
}

export interface BasicFlowConfig {
  version: 1;
  inicio: {
    msg: string;
    msg2: string;
    media: string[];
    sendMode: "album" | "seq";
    btn: string;
    antiClone: boolean;
  };
  planos: {
    msg: string;
    items: BasicFlowPlan[];
    varOn: boolean;
    varCents: number;
    varDir: "ambos" | "cima" | "baixo";
  };
  bump: {
    on: boolean;
    productScope: string; // "todos" ou productId
    name: string;
    price: number;
    msg: string;
    yes: string;
    no: string;
    msgYes: string;
    msgNo: string;
    inUpsell: boolean;
    inRecovery: boolean;
  };
  pix: {
    msg: string;
    pos: "junto" | "separada";
    fmt: "caixa" | "pre" | "code";
    qr: "off" | "botao" | "direto";
    verify: string;
    proof: boolean;
    proofInterval: number;
    proofMsgs: string[];
    fallback: boolean;
  };
  entrega: {
    tipo: "grupo" | "link" | "texto";
    chatId: string;
    link: string;
    msg: string;
    bump: DeliveryOwn;
    upsell: DeliveryOwn;
    recovery: DeliveryOwn;
  };
  upsell: { mode: "padrao" | "sequencial"; items: BasicFlowUpsell[] };
  recup: { items: BasicFlowRecovery[] };
  renov: { msg: string; discount: number };
  mimos: { on: boolean; msg: string; btn: string; thanks: string; values: number[] };
  botoes: Record<"cta" | "comprar" | "verificar" | "aceitar" | "recusar" | "upsell" | "desconto" | "mimo", ButtonColor>;
  suporte: { user: string; msg: string };
  rastreio: { fb: boolean; fbPixelId: string; tt: boolean; ttPixelId: string; utm: boolean };
}

export const DELAY_OPTIONS = ["Imediato", "5 minutos", "15 minutos", "30 minutos", "1 hora", "2 horas", "6 horas", "1 dia", "3 dias"] as const;
export const MAX_PLANS = 10;
export const MAX_UPSELLS = 5;
export const MAX_RECOVERY = 20;
export const MAX_MEDIA = 5;
export const MAX_MIMOS = 10;

const COLORS: ButtonColor[] = ["none", "blue", "green", "red"];

/** Fluxo vazio: só o essencial preenchido para não quebrar a prévia. */
export function blankBasicConfig(): BasicFlowConfig {
  return {
    version: 1,
    inicio: { msg: "", msg2: "", media: [], sendMode: "album", btn: "🔥 Ver planos", antiClone: false },
    planos: { msg: "Escolha seu plano 👇", items: [], varOn: false, varCents: 50, varDir: "ambos" },
    bump: { on: false, productScope: "todos", name: "", price: 0, msg: "", yes: "✅ Quero aproveitar", no: "Não, obrigado", msgYes: "", msgNo: "", inUpsell: false, inRecovery: false },
    pix: { msg: "", pos: "junto", fmt: "caixa", qr: "botao", verify: "🔍 Verificar pagamento", proof: false, proofInterval: 6, proofMsgs: [], fallback: false },
    entrega: { tipo: "grupo", chatId: "", link: "", msg: "", bump: "padrao", upsell: "padrao", recovery: "padrao" },
    upsell: { mode: "padrao", items: [] },
    recup: { items: [] },
    renov: { msg: "", discount: 0 },
    mimos: { on: false, msg: "", btn: "🎁 Enviar mimo", thanks: "", values: [10, 20, 50] },
    botoes: { cta: "blue", comprar: "green", verificar: "none", aceitar: "green", recusar: "none", upsell: "blue", desconto: "red", mimo: "none" },
    suporte: { user: "", msg: "Precisa de ajuda? Fale com a gente 👇" },
    rastreio: { fb: false, fbPixelId: "", tt: false, ttPixelId: "", utm: false },
  };
}

/** Fluxo com textos prontos (opção "Começar com textos prontos"). */
export function templateBasicConfig(): BasicFlowConfig {
  const c = blankBasicConfig();
  c.inicio.msg = "{saudacao}, {nome}! 👋\nSeja bem-vindo.\n\nToque no botão abaixo para ver os planos e liberar seu acesso na hora.";
  c.pix.msg = "💳 Falta pouco, {nome}!\n\nPlano: <b>{plano}</b>\nValor: <b>{valor}</b>\n\nCopie o código e pague no app do seu banco:";
  c.pix.proof = true;
  c.pix.proofMsgs = ["🔥 {random} pessoas de {localizacao} compraram hoje"];
  c.entrega.msg = "✅ <b>Pagamento confirmado!</b>\n\nObrigado, {nome}. Seu acesso ao <b>{plano}</b> está liberado. Toque no botão abaixo para entrar 👇";
  c.recup.items = [
    { name: "Lembrete do Pix", audience: "pix", delay: "15 minutos", discount: 10, msg: "{nome}, seu Pix ainda está esperando 👀\nPague agora com 10% off." },
  ];
  c.renov.msg = "⏰ {nome}, seu acesso ao <b>{plano}</b> venceu.\nRenove agora e continue no grupo 👇";
  c.renov.discount = 10;
  return c;
}

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback: string, max = 4000) => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}
const color = (v: unknown, fallback: ButtonColor) => oneOf(v, COLORS, fallback);
const delay = (v: unknown, fallback: string) => oneOf(v, DELAY_OPTIONS, fallback as (typeof DELAY_OPTIONS)[number]);
const strList = (v: unknown, max: number, itemMax = 300) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, itemMax)).slice(0, max) : [];

/** Completa com os padrões e descarta campos inválidos. Nunca lança erro. */
export function normalizeBasicConfig(input: unknown): BasicFlowConfig {
  const d = blankBasicConfig();
  const i = isObj(input) ? input : {};
  const g = (k: string) => (isObj(i[k]) ? (i[k] as Record<string, unknown>) : {});

  const ini = g("inicio");
  const pl = g("planos");
  const bp = g("bump");
  const px = g("pix");
  const en = g("entrega");
  const up = g("upsell");
  const rc = g("recup");
  const rn = g("renov");
  const mm = g("mimos");
  const bt = g("botoes");
  const sp = g("suporte");
  const rs = g("rastreio");

  return {
    version: 1,
    inicio: {
      msg: str(ini.msg, d.inicio.msg),
      msg2: str(ini.msg2, d.inicio.msg2),
      media: strList(ini.media, MAX_MEDIA, 1000).filter((u) => /^https:\/\//.test(u)),
      sendMode: oneOf(ini.sendMode, ["album", "seq"] as const, d.inicio.sendMode),
      btn: str(ini.btn, d.inicio.btn, 64),
      antiClone: bool(ini.antiClone, d.inicio.antiClone),
    },
    planos: {
      msg: str(pl.msg, d.planos.msg, 1000),
      items: (Array.isArray(pl.items) ? pl.items : [])
        .filter(isObj)
        .filter((p) => typeof p.productId === "string" && p.productId)
        .slice(0, 50)
        .map((p) => ({ productId: String(p.productId), on: bool(p.on, true), color: color(p.color, "none") })),
      varOn: bool(pl.varOn, d.planos.varOn),
      varCents: num(pl.varCents, d.planos.varCents, 1, 99),
      varDir: oneOf(pl.varDir, ["ambos", "cima", "baixo"] as const, d.planos.varDir),
    },
    bump: {
      on: bool(bp.on, d.bump.on),
      productScope: str(bp.productScope, d.bump.productScope, 64),
      name: str(bp.name, d.bump.name, 100),
      price: num(bp.price, d.bump.price, 0, 100000),
      msg: str(bp.msg, d.bump.msg),
      yes: str(bp.yes, d.bump.yes, 64),
      no: str(bp.no, d.bump.no, 64),
      msgYes: str(bp.msgYes, d.bump.msgYes),
      msgNo: str(bp.msgNo, d.bump.msgNo),
      inUpsell: bool(bp.inUpsell, d.bump.inUpsell),
      inRecovery: bool(bp.inRecovery, d.bump.inRecovery),
    },
    pix: {
      msg: str(px.msg, d.pix.msg),
      pos: oneOf(px.pos, ["junto", "separada"] as const, d.pix.pos),
      fmt: oneOf(px.fmt, ["caixa", "pre", "code"] as const, d.pix.fmt),
      qr: oneOf(px.qr, ["off", "botao", "direto"] as const, d.pix.qr),
      verify: str(px.verify, d.pix.verify, 64),
      proof: bool(px.proof, d.pix.proof),
      proofInterval: num(px.proofInterval, d.pix.proofInterval, 3, 30),
      proofMsgs: strList(px.proofMsgs, 10),
      fallback: bool(px.fallback, d.pix.fallback),
    },
    entrega: {
      tipo: oneOf(en.tipo, ["grupo", "link", "texto"] as const, d.entrega.tipo),
      chatId: str(en.chatId, d.entrega.chatId, 64),
      link: str(en.link, d.entrega.link, 1000),
      msg: str(en.msg, d.entrega.msg),
      bump: oneOf(en.bump, ["padrao", "propria"] as const, "padrao"),
      upsell: oneOf(en.upsell, ["padrao", "propria"] as const, "padrao"),
      recovery: oneOf(en.recovery, ["padrao", "propria"] as const, "padrao"),
    },
    upsell: {
      mode: oneOf(up.mode, ["padrao", "sequencial"] as const, d.upsell.mode),
      items: (Array.isArray(up.items) ? up.items : []).filter(isObj).slice(0, MAX_UPSELLS).map((u) => ({
        name: str(u.name, "Oferta", 100),
        price: num(u.price, 0, 0, 100000),
        delay: delay(u.delay, "Imediato"),
        hideDecline: bool(u.hideDecline, false),
        msg: str(u.msg, ""),
      })),
    },
    recup: {
      items: (Array.isArray(rc.items) ? rc.items : []).filter(isObj).slice(0, MAX_RECOVERY).map((r) => ({
        name: str(r.name, "Mensagem", 100),
        audience: oneOf(r.audience, ["pix", "start"] as const, "pix"),
        delay: delay(r.delay, "15 minutos") === "Imediato" ? "5 minutos" : delay(r.delay, "15 minutos"),
        discount: num(r.discount, 0, 0, 90),
        msg: str(r.msg, ""),
      })),
    },
    renov: { msg: str(rn.msg, d.renov.msg), discount: num(rn.discount, d.renov.discount, 0, 75) },
    mimos: {
      on: bool(mm.on, d.mimos.on),
      msg: str(mm.msg, d.mimos.msg),
      btn: str(mm.btn, d.mimos.btn, 50),
      thanks: str(mm.thanks, d.mimos.thanks, 2000),
      values: (Array.isArray(mm.values) ? mm.values : d.mimos.values)
        .map((v) => num(v, NaN, 1, 100000))
        .filter((v) => Number.isFinite(v))
        .slice(0, MAX_MIMOS),
    },
    botoes: {
      cta: color(bt.cta, d.botoes.cta),
      comprar: color(bt.comprar, d.botoes.comprar),
      verificar: color(bt.verificar, d.botoes.verificar),
      aceitar: color(bt.aceitar, d.botoes.aceitar),
      recusar: color(bt.recusar, d.botoes.recusar),
      upsell: color(bt.upsell, d.botoes.upsell),
      desconto: color(bt.desconto, d.botoes.desconto),
      mimo: color(bt.mimo, d.botoes.mimo),
    },
    suporte: { user: str(sp.user, d.suporte.user, 64), msg: str(sp.msg, d.suporte.msg, 1000) },
    rastreio: {
      fb: bool(rs.fb, false),
      fbPixelId: str(rs.fbPixelId, "", 32).replace(/\D/g, ""),
      tt: bool(rs.tt, false),
      ttPixelId: str(rs.ttPixelId, "", 40),
      utm: bool(rs.utm, false),
    },
  };
}

export type BasicStepId =
  | "inicio" | "planos" | "bump" | "pix" | "entrega"
  | "upsell" | "recup" | "renov"
  | "mimos" | "botoes" | "suporte"
  | "disparo" | "rastreio";

export type StepState = "ok" | "pend" | "off";

/** Situação de cada etapa para a barra lateral e a checklist de publicação. */
export function basicStepStatus(id: BasicStepId, c: BasicFlowConfig): [StepState, string] {
  switch (id) {
    case "inicio":
      return c.inicio.msg.trim() && c.inicio.btn.trim() ? ["ok", "Pronto"] : ["pend", "Falta a mensagem"];
    case "planos": {
      const n = c.planos.items.filter((p) => p.on).length;
      return n ? ["ok", `${n} ${n === 1 ? "plano" : "planos"}`] : ["pend", "Nenhum plano"];
    }
    case "bump":
      return c.bump.on ? (c.bump.name.trim() && c.bump.price > 0 ? ["ok", "Ligado"] : ["pend", "Falta nome ou preço"]) : ["off", "Desligado"];
    case "pix":
      return c.pix.msg.trim() ? ["ok", "Pronto"] : ["pend", "Falta a mensagem"];
    case "entrega": {
      // O destino vem de cada produto; aqui só a mensagem (opcional).
      return c.entrega.msg.trim() ? ["ok", "Mensagem própria"] : ["ok", "Mensagem padrão"];
    }
    case "upsell":
      return c.upsell.items.length ? ["ok", `${c.upsell.items.length} ${c.upsell.items.length === 1 ? "oferta" : "ofertas"}`] : ["off", "Nenhuma oferta"];
    case "recup":
      return c.recup.items.length ? ["ok", `${c.recup.items.length} ${c.recup.items.length === 1 ? "mensagem" : "mensagens"}`] : ["off", "Nenhuma mensagem"];
    case "renov":
      return c.renov.msg.trim() ? ["ok", c.renov.discount ? `${c.renov.discount}% off` : "Sem desconto"] : ["off", "Desligado"];
    case "mimos":
      return c.mimos.on ? ["ok", "Ligado"] : ["off", "Desligado"];
    case "botoes":
      return ["ok", "Personalizado"];
    case "suporte":
      return c.suporte.user.trim() ? ["ok", c.suporte.user] : ["off", "Sem suporte"];
    case "disparo":
      return ["off", "Em breve"];
    case "rastreio": {
      const n = [c.rastreio.fb, c.rastreio.tt, c.rastreio.utm].filter(Boolean).length;
      return n ? ["ok", `${n} de 3`] : ["off", "Nenhum"];
    }
  }
}
