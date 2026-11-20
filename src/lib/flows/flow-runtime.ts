/**
 * Motor do Fluxo Básico no Telegram (Fase 1).
 *
 * Só é acionado para um bot ligado a um fluxo BÁSICO PUBLICADO, ou no modo de
 * teste (link "Testar no Telegram", que roda o rascunho só para quem abre o link).
 * Qualquer erro ao carregar o fluxo devolve null e o webhook segue o
 * comportamento antigo do bot (fail-open).
 *
 * Seções ativas: Início, Planos (valor + tempo, sem produto), Order Bump, PIX, Upsell,
 * Downsell, Mimos, Rastreamento, Expiração (com desconto de renovação), Botões (cores),
 * Entregável, Disparo e Suporte. As tarefas agendadas ficam em flow-jobs.ts.
 */
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, salesFlowBots, salesFlows } from "@/db/schema";
import { telegramFetch } from "@/lib/telegram/client";
import { normalizeBasicConfig, planDelivery, planPeriodLabel, type BasicFlowConfig, type ButtonColor, type FlowPlan } from "./basic-config";

export type FlowMode = "live" | "test";
/** Prefixo dos botões: "fl" (publicado) ou "ft" (teste do rascunho). */
export const CB_PREFIX: Record<FlowMode, string> = { live: "fl", test: "ft" };

export interface LoadedFlow {
  flowId: string;
  status: "draft" | "published";
  config: BasicFlowConfig;
}

export interface FlowCtx {
  token: string;
  storeId: string;
  storeSlug: string;
  botDbId: string;
}

export const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/* ------------------------------------------------------------------ */
/* Carregamento                                                        */
/* ------------------------------------------------------------------ */

