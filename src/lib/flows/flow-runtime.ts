/**
 * Motor do Fluxo Básico no Telegram (Fase 1).
 *
 * Só é acionado para um bot ligado a um fluxo BÁSICO PUBLICADO, ou no modo de
 * teste (link "Testar no Telegram", que roda o rascunho só para quem abre o link).
 * Qualquer erro ao carregar o fluxo devolve null e o webhook segue o
 * comportamento antigo do bot (fail-open).
 *
 * Ativo nesta fase: Início (áudio, mídias, mensagens, redirecionamentos, anti-clone),
 * Planos do próprio fluxo (cada plano tem um produto oculto por trás), PIX (mensagem,
 * mídia, áudio, formato do código, QR, verificar pagamento), Acesso VIP (mensagem de
 * entrega) e Suporte. As outras seções ficam salvas e entram nas próximas etapas.
 */
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, salesFlowBots, salesFlows } from "@/db/schema";
import { telegramFetch } from "@/lib/telegram/client";
import { normalizeBasicConfig, planPeriodLabel, type BasicFlowConfig, type FlowPlan } from "./basic-config";

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

/** Envia uma mídia solta (foto, vídeo ou áudio) sem derrubar o fluxo se falhar. */
async function sendMedia(ctx: FlowCtx, chatId: number | string, url: string, protect: boolean, caption?: string, kb?: Kb) {
  if (!url) return;
  try {
    const common = { chat_id: chatId, caption, parse_mode: caption ? "HTML" : undefined, reply_markup: kb, protect_content: protect || undefined };
    if (/\.(ogg|oga|opus|mp3|m4a)(\?|$)/i.test(url)) {
      await telegramFetch(ctx.token, isVoice(url) ? "sendVoice" : "sendAudio", { ...common, [isVoice(url) ? "voice" : "audio"]: url });
    } else if (isVideo(url)) {
      await telegramFetch(ctx.token, "sendVideo", { ...common, video: url });
    } else {
      await telegramFetch(ctx.token, "sendPhoto", { ...common, photo: url });
    }
  } catch (err) {
    console.warn("[flow-runtime] Falha ao enviar mídia:", (err as Error)?.message);
  }
}

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

  // Mídias (foto ou vídeo)
  const media = c.inicio.media;
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
    for (const url of media) await sendMedia(ctx, chatId, url, protect);
  }

  const rows: Kb["inline_keyboard"] = [[{ text: c.inicio.btn || "🔥 Ver Planos", callback_data: `${p}:plans` }]];
  for (const r of c.inicio.redirects) if (r.text.trim() && /^https:\/\//i.test(r.url)) rows.push([{ text: r.text.trim(), url: r.url }]);
  await send(ctx, chatId, renderFlowText(c.inicio.msg || "Olá, {nome}! 👋", vars), { inline_keyboard: rows }, protect);
  if (c.inicio.msg2.trim()) await send(ctx, chatId, renderFlowText(c.inicio.msg2, vars), undefined, protect);
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
/* Botões do fluxo                                                     */
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
  const [, action, arg] = cb.data.split(":");

  if (action === "plans") {
    await answer(ctx, cb.id);
    const plans = validPlans(c);
    if (!plans.length) {
      await send(ctx, cb.chatId, "No momento não há planos disponíveis. Volte em breve! 🙏", undefined, protect);
      return;
    }
    await send(
      ctx,
      cb.chatId,
      "Escolha seu plano 👇",
      { inline_keyboard: plans.map((pl) => [{ text: `${pl.name} - ${brl(pl.price)}`, callback_data: `${p}:buy:${pl.id}` }]) },
      protect
    );
    return;
  }

  if (action === "buy" && arg) {
    const plan = validPlans(c).find((pl) => pl.id === arg);
    const { flowPlanProductId } = await import("./flow-service");
    const productId = plan ? await flowPlanProductId(ctx.storeId, flow.flowId, plan.id) : null;
    if (!plan || !productId) {
      await answer(ctx, cb.id, mode === "test" ? "Plano ainda não sincronizado. Gere o link de teste de novo." : "Esse plano não está mais disponível.", true);
      return;
    }
    await answer(ctx, cb.id, "⏳ Gerando seu Pix...");
    const { CartService } = await import("@/lib/cart/cart-service");
    const { CheckoutService } = await import("@/lib/orders/checkout-service");
    const customer = await CartService.getOrCreateCustomerForTelegramUser(ctx.storeId, {
      id: cb.user.id,
      first_name: cb.user.first_name,
      last_name: cb.user.last_name,
      username: cb.user.username,
    });
    const res = await CheckoutService.createCheckout({
      storeId: ctx.storeId,
      customerId: customer.id,
      storeSlug: ctx.storeSlug,
      items: [{ id: productId, quantity: 1 }],
      originBotId: ctx.botDbId,
    });
    if (!res.success || !res.orderId) {
      await send(ctx, cb.chatId, `⚠️ ${escapeHtml(res.error || "Não foi possível gerar o Pix agora. Tente de novo em instantes.")}`, undefined, false);
      return;
    }

    const orderId = res.orderId;
    const code = res.pix?.qrCode || "";
    const hasQr = Boolean(res.pix?.qrCodeBase64);
    const vars = { ...baseVars(cb.user), ...planVars(plan, res.total ?? undefined) };
    const kb: Kb = { inline_keyboard: [[{ text: c.pix.verifyBtn || "🔍 VERIFICAR PAGAMENTO", callback_data: `${p}:chk:${orderId}` }]] };
    if (c.pix.qrOn && c.pix.qrMode === "botao" && hasQr) kb.inline_keyboard.push([{ text: c.pix.qrBtn || "📱 Mostrar QR Code", callback_data: `${p}:qr:${orderId}` }]);

    if (c.pix.audioUrl) await sendMedia(ctx, cb.chatId, c.pix.audioUrl, false);
    if (c.pix.mediaUrl) await sendMedia(ctx, cb.chatId, c.pix.mediaUrl, false);
    if (c.pix.qrOn && c.pix.qrMode === "direto" && hasQr) await sendMedia(ctx, cb.chatId, `${appBaseUrl()}/api/telegram/order-qr/${orderId}`, false);

    const template = c.pix.msg || "💳 Pague agora e garanta acesso ao <b>{nome_plano}</b>!\n\nValor: <b>R$ {valor_final}</b>\nDuração: {duracao}\n\nCopie o código Pix abaixo:";
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

/* ------------------------------------------------------------------ */
/* Mensagem de entrega (chamada pela entrega de acesso)                */
/* ------------------------------------------------------------------ */

/**
 * Se o bot que entrega tem fluxo básico publicado com mensagem de entrega,
 * envia essa mensagem no lugar da padrão. Devolve false para usar a padrão.
 */
export async function sendFlowDeliveryMessage(input: {
  botDbId?: string | null;
  botToken: string;
  chatId: string;
  customerName?: string | null;
  productTitle: string;
  price?: number | string | null;
  accessUrl: string;
  isWebApp: boolean;
  alreadyMember: boolean;
}): Promise<boolean> {
  if (!input.botDbId) return false;
  const flow = await getBasicFlowForBot(input.botDbId);
  if (!flow || !flow.config.vip.msg.trim()) return false;
  const c = flow.config;
  const vars = {
    "{nome}": input.customerName || "",
    "{saudacao}": greeting(),
    "{plano}": input.productTitle,
    "{nome_plano}": input.productTitle,
    "{valor}": input.price != null ? brl(Number(input.price)) : "",
    "{valor_final}": input.price != null ? Number(input.price).toFixed(2).replace(".", ",") : "",
    "{link_vip}": input.isWebApp ? "" : input.accessUrl,
  };
  const label = input.alreadyMember ? "🔓 Abrir conteúdo" : "🔓 Acessar agora";
  const button = input.isWebApp ? { text: label, web_app: { url: input.accessUrl } } : { text: label, url: input.accessUrl };
  if (c.vip.mediaUrl) await sendMedia({ token: input.botToken, storeId: "", storeSlug: "", botDbId: input.botDbId }, input.chatId, c.vip.mediaUrl, c.inicio.antiClone);
  await telegramFetch(input.botToken, "sendMessage", {
    chat_id: input.chatId,
    text: renderFlowText(c.vip.msg, vars) || "✅ Pagamento confirmado!",
    parse_mode: "HTML",
    reply_markup: input.accessUrl ? { inline_keyboard: [[button]] } : undefined,
    protect_content: c.inicio.antiClone || undefined,
    link_preview_options: { is_disabled: true },
  });
  return true;
}