/** Fluxo básico ligado ao bot. `includeDraft` só no modo de teste. Nunca lança erro. */
export async function getBasicFlowForBot(botDbId: string, opts: { includeDraft?: boolean } = {}): Promise<LoadedFlow | null> {
  if (!botDbId) return null;
  try {
    const rows = await db
      .select({ id: salesFlows.id, status: salesFlows.status, type: salesFlows.type, config: salesFlows.config })
      .from(salesFlowBots)
      .innerJoin(salesFlows, eq(salesFlows.id, salesFlowBots.flowId))
      .where(eq(salesFlowBots.botId, botDbId))
      .limit(1);
    const f = rows[0];
    if (!f || f.type !== "basic") return null;
    if (f.status !== "published" && !opts.includeDraft) return null;
    return { flowId: f.id, status: f.status === "published" ? "published" : "draft", config: normalizeBasicConfig(f.config) };
  } catch (err) {
    console.warn("[flow-runtime] Fluxo indisponível, usando o bot padrão:", (err as Error)?.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Link de teste                                                       */
/* ------------------------------------------------------------------ */
const secret = () => process.env.NEXTAUTH_SECRET || "webgran-flow-test";

/** start param do teste: "fltest_<flowId sem hífens>_<assinatura>" (máx. 64 caracteres). */
export function buildTestStartParam(flowId: string): string {
  const compact = flowId.replace(/-/g, "");
  const sig = crypto.createHmac("sha256", secret()).update(`flow-test:${flowId}`).digest("hex").slice(0, 12);
  return `fltest_${compact}_${sig}`;
}

/** Devolve o flowId se o parâmetro de teste for válido. */
export function parseTestStartParam(param: string): string | null {
  const m = /^fltest_([0-9a-f]{32})_([0-9a-f]{12})$/i.exec(param.trim());
  if (!m) return null;
  const c = m[1].toLowerCase();
  const flowId = `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
  const expected = buildTestStartParam(flowId).split("_")[2];
  const a = Buffer.from(m[2].toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? flowId : null;
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "Bom dia" / "Boa tarde" / "Boa noite" no horário de Brasília. */
export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(now));
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/**
 * Texto do vendedor → HTML do Telegram. Escapa tudo, reabre só <b> <i> <u> <s> <code>
 * e então troca as variáveis por valores também escapados (um nome com "<" não quebra a mensagem).
 */
export function renderFlowText(template: string, vars: Record<string, string>): string {
  let html = escapeHtml(String(template || "")).replace(/&lt;(\/?)(b|i|u|s|code)&gt;/g, "<$1$2>");
  for (const [k, v] of Object.entries(vars)) html = html.split(k).join(escapeHtml(v));
  // Variáveis sem dado (ex.: {localizacao}) somem em vez de aparecer cruas.
  return html.replace(/\{(nome|saudacao|localizacao|plano|nome_plano|valor|valor_final|duracao|link_vip|codigo_pix|random)\}/g, "").trim();
}

export function pixCodeHtml(code: string, fmt: BasicFlowConfig["pix"]["fmt"]): string {
  const c = escapeHtml(code);
  if (fmt === "caixa") return `<blockquote><code>${c}</code></blockquote>`;
  if (fmt === "pre") return `<pre>${c}</pre>`;
  return `<code>${c}</code>`;
}

function appBaseUrl() {
  let raw = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
  if (!raw.startsWith("http")) raw = `https://${raw}`;
  if (raw.includes("webgran.online") && !raw.includes("www.webgran.online")) raw = raw.replace("webgran.online", "www.webgran.online");
  return raw.replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */
type Kb = { inline_keyboard: Array<Array<Record<string, unknown>>> };

async function send(ctx: FlowCtx, chatId: number | string, html: string, kb: Kb | undefined, protect: boolean) {
  if (!html.trim() && !kb) return;
  return telegramFetch(ctx.token, "sendMessage", {
    chat_id: chatId,
    text: html.trim() || "👇",
    parse_mode: "HTML",
    reply_markup: kb,
    protect_content: protect || undefined,
    link_preview_options: { is_disabled: true },
  });
}

async function sendPhoto(ctx: FlowCtx, chatId: number | string, url: string, protect: boolean, caption?: string, kb?: Kb) {
  return telegramFetch(ctx.token, "sendPhoto", {
    chat_id: chatId,
    photo: url,
    caption,
    parse_mode: caption ? "HTML" : undefined,
    reply_markup: kb,
    protect_content: protect || undefined,
  });
}

async function answer(ctx: FlowCtx, cbId: string, text?: string, alert = false) {
  try {
    await telegramFetch(ctx.token, "answerCallbackQuery", { callback_query_id: cbId, text, show_alert: alert || undefined });
  } catch {
    // não bloqueia
  }
}

type TgUser = { id: number | string; first_name?: string; last_name?: string; username?: string; language_code?: string };

const baseVars = (user: TgUser) => ({ "{nome}": user.first_name || "", "{saudacao}": greeting() });

const isVideo = (u: string) => /\.(mp4|mov)(\?|$)/i.test(u);
const isVoice = (u: string) => /\.(ogg|oga|opus)(\?|$)/i.test(u);

/** Envia uma mídia solta (foto, vídeo ou áudio) sem derrubar o fluxo se falhar. Retorna se enviou. */
async function sendMedia(ctx: FlowCtx, chatId: number | string, url: string, protect: boolean, caption?: string, kb?: Kb): Promise<boolean> {
  if (!url) return false;
  try {
    const common = { chat_id: chatId, caption, parse_mode: caption ? "HTML" : undefined, reply_markup: kb, protect_content: protect || undefined };
    if (/\.(ogg|oga|opus|mp3|m4a)(\?|$)/i.test(url)) {
      await telegramFetch(ctx.token, isVoice(url) ? "sendVoice" : "sendAudio", { ...common, [isVoice(url) ? "voice" : "audio"]: url });
    } else if (isVideo(url)) {
      await telegramFetch(ctx.token, "sendVideo", { ...common, video: url });
    } else {
      await telegramFetch(ctx.token, "sendPhoto", { ...common, photo: url });
    }
    return true;
  } catch (err) {
    console.warn("[flow-runtime] Falha ao enviar mídia:", (err as Error)?.message);
    return false;
  }
}

/** Limite de legenda do Telegram (foto/vídeo). */
const CAPTION_MAX = 1024;

const planVars = (plan: FlowPlan, total?: number) => {
  const value = total ?? plan.price;
  return {
    "{plano}": plan.name,
    "{nome_plano}": plan.name,
    "{valor}": brl(value),
    "{valor_final}": (Number(value) || 0).toFixed(2).replace(".", ","),
    "{duracao}": planPeriodLabel(plan),
  };
};

const validPlans = (c: BasicFlowConfig) => c.planos.items.filter((p) => p.name.trim() && p.price >= 1);

/* ------------------------------------------------------------------ */
/* Botões (cores da seção Botões: Bot API 9.4 "style")                 */
/* ------------------------------------------------------------------ */
const STYLE: Record<Exclude<ButtonColor, "none">, string> = { blue: "primary", green: "success", red: "danger" };
type Btn = Record<string, unknown>;
const styled = (b: Btn, color?: ButtonColor): Btn => (color && color !== "none" ? { ...b, style: STYLE[color] } : b);
const cbBtn = (text: string, data: string, color?: ButtonColor) => styled({ text, callback_data: data }, color);

/** Preço com desconto (downsell "d<id>" ou renovação "r"). Nunca abaixo de R$ 1,00. */
export function discountedPrice(c: BasicFlowConfig, plan: FlowPlan, tag?: string): number {
  let price = plan.price;
  if (tag === "r" && c.expiracao.discount > 0) price = plan.price * (1 - c.expiracao.discount / 100);
  else if (tag?.startsWith("d")) {
    const ds = c.downsell.items.find((x) => x.id === tag.slice(1));
    if (ds && ds.discount > 0 && (!ds.planIds.length || ds.planIds.includes(plan.id))) {
      price = ds.discountType === "fixed" ? plan.price - ds.discount : plan.price * (1 - ds.discount / 100);
    }
  }
  return Math.max(1, Math.round(price * 100) / 100);
}

/** Botões dos planos. `tag` aplica desconto (e muda a cor para a do botão de desconto). */
export function planRows(c: BasicFlowConfig, p: string, tag?: string, onlyIds?: string[]): Kb["inline_keyboard"] {
  return validPlans(c)
    .filter((pl) => !onlyIds?.length || onlyIds.includes(pl.id))
    .map((pl) => {
      const price = discountedPrice(c, pl, tag);
      const label = price < pl.price ? `${pl.name} - ${brl(price)} (de ${brl(pl.price)})` : `${pl.name} - ${brl(pl.price)}`;
      const color = tag ? c.botoes.desconto : pl.color !== "none" ? pl.color : c.botoes.comprar;
      return [cbBtn(label, `${p}:buy:${pl.id}${tag ? ":" + tag : ""}`, color)];
    });
}

const mimoOn = (c: BasicFlowConfig) => c.mimos.on && c.mimos.values.some((v) => v.value >= 1);

/* ------------------------------------------------------------------ */
/* /start                                                              */
/* ------------------------------------------------------------------ */
export async function runFlowStart(ctx: FlowCtx, flow: LoadedFlow, mode: FlowMode, chatId: number | string, user: TgUser) {
  const c = flow.config;
  const p = CB_PREFIX[mode];
  const protect = c.inicio.antiClone;
  const vars = baseVars(user);

  if (mode === "test") await send(ctx, chatId, "🧪 <b>Modo de teste</b> do fluxo (rascunho). Os clientes ainda não veem isso.", undefined, false);

  // Áudio de boas-vindas
  if (c.inicio.audioUrl) await sendMedia(ctx, chatId, c.inicio.audioUrl, protect);

  // Planos direto na boas-vindas (padrão) ou o botão "Ver planos" (CTA).
  const plans = c.inicio.showPlans ? planRows(c, p) : [];
  const rows: Kb["inline_keyboard"] = plans.length ? plans : [[cbBtn(c.inicio.btn || "🔥 Ver Planos", `${p}:plans`, c.botoes.cta)]];
  for (const r of c.inicio.redirects) if (r.text.trim() && /^https:\/\//i.test(r.url)) rows.push([{ text: r.text.trim(), url: r.url }]);
  if (mimoOn(c)) rows.push([cbBtn(c.mimos.btn || "🎁 Enviar Mimo", `${p}:mimo`, c.botoes.mimo)]);
  const text = renderFlowText(c.inicio.msg || "Olá, {nome}! 👋", vars).trim();
  const kb = { inline_keyboard: rows };

  // Mídias (foto ou vídeo). Com uma mídia só (ou envio em sequência), a mensagem e os botões
  // vão como legenda da última mídia, num balão só. Álbum não aceita botões: texto vai separado.
  const media = c.inicio.media;
  let textSent = false;
  if (media.length > 1 && c.inicio.sendMode === "album") {
    try {
      await telegramFetch(ctx.token, "sendMediaGroup", {
        chat_id: chatId,
        media: media.map((url) => ({ type: isVideo(url) ? "video" : "photo", media: url })),
        protect_content: protect || undefined,
      });
    } catch (err) {
      console.warn("[flow-runtime] Falha ao enviar álbum:", (err as Error)?.message);
    }
  } else {
    for (let i = 0; i < media.length; i++) {
      const last = i === media.length - 1;
      if (last && text && text.length <= CAPTION_MAX) {
        textSent = await sendMedia(ctx, chatId, media[i], protect, text, kb);
        if (!textSent) await sendMedia(ctx, chatId, media[i], protect); // legenda inválida: manda a mídia sozinha
      } else {
        await sendMedia(ctx, chatId, media[i], protect);
      }
    }
  }

  if (!textSent) await send(ctx, chatId, text, kb, protect);
  if (c.inicio.msg2.trim()) await send(ctx, chatId, renderFlowText(c.inicio.msg2, vars), undefined, protect);

  // Downsell para quem deu /start e não comprou + evento Lead. Não bloqueiam a resposta.
  const uid = String(user.id);
  const startOffers = c.downsell.items.filter((d) => d.audience === "start");
  if (startOffers.length) {
    const { scheduleFlowJobs, delayMs } = await import("./flow-jobs");
    await scheduleFlowJobs(
      startOffers.map((d) => ({
        storeId: ctx.storeId, botId: ctx.botDbId, flowId: flow.flowId, telegramUserId: uid, kind: "downsell" as const, ref: d.id,
        runAt: new Date(Date.now() + Math.max(delayMs(d.delayUnit, d.delayValue), 60_000)),
        payload: { firstName: user.first_name || "" },
      }))
    );
  }
  if (mode === "live") {
    const { trackFlowEvent } = await import("./flow-tracking");
    await trackFlowEvent({ rastreio: c.rastreio, event: "lead", storeId: ctx.storeId, botDbId: ctx.botDbId, telegramUserId: uid, firstName: user.first_name, lastName: user.last_name });
  }
}

/* ------------------------------------------------------------------ */
/* /suporte                                                            */
/* ------------------------------------------------------------------ */
export async function runFlowSupport(ctx: FlowCtx, flow: LoadedFlow, chatId: number | string, user: TgUser): Promise<boolean> {
  const u = flow.config.suporte.user.trim().replace(/^@/, "");
  if (!u || !/^[A-Za-z0-9_]{4,64}$/.test(u)) return false; // sem suporte no fluxo: usa o padrão da loja
  await send(
    ctx,
    chatId,
    renderFlowText("{saudacao}, {nome}! Precisa de ajuda? Fale com a gente 👇", baseVars(user)),
    { inline_keyboard: [[{ text: `💬 Falar com @${u}`, url: `https://t.me/${u}` }]] },
    flow.config.inicio.antiClone
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Pix                                                                 */
/* ------------------------------------------------------------------ */
type Delivery = { type: "group" | "link" | "none"; value: string };

const deliveryOf = (x: { deliveryType: "group" | "link"; groupId: string; link: string }): { type: "group" | "link"; value: string } | null => {
  const value = x.deliveryType === "group" ? x.groupId : x.link;
  return value ? { type: x.deliveryType, value } : null;
};

/** Gera o Pix (plano, upsell ou mimo) e manda a mensagem do PIX. */
async function startPix(
  ctx: FlowCtx,
  flow: LoadedFlow,
  mode: FlowMode,
  cb: { id: string; chatId: number | string; user: TgUser },
  item: { plan: FlowPlan; delivery: Delivery; kind: "plan" | "upsell" | "mimo"; extras?: { id: string; name: string; price: number; deliveryType: "group" | "link"; deliveryValue: string }[] }
) {
  const c = flow.config;
  const p = CB_PREFIX[mode];
  const { CartService } = await import("@/lib/cart/cart-service");
  const { createPlanCheckout } = await import("./flow-checkout");
  const customer = await CartService.getOrCreateCustomerForTelegramUser(ctx.storeId, {
    id: cb.user.id,
    first_name: cb.user.first_name,
    last_name: cb.user.last_name,
    username: cb.user.username,
  });
  const res = await createPlanCheckout({ storeId: ctx.storeId, customerId: customer.id, botDbId: ctx.botDbId, flowId: flow.flowId, plan: item.plan, delivery: item.delivery, kind: item.kind, extras: item.extras });
  if (!res.success || !res.orderId) {
    await send(ctx, cb.chatId, `⚠️ ${escapeHtml(res.error || "Não foi possível gerar o Pix agora. Tente de novo em instantes.")}`, undefined, false);
    return;
  }

  const orderId = res.orderId;
  const code = res.pix?.qrCode || "";
  const hasQr = Boolean(res.pix?.qrCodeBase64);
  const vars = { ...baseVars(cb.user), ...planVars(item.plan, res.total ?? undefined) };
  const kb: Kb = { inline_keyboard: [[cbBtn(c.pix.verifyBtn || "🔍 VERIFICAR PAGAMENTO", `${p}:chk:${orderId}`, c.botoes.verificar)]] };
  if (c.pix.qrOn && c.pix.qrMode === "botao" && hasQr) kb.inline_keyboard.push([cbBtn(c.pix.qrBtn || "📱 Mostrar QR Code", `${p}:qr:${orderId}`, c.botoes.qr)]);

  if (c.pix.audioUrl) await sendMedia(ctx, cb.chatId, c.pix.audioUrl, false);
  if (c.pix.mediaUrl) await sendMedia(ctx, cb.chatId, c.pix.mediaUrl, false);
  if (c.pix.qrOn && c.pix.qrMode === "direto" && hasQr) await sendMedia(ctx, cb.chatId, `${appBaseUrl()}/api/telegram/order-qr/${orderId}`, false);

  const template = item.kind === "mimo"
    ? "🎁 Obrigado pelo carinho! Valor: <b>R$ {valor_final}</b>\n\nCopie o código Pix abaixo:"
    : c.pix.msg || "💳 Pague agora e garanta acesso ao <b>{nome_plano}</b>!\n\nValor: <b>R$ {valor_final}</b>\nDuração: {duracao}\n\nCopie o código Pix abaixo:";
  const codeHtml = code ? pixCodeHtml(code, c.pix.fmt) : "";
  if (code && template.includes("{codigo_pix}")) {
    // O vendedor escolheu onde o código aparece dentro da mensagem.
    const [before, ...after] = template.split("{codigo_pix}");
    const html = `${renderFlowText(before, vars)}\n${codeHtml}\n${renderFlowText(after.join(""), vars)}`.trim();
    await send(ctx, cb.chatId, html, kb, false);
  } else if (!code) {
    await send(ctx, cb.chatId, renderFlowText(template, vars), kb, false);
  } else if (c.pix.pos === "junto") {
    await send(ctx, cb.chatId, `${renderFlowText(template, vars)}\n\n${codeHtml}`, kb, false);
  } else {
    await send(ctx, cb.chatId, renderFlowText(template, vars), undefined, false);
    await send(ctx, cb.chatId, codeHtml, kb, false);
  }

  // Downsell de "gerou Pix e não pagou" + evento InitiateCheckout.
  const uid = String(cb.user.id);
  if (item.kind === "plan") {
    const pixOffers = c.downsell.items.filter((d) => d.audience === "pix");
    if (pixOffers.length) {
      const { scheduleFlowJobs, delayMs } = await import("./flow-jobs");
      await scheduleFlowJobs(
        pixOffers.map((d) => ({
          storeId: ctx.storeId, botId: ctx.botDbId, flowId: flow.flowId, telegramUserId: uid, kind: "downsell" as const, ref: d.id,
          runAt: new Date(Date.now() + Math.max(delayMs(d.delayUnit, d.delayValue), 60_000)),
          payload: { orderId, firstName: cb.user.first_name || "" },
        }))
      );
    }
  }
  if (mode === "live") {
    const { trackFlowEvent } = await import("./flow-tracking");
    await trackFlowEvent({ rastreio: c.rastreio, event: "checkout", storeId: ctx.storeId, botDbId: ctx.botDbId, telegramUserId: uid, firstName: cb.user.first_name, lastName: cb.user.last_name, orderId, value: res.total, itemId: item.plan.id, itemName: item.plan.name });
  }
}

/** Order Bump do plano (o primeiro configurado para ele, ou para todos). */
const bumpFor = (c: BasicFlowConfig, planId: string) =>
  c.bumps.items.find((b) => (b.planId === planId || !b.planId) && b.name.trim() && b.price >= 1 && deliveryOf(b));

async function sendFollowUp(ctx: FlowCtx, chatId: number | string, f: { on: boolean; msg: string; mediaUrl: string }, vars: Record<string, string>) {
  if (!f.on) return;
  const text = renderFlowText(f.msg, vars);
  if (f.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, chatId, f.mediaUrl, false, text || undefined))) return;
  if (f.mediaUrl) await sendMedia(ctx, chatId, f.mediaUrl, false);
  if (text) await send(ctx, chatId, text, undefined, false);
}

/* ------------------------------------------------------------------ */
/* Ofertas agendadas (chamadas pela fila flow-jobs)                    */
/* ------------------------------------------------------------------ */
/** Downsell: mensagem + planos com desconto. False = oferta não existe mais. */
export async function sendDownsellOffer(ctx: FlowCtx, flow: LoadedFlow, mode: FlowMode, telegramUserId: string, downsellId: string, firstName = ""): Promise<boolean> {
  const c = flow.config;
  const ds = c.downsell.items.find((d) => d.id === downsellId);
  if (!ds) return false;
  const rows = planRows(c, CB_PREFIX[mode], `d${ds.id}`, ds.planIds);
  if (!rows.length) return false;
  const vars = { "{nome}": firstName, "{saudacao}": greeting() };
  const text = renderFlowText(ds.msg || "{nome}, ainda dá tempo! Seu acesso com desconto especial 👇", vars);
  if (ds.audioUrl) await sendMedia(ctx, telegramUserId, ds.audioUrl, c.inicio.antiClone);
  if (ds.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, telegramUserId, ds.mediaUrl, c.inicio.antiClone, text, { inline_keyboard: rows }))) return true;
  await send(ctx, telegramUserId, text, { inline_keyboard: rows }, c.inicio.antiClone);
  return true;
}

/** Upsell: mensagem + "Pagar" / "Não tenho interesse". False = oferta não existe mais. */
export async function sendUpsellOffer(ctx: FlowCtx, flow: LoadedFlow, mode: FlowMode, telegramUserId: string, upsellId: string): Promise<boolean> {
  const c = flow.config;
  const u = c.upsell.items.find((x) => x.id === upsellId);
  if (!u || !(u.price >= 1) || !(deliveryOf(u) || planDeliveryDefault(c))) return false;
  const p = CB_PREFIX[mode];
  const kb: Kb = { inline_keyboard: [[cbBtn(`Pagar ${brl(u.price)}`, `${p}:up:${u.id}`, c.botoes.upsell)], [{ text: "❌ Não tenho interesse", callback_data: `${p}:upno:${u.id}` }]] };
  const text = renderFlowText(u.msg || `🔥 Oferta especial: <b>{plano}</b> por {valor}`, { "{saudacao}": greeting(), "{plano}": u.name, "{nome_plano}": u.name, "{valor}": brl(u.price) });
  if (u.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, telegramUserId, u.mediaUrl, c.inicio.antiClone, text, kb))) return true;
  await send(ctx, telegramUserId, text, kb, c.inicio.antiClone);
  return true;
}

const planDeliveryDefault = (c: BasicFlowConfig) => deliveryOf(c.vip);

/** Agenda os upsells depois de uma entrega. Padrão: todos; sequencial: só o próximo. */
export async function scheduleUpsells(flow: LoadedFlow, storeId: string, botId: string, telegramUserId: string, afterUpsellId?: string) {
  const items = flow.config.upsell.items.filter((u) => u.price >= 1);
  if (!items.length) return;
  let list = items;
  if (flow.config.upsell.mode === "sequencial") {
    const idx = afterUpsellId ? items.findIndex((u) => u.id === afterUpsellId) : -1;
    if (afterUpsellId && idx < 0) return;
    list = items.slice(idx + 1, idx + 2);
  } else if (afterUpsellId) {
    return; // modo padrão: tudo já foi agendado na compra do plano
  }
  const { scheduleFlowJobs, delayMs, processFlowJobs } = await import("./flow-jobs");
  await scheduleFlowJobs(list.map((u) => ({ storeId, botId, flowId: flow.flowId, telegramUserId, kind: "upsell" as const, ref: u.id, runAt: new Date(Date.now() + delayMs(u.delayUnit, u.delayValue)) })));
  if (list.some((u) => u.delayUnit === "imediato")) await processFlowJobs({ budgetMs: 8000, limit: 5 });
}

/** Mensagem do Disparo para uma pessoa. */
export async function sendBroadcastMessage(
  ctx: FlowCtx,
  flow: LoadedFlow,
  mode: FlowMode,
  telegramUserId: string,
  b: { message: string; mediaUrl: string; button: { type: "none" | "plans" | "link"; text?: string; url?: string }; firstName: string }
): Promise<boolean> {
  const c = flow.config;
  try {
    const { CustomerBlockService } = await import("@/lib/customers/customer-block-service");
    if (await CustomerBlockService.isTelegramUserBlocked(ctx.storeId, telegramUserId)) return false;
  } catch {
    // sem a tabela de bloqueio: segue
  }
  let kb: Kb | undefined;
  if (b.button.type === "plans") kb = { inline_keyboard: planRows(c, CB_PREFIX[mode]) };
  else if (b.button.type === "link" && b.button.url && /^https:\/\//i.test(b.button.url)) kb = { inline_keyboard: [[{ text: b.button.text || "Acessar", url: b.button.url }]] };
  const text = renderFlowText(b.message, { "{nome}": b.firstName, "{saudacao}": greeting() });
  try {
    if (b.mediaUrl && text.length <= CAPTION_MAX) {
      const common = { chat_id: telegramUserId, caption: text || undefined, parse_mode: "HTML", reply_markup: kb, protect_content: c.inicio.antiClone || undefined };
      await telegramFetch(ctx.token, isVideo(b.mediaUrl) ? "sendVideo" : "sendPhoto", { ...common, [isVideo(b.mediaUrl) ? "video" : "photo"]: b.mediaUrl });
      return true;
    }
    if (b.mediaUrl) await telegramFetch(ctx.token, isVideo(b.mediaUrl) ? "sendVideo" : "sendPhoto", { chat_id: telegramUserId, [isVideo(b.mediaUrl) ? "video" : "photo"]: b.mediaUrl });
    await telegramFetch(ctx.token, "sendMessage", { chat_id: telegramUserId, text: text || "👋", parse_mode: "HTML", reply_markup: kb, protect_content: c.inicio.antiClone || undefined, link_preview_options: { is_disabled: true } });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */
export async function runFlowCallback(
  ctx: FlowCtx,
  flow: LoadedFlow,
  mode: FlowMode,
  cb: { id: string; data: string; chatId: number | string; user: TgUser }
): Promise<void> {
  const c = flow.config;
  const p = CB_PREFIX[mode];
  const protect = c.inicio.antiClone;
  const [, action, arg, arg2, arg3] = cb.data.split(":");
  const uid = String(cb.user.id);

  if (action === "plans") {
    await answer(ctx, cb.id);
    const rows = planRows(c, p, arg === "r" ? "r" : undefined);
    if (!rows.length) {
      await send(ctx, cb.chatId, "No momento não há planos disponíveis. Volte em breve! 🙏", undefined, protect);
      return;
    }
    await send(ctx, cb.chatId, "Escolha seu plano 👇", { inline_keyboard: rows }, protect);
    return;
  }

  // buy:<planId>[:<tag>]  tag = "r" (renovação) ou "d<downsellId>"
  if (action === "buy" && arg) {
    const plan = validPlans(c).find((pl) => pl.id === arg);
    const delivery = plan ? planDelivery(plan, c) : null;
    if (!plan || !delivery) {
      await answer(ctx, cb.id, plan ? "Esse plano ainda não tem entrega configurada." : "Esse plano não está mais disponível.", true);
      return;
    }
    const tag = arg2 && /^(r|d[a-z0-9]{1,24})$/.test(arg2) ? arg2 : undefined;
    const bump = bumpFor(c, plan.id);
    if (bump) {
      // Order Bump: pergunta antes de gerar o Pix.
      await answer(ctx, cb.id);
      const kb: Kb = { inline_keyboard: [[cbBtn(bump.yes || "✅ Quero aproveitar!", `${p}:bmp:${plan.id}:1${tag ? ":" + tag : ""}`, c.botoes.aceitar)], [cbBtn(bump.no || "❌ Não, obrigado", `${p}:bmp:${plan.id}:0${tag ? ":" + tag : ""}`, c.botoes.recusar)]] };
      const text = renderFlowText(bump.msg || "🎁 Aproveite e leve também <b>{plano}</b> por apenas {valor}!", { ...baseVars(cb.user), "{plano}": bump.name, "{nome_plano}": bump.name, "{valor}": brl(bump.price) });
      if (bump.audioUrl) await sendMedia(ctx, cb.chatId, bump.audioUrl, protect);
      if (!(bump.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, cb.chatId, bump.mediaUrl, protect, text, kb)))) await send(ctx, cb.chatId, text, kb, protect);
      return;
    }
    await answer(ctx, cb.id, "⏳ Gerando seu Pix...");
    await startPix(ctx, flow, mode, cb, { plan: { ...plan, price: discountedPrice(c, plan, tag) }, delivery, kind: "plan" });
    return;
  }

  // bmp:<planId>:<1|0>[:<tag>]  resposta do Order Bump
  if (action === "bmp" && arg) {
    const plan = validPlans(c).find((pl) => pl.id === arg);
    const delivery = plan ? planDelivery(plan, c) : null;
    if (!plan || !delivery) {
      await answer(ctx, cb.id, "Esse plano não está mais disponível.", true);
      return;
    }
    const tag = arg3 && /^(r|d[a-z0-9]{1,24})$/.test(arg3) ? arg3 : undefined;
    const bump = bumpFor(c, plan.id);
    const yes = arg2 === "1" && bump;
    await answer(ctx, cb.id, "⏳ Gerando seu Pix...");
    const vars = { ...baseVars(cb.user), "{plano}": bump?.name || "", "{nome_plano}": bump?.name || "", "{valor}": brl(bump?.price || 0) };
    if (bump) await sendFollowUp(ctx, cb.chatId, yes ? bump.ifAccept : bump.ifDecline, vars);
    const bd = bump ? deliveryOf(bump) : null;
    await startPix(ctx, flow, mode, cb, {
      plan: { ...plan, price: discountedPrice(c, plan, tag) },
      delivery,
      kind: "plan",
      extras: yes && bump && bd ? [{ id: bump.id, name: bump.name, price: bump.price, deliveryType: bd.type, deliveryValue: bd.value }] : undefined,
    });
    return;
  }

  // up:<upsellId>  /  upb:<upsellId>:<1|0>  /  upno:<upsellId>
  if ((action === "up" || action === "upb") && arg) {
    const u = c.upsell.items.find((x) => x.id === arg);
    const delivery = u ? deliveryOf(u) || planDeliveryDefault(c) : null;
    if (!u || !delivery || !(u.price >= 1)) {
      await answer(ctx, cb.id, "Essa oferta não está mais disponível.", true);
      return;
    }
    const bd = u.bump.on && u.bump.name.trim() && u.bump.price >= 1 ? deliveryOf(u.bump) : null;
    if (action === "up" && bd) {
      await answer(ctx, cb.id);
      const kb: Kb = { inline_keyboard: [[cbBtn(u.bump.yes || "✅ Quero aproveitar!", `${p}:upb:${u.id}:1`, c.botoes.aceitar)], [cbBtn(u.bump.no || "❌ Não, obrigado", `${p}:upb:${u.id}:0`, c.botoes.recusar)]] };
      const text = renderFlowText(u.bump.msg || "🎁 Leve também <b>{plano}</b> por {valor}!", { ...baseVars(cb.user), "{plano}": u.bump.name, "{nome_plano}": u.bump.name, "{valor}": brl(u.bump.price) });
      if (!(u.bump.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, cb.chatId, u.bump.mediaUrl, protect, text, kb)))) await send(ctx, cb.chatId, text, kb, protect);
      return;
    }
    await answer(ctx, cb.id, "⏳ Gerando seu Pix...");
    const plan: FlowPlan = { id: u.id, name: u.name || "Oferta especial", price: u.price, unit: "vitalicio", amount: 1, vipExclusive: true, deliveryType: delivery.type, groupId: delivery.type === "group" ? delivery.value : "", link: delivery.type === "link" ? delivery.value : "", color: "none" };
    const withBump = action === "upb" && arg2 === "1" && bd;
    await startPix(ctx, flow, mode, cb, {
      plan,
      delivery,
      kind: "upsell",
      extras: withBump && bd ? [{ id: `${u.id}-bump`, name: u.bump.name, price: u.bump.price, deliveryType: bd.type, deliveryValue: bd.value }] : undefined,
    });
    return;
  }

  if (action === "upno" && arg) {
    await answer(ctx, cb.id, "Tudo bem! 👍");
    await scheduleUpsells(flow, ctx.storeId, ctx.botDbId, uid, arg);
    return;
  }

  // mimo  /  mimov:<index>
  if (action === "mimo") {
    await answer(ctx, cb.id);
    if (!mimoOn(c)) return;
    const rows = c.mimos.values
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.value >= 1)
      .map(({ v, i }) => [cbBtn(`${v.label || "Mimo"} - ${brl(v.value)}`, `${p}:mimov:${i}`, c.botoes.mimoFixo)]);
    const text = renderFlowText(c.mimos.msg || "🎁 Quer mandar um mimo? Escolha o valor 👇", baseVars(cb.user));
    if (c.mimos.audioUrl) await sendMedia(ctx, cb.chatId, c.mimos.audioUrl, protect);
    if (!(c.mimos.mediaUrl && text.length <= CAPTION_MAX && (await sendMedia(ctx, cb.chatId, c.mimos.mediaUrl, protect, text, { inline_keyboard: rows })))) await send(ctx, cb.chatId, text, { inline_keyboard: rows }, protect);
    return;
  }

  if (action === "mimov" && arg && /^\d{1,2}$/.test(arg)) {
    const v = c.mimos.values[Number(arg)];
    if (!mimoOn(c) || !v || !(v.value >= 1)) {
      await answer(ctx, cb.id, "Esse valor não está mais disponível.", true);
      return;
    }
    await answer(ctx, cb.id, "⏳ Gerando seu Pix...");
    const plan: FlowPlan = { id: `mimo-${arg}`, name: `Mimo${v.label ? " " + v.label : ""}`, price: v.value, unit: "vitalicio", amount: 1, vipExclusive: true, deliveryType: "link", groupId: "", link: "", color: "none" };
    await startPix(ctx, flow, mode, cb, { plan, delivery: { type: "none", value: "" }, kind: "mimo" });
    return;
  }

  if ((action === "chk" || action === "qr") && arg && /^[0-9a-f-]{36}$/i.test(arg)) {
    const order = await db.query.orders.findFirst({ where: and(eq(orders.id, arg), eq(orders.storeId, ctx.storeId)), columns: { id: true, status: true } });
    if (!order) {
      await answer(ctx, cb.id, "Pedido não encontrado.", true);
      return;
    }
    if (action === "qr") {
      await answer(ctx, cb.id);
      try {
        await sendPhoto(ctx, cb.chatId, `${appBaseUrl()}/api/telegram/order-qr/${order.id}`, false, "Aponte a câmera do app do seu banco para o QR Code.");
      } catch {
        await send(ctx, cb.chatId, "Não consegui gerar o QR Code agora. Use o código copia e cola acima.", undefined, false);
      }
      return;
    }
    let status = order.status;
    if (status !== "paid") {
      try {
        const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
        const r = await syncOrderWithMercadoPago(order.id);
        status = r?.status || status;
      } catch (err) {
        console.warn("[flow-runtime] Falha ao consultar pagamento:", (err as Error)?.message);
      }
    }
    if (status === "paid") {
      await answer(ctx, cb.id, "🎉 Pagamento confirmado!");
      const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");
      await AccessDeliveryService.processOrderDelivery(order.id);
    } else {
      await answer(ctx, cb.id, "⏳ Pagamento ainda não identificado. Aguarde alguns instantes e tente de novo.", true);
    }
    return;
  }

  await answer(ctx, cb.id);
}
