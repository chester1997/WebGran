/**
 * Motor do Fluxo Avançado (blocos ligados) no Telegram.
 *
 * Só é acionado para um bot ligado a um fluxo AVANÇADO publicado, ou no modo de teste
 * (link "Testar no Telegram", que roda o rascunho só para quem abre o link). Qualquer erro ao
 * carregar devolve null e o webhook segue o comportamento antigo do bot (fail-open).
 *
 * Reaproveita as peças do Fluxo Básico, sem tabela nova:
 *  - Pix: createPlanCheckout (pedido em "orders" + compra em "flow_purchases", kind "adv");
 *  - entrega: o convite de uso único do flow-delivery (grupo/canal por ID ou link);
 *  - tarefas com hora marcada: a fila flow_jobs (kinds "adv_*");
 *  - estado da conversa (respostas, oferta aceita, último plano): uma linha "adv_state" na
 *    mesma fila, com data no futuro distante (nunca é processada como tarefa).
 *
 * Botões: "al:" (publicado) e "at:" (teste).
 *   al:g:<bloco>:<saída>   escolha num bloco de botões / Order Bump
 *   al:pay:<bloco>         pagar Upsell / Oferta com desconto
 *   al:no:<bloco>          recusar Upsell / Oferta com desconto
 *   al:chk:<pedido>        verificar pagamento
 *   al:qr:<pedido>         mostrar QR Code
 */
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { flowJobs, flowPurchases, orders, products, salesFlowBots, salesFlows, telegramBotChats, telegramCustomers } from "@/db/schema";
import { telegramFetch } from "@/lib/telegram/client";
import { nodeOutputs, normalizeGraph, graphOrder, type FlowGraph, type FlowNode } from "./advanced-graph";
import { brl, greeting, pixCodeHtml, renderFlowText, type FlowCtx, type FlowMode } from "./flow-runtime";
import type { PeriodUnit } from "./basic-config";

export const ADV_PREFIX: Record<FlowMode, string> = { live: "al", test: "at" };

export interface LoadedAdvancedFlow {
  flowId: string;
  status: "draft" | "published";
  graph: FlowGraph;
}

type TgUser = { id: number | string; first_name?: string; last_name?: string; username?: string };
type Kb = { inline_keyboard: Array<Array<Record<string, unknown>>> };

interface AdvState {
  vars: Record<string, string>;
  /** Order Bump aceito: entra somado no próximo Pix. */
  addOn: { name: string; price: number } | null;
  lastProductId: string;
  fromCampaign: boolean;
}

const blankState = (): AdvState => ({ vars: {}, addOn: null, lastProductId: "", fromCampaign: false });
const FAR_FUTURE = new Date("2099-01-01T00:00:00Z");
const MAX_STEPS = 60;
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------------------------------------------ */
/* Carregamento                                                        */
/* ------------------------------------------------------------------ */
/** Fluxo avançado ligado ao bot. `includeDraft` só no modo de teste. Nunca lança erro. */
export async function getAdvancedFlowForBot(botDbId: string, opts: { includeDraft?: boolean } = {}): Promise<LoadedAdvancedFlow | null> {
  if (!botDbId) return null;
  try {
    const rows = await db
      .select({ id: salesFlows.id, status: salesFlows.status, type: salesFlows.type, config: salesFlows.config })
      .from(salesFlowBots)
      .innerJoin(salesFlows, eq(salesFlows.id, salesFlowBots.flowId))
      .where(eq(salesFlowBots.botId, botDbId))
      .limit(1);
    const f = rows[0];
    if (!f || f.type !== "advanced") return null;
    if (f.status !== "published" && !opts.includeDraft) return null;
    return { flowId: f.id, status: f.status === "published" ? "published" : "draft", graph: normalizeGraph(f.config) };
  } catch (err) {
    console.warn("[advanced-runtime] Fluxo indisponível, usando o bot padrão:", (err as Error)?.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Estado da conversa                                                  */
/* ------------------------------------------------------------------ */
async function loadState(botId: string, uid: string, flowId: string): Promise<AdvState> {
  try {
    const row = await db.query.flowJobs.findFirst({
      where: and(eq(flowJobs.botId, botId), eq(flowJobs.telegramUserId, uid), eq(flowJobs.kind, "adv_state"), eq(flowJobs.ref, flowId), eq(flowJobs.status, "pending")),
      columns: { payload: true },
    });
    const p = (row?.payload || {}) as Partial<AdvState>;
    return { ...blankState(), ...p, vars: { ...(p.vars || {}) } };
  } catch {
    return blankState();
  }
}

async function saveState(storeId: string, botId: string, uid: string, flowId: string, state: AdvState) {
  try {
    const updated = await db
      .update(flowJobs)
      .set({ payload: state as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(and(eq(flowJobs.botId, botId), eq(flowJobs.telegramUserId, uid), eq(flowJobs.kind, "adv_state"), eq(flowJobs.ref, flowId), eq(flowJobs.status, "pending")))
      .returning({ id: flowJobs.id });
    if (!updated.length) {
      await db
        .insert(flowJobs)
        .values({ storeId, botId, flowId, telegramUserId: uid, kind: "adv_state", ref: flowId, runAt: FAR_FUTURE, payload: state as unknown as Record<string, unknown> })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.warn("[advanced-runtime] Estado não salvo:", (err as Error)?.message);
  }
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */
async function send(ctx: FlowCtx, chatId: string, html: string, kb?: Kb) {
  if (!html.trim() && !kb) return;
  return telegramFetch(ctx.token, "sendMessage", { chat_id: chatId, text: html.trim() || "👇", parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
}

async function sendMedia(ctx: FlowCtx, chatId: string, url: string, caption?: string, kb?: Kb): Promise<boolean> {
  if (!/^https:\/\//i.test(url || "")) return false;
  try {
    const common = { chat_id: chatId, caption: caption || undefined, parse_mode: caption ? "HTML" : undefined, reply_markup: kb };
    if (/\.(ogg|oga|opus)(\?|$)/i.test(url)) await telegramFetch(ctx.token, "sendVoice", { ...common, voice: url });
    else if (/\.(mp3|m4a)(\?|$)/i.test(url)) await telegramFetch(ctx.token, "sendAudio", { ...common, audio: url });
    else if (/\.(mp4|mov)(\?|$)/i.test(url)) await telegramFetch(ctx.token, "sendVideo", { ...common, video: url });
    else await telegramFetch(ctx.token, "sendPhoto", { ...common, photo: url });
    return true;
  } catch (err) {
    console.warn("[advanced-runtime] Mídia não enviada:", (err as Error)?.message);
    return false;
  }
}

async function answer(ctx: FlowCtx, cbId: string, text?: string, alert = false) {
  try {
    await telegramFetch(ctx.token, "answerCallbackQuery", { callback_query_id: cbId, text, show_alert: alert || undefined });
  } catch {
    // não bloqueia
  }
}

/** Tira os botões da mensagem já respondida (evita clique duplo). Não bloqueia. */
async function clearButtons(ctx: FlowCtx, chatId: string, messageId?: number) {
  if (!messageId) return;
  try {
    await telegramFetch(ctx.token, "editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  } catch {
    // mensagem antiga ou já editada
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function appBaseUrl() {
  let raw = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
  if (!raw.startsWith("http")) raw = `https://${raw}`;
  if (raw.includes("webgran.online") && !raw.includes("www.webgran.online")) raw = raw.replace("webgran.online", "www.webgran.online");
  return raw.replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* Execução                                                            */
/* ------------------------------------------------------------------ */
interface Run {
  ctx: FlowCtx;
  flow: LoadedAdvancedFlow;
  mode: FlowMode;
  uid: string;
  user: TgUser;
  state: AdvState;
}

const nodeById = (g: FlowGraph, id: string | undefined) => (id ? g.nodes.find((n) => n.id === id) : undefined);
const nextOf = (g: FlowGraph, node: FlowNode, out: string) => g.edges.find((e) => e.from === node.id && e.out === out)?.to;
const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => Number(v) || 0;

function textVars(r: Run): Record<string, string> {
  const out: Record<string, string> = { "{nome}": r.user.first_name || "", "{saudacao}": greeting() };
  for (const [k, v] of Object.entries(r.state.vars)) if (/^[a-z0-9_]{1,30}$/i.test(k)) out[`{${k}}`] = v;
  return out;
}
const render = (r: Run, t: unknown) => renderFlowText(str(t), textVars(r));
const cb = (r: Run, ...parts: string[]) => [ADV_PREFIX[r.mode], ...parts].join(":");

const UNIT_MS: Record<string, number> = { minutos: 60_000, horas: 3_600_000, dias: 86_400_000 };

/** Duração do produto do Mini App → período da compra. */
function productPeriod(duration: string | null | undefined): { unit: PeriodUnit; amount: number } {
  switch (String(duration || "").toLowerCase()) {
    case "daily": return { unit: "dias", amount: 1 };
    case "weekly": return { unit: "semanas", amount: 1 };
    case "monthly": return { unit: "meses", amount: 1 };
    case "quarterly": return { unit: "meses", amount: 3 };
    case "semiannual": return { unit: "meses", amount: 6 };
    case "annual": return { unit: "anos", amount: 1 };
    default: return { unit: "vitalicio", amount: 1 };
  }
}

async function scheduleJob(r: Run, kind: string, ref: string, runAt: Date, payload: Record<string, unknown>) {
  try {
    await db
      .insert(flowJobs)
      .values({ storeId: r.ctx.storeId, botId: r.ctx.botDbId, flowId: r.flow.flowId, telegramUserId: r.uid, kind, ref, runAt, payload: { ...payload, mode: r.mode } })
      .onConflictDoNothing();
  } catch (err) {
    console.warn("[advanced-runtime] Tarefa não agendada:", (err as Error)?.message);
  }
}

async function cancelJobs(botId: string, uid: string, kinds: string[]) {
  try {
    await db
      .update(flowJobs)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(flowJobs.botId, botId), eq(flowJobs.telegramUserId, uid), eq(flowJobs.status, "pending"), inArray(flowJobs.kind, kinds)));
  } catch {
    // sem a fila: nada a cancelar
  }
}

/** Condições do bloco "Condição". */
async function checkRule(r: Run, rule: string): Promise<boolean> {
  try {
    if (/campanha/i.test(rule)) return r.state.fromCampaign;
    const base = and(eq(flowPurchases.botId, r.ctx.botDbId), eq(telegramCustomers.telegramUserId, r.uid));
    if (/gerou pix/i.test(rule)) {
      const rows = await db
        .select({ id: flowPurchases.id })
        .from(flowPurchases)
        .innerJoin(orders, eq(orders.id, flowPurchases.orderId))
        .innerJoin(telegramCustomers, eq(telegramCustomers.id, flowPurchases.customerId))
        .where(and(base, eq(orders.status, "pending")))
        .limit(1);
      return rows.length > 0;
    }
    if (/acesso ativo/i.test(rule)) {
      const rows = await db
        .select({ expiresAt: flowPurchases.expiresAt })
        .from(flowPurchases)
        .innerJoin(telegramCustomers, eq(telegramCustomers.id, flowPurchases.customerId))
        .where(and(base, eq(flowPurchases.status, "ACTIVE")))
        .limit(20);
      return rows.some((x) => !x.expiresAt || x.expiresAt > new Date());
    }
    // "Já comprou algum plano"
    const rows = await db
      .select({ id: flowPurchases.id })
      .from(flowPurchases)
      .innerJoin(orders, eq(orders.id, flowPurchases.orderId))
      .innerJoin(telegramCustomers, eq(telegramCustomers.id, flowPurchases.customerId))
      .where(and(base, eq(orders.status, "paid")))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Bloco "Ir para": aceita o número do bloco (como no editor) ou o nome dele. */
function jumpTarget(g: FlowGraph, target: string): string | undefined {
  const t = target.trim().replace(/^#/, "");
  if (!t) return undefined;
  if (/^\d{1,4}$/.test(t)) {
    const order = graphOrder(g);
    for (const [id, n] of order) if (n === Number(t)) return id;
    return undefined;
  }
  const low = t.toLowerCase();
  return g.nodes.find((n) => n.id === t)?.id || g.nodes.find((n) => n.type !== "inicio" && str(n.data.text).toLowerCase().startsWith(low))?.id;
}

/** Roda o fluxo a partir de um bloco até um ponto de espera (botão, pergunta, Pix, espera). */
async function walk(r: Run, startId: string | undefined) {
  const g = r.flow.graph;
  let id = startId;
  for (let step = 0; id && step < MAX_STEPS; step++) {
    const node = nodeById(g, id);
    if (!node) break;
    const d = node.data;
    switch (node.type) {
      case "inicio":
        id = nextOf(g, node, "out");
        break;

      case "texto":
        await send(r.ctx, r.uid, render(r, d.text));
        id = nextOf(g, node, "out");
        break;

      case "midia": {
        const caption = render(r, d.caption);
        const sent = await sendMedia(r.ctx, r.uid, str(d.url), caption.length <= 1024 ? caption : undefined);
        if ((!sent || caption.length > 1024) && caption) await send(r.ctx, r.uid, caption);
        id = nextOf(g, node, "out");
        break;
      }

      case "audio":
        await sendMedia(r.ctx, r.uid, str(d.url));
        id = nextOf(g, node, "out");
        break;

      case "digitando": {
        try {
          await telegramFetch(r.ctx.token, "sendChatAction", { chat_id: r.uid, action: "typing" });
        } catch {
          // não bloqueia
        }
        await sleep(Math.min(8, Math.max(1, num(d.sec))) * 1000);
        id = nextOf(g, node, "out");
        break;
      }

      case "botoes": {
        const outs = nodeOutputs(node);
        const kb: Kb = { inline_keyboard: outs.map(([k, label]) => [{ text: label.slice(0, 64), callback_data: cb(r, "g", node.id, k) }]) };
        await send(r.ctx, r.uid, render(r, d.text) || "Escolha uma opção 👇", outs.length ? kb : undefined);
        return; // espera o clique
      }

      case "pergunta": {
        await send(r.ctx, r.uid, render(r, d.text));
        await cancelJobs(r.ctx.botDbId, r.uid, ["adv_wait"]);
        const wait = Math.max(1, num(d.wait)) * 60_000;
        await scheduleJob(r, "adv_wait", "q", new Date(Date.now() + wait), { nodeId: node.id, var: str(d.var).replace(/[^a-z0-9_]/gi, "").slice(0, 30) });
        return; // espera a resposta
      }

      case "espera": {
        const next = nextOf(g, node, "out");
        if (!next) return;
        const ms = Math.max(0, num(d.n)) * (UNIT_MS[str(d.u)] || 60_000);
        await scheduleJob(r, "adv_step", `${node.id}:${Date.now()}`, new Date(Date.now() + Math.max(ms, 30_000)), { nodeId: next });
        return;
      }

      case "condicao":
        id = nextOf(g, node, (await checkRule(r, str(d.rule))) ? "sim" : "nao");
        break;

      case "ab":
        id = nextOf(g, node, Math.random() * 100 < Math.max(0, Math.min(100, num(d.pct))) ? "a" : "b");
        break;

      case "salto":
        id = jumpTarget(g, str(d.target));
        break;

      case "pix": {
        const product = d.productId
          ? await db.query.products.findFirst({ where: and(eq(products.id, str(d.productId)), eq(products.storeId, r.ctx.storeId)), columns: { id: true, title: true, price: true, duration: true } })
          : null;
        if (!product) {
          await send(r.ctx, r.uid, "⚠️ Este plano não está disponível no momento.");
          return;
        }
        r.state.lastProductId = product.id;
        const add = r.state.addOn;
        r.state.addOn = null;
        const price = Number(product.price) + (add?.price || 0);
        await startPix(r, node, { name: add ? `${product.title} + ${add.name}` : product.title, price, ...productPeriod(product.duration) }, Math.max(1, num(d.wait)), str(d.qr));
        return; // espera o pagamento
      }

      case "bump": {
        const kb: Kb = { inline_keyboard: [[{ text: "✅ Quero aproveitar!", callback_data: cb(r, "g", node.id, "sim") }], [{ text: "❌ Não, obrigado", callback_data: cb(r, "g", node.id, "nao") }]] };
        const vars = { ...textVars(r), "{plano}": str(d.name), "{nome_plano}": str(d.name), "{valor}": brl(num(d.price)) };
        await send(r.ctx, r.uid, renderFlowText(str(d.text) || "Leve também <b>{plano}</b> por {valor}?", vars), kb);
        return;
      }

      case "upsell":
      case "downsell": {
        const offer = await offerFor(r, node);
        if (!offer) {
          id = nextOf(g, node, "nao");
          break;
        }
        const kb: Kb = { inline_keyboard: [[{ text: `Pagar ${brl(offer.price)}`, callback_data: cb(r, "pay", node.id) }], [{ text: "❌ Não tenho interesse", callback_data: cb(r, "no", node.id) }]] };
        const vars = { ...textVars(r), "{plano}": offer.name, "{nome_plano}": offer.name, "{valor}": brl(offer.price) };
        await send(r.ctx, r.uid, renderFlowText(str(d.text) || "Oferta especial: <b>{plano}</b> por {valor}", vars), kb);
        return;
      }

      case "entrega":
        await deliverAccess(r, node);
        id = nextOf(g, node, "out");
        break;

      default:
        return; // nota e blocos sem saída
    }
  }
}

/** Preço e nome da oferta de Upsell / Oferta com desconto. */
async function offerFor(r: Run, node: FlowNode): Promise<{ name: string; price: number; unit: PeriodUnit; amount: number } | null> {
  const d = node.data;
  if (node.type === "upsell") {
    const price = Math.round(num(d.price) * 100) / 100;
    return price >= 1 ? { name: str(d.name) || "Oferta especial", price, unit: "vitalicio", amount: 1 } : null;
  }
  // Oferta com desconto: sobre o último plano escolhido (ou o primeiro ativo da loja).
  const base = r.state.lastProductId
    ? await db.query.products.findFirst({ where: and(eq(products.id, r.state.lastProductId), eq(products.storeId, r.ctx.storeId)), columns: { id: true, title: true, price: true, duration: true } })
    : await db.query.products.findFirst({ where: and(eq(products.storeId, r.ctx.storeId), eq(products.status, "active")), columns: { id: true, title: true, price: true, duration: true } });
  if (!base) return null;
  const pct = Math.max(0, Math.min(90, num(d.desc)));
  const price = Math.max(1, Math.round(Number(base.price) * (1 - pct / 100) * 100) / 100);
  return { name: base.title, price, ...productPeriod(base.duration) };
}

/** Gera o Pix e espera: pago → saída de sucesso; tempo esgotado → "Não pagou". */
async function startPix(r: Run, node: FlowNode, item: { name: string; price: number; unit: PeriodUnit; amount: number }, waitMin: number, qrMode: string) {
  const { CartService } = await import("@/lib/cart/cart-service");
  const { createPlanCheckout } = await import("./flow-checkout");
  const customer = await CartService.getOrCreateCustomerForTelegramUser(r.ctx.storeId, { id: r.user.id, first_name: r.user.first_name, last_name: r.user.last_name, username: r.user.username });
  const res = await createPlanCheckout({
    storeId: r.ctx.storeId,
    customerId: customer.id,
    botDbId: r.ctx.botDbId,
    flowId: r.flow.flowId,
    plan: { id: `adv:${node.id}`, name: item.name.slice(0, 120), price: Math.round(item.price * 100) / 100, unit: item.unit, amount: item.amount, vipExclusive: true, deliveryType: "link", groupId: "", link: "", color: "none" },
    delivery: { type: "none", value: "" },
    kind: "adv",
  });
  if (!res.success || !res.orderId) {
    await send(r.ctx, r.uid, `⚠️ ${escapeHtml(res.error || "Não foi possível gerar o Pix agora. Tente de novo em instantes.")}`);
    return;
  }
  const orderId = res.orderId;
  const code = res.pix?.qrCode || "";
  const hasQr = Boolean(res.pix?.qrCodeBase64);
  const kb: Kb = { inline_keyboard: [[{ text: "🔍 VERIFICAR PAGAMENTO", callback_data: cb(r, "chk", orderId) }]] };
  if (qrMode === "Por botão" && hasQr) kb.inline_keyboard.push([{ text: "📱 Mostrar QR Code", callback_data: cb(r, "qr", orderId) }]);
  if (qrMode === "Junto do Pix" && hasQr) await sendMedia(r.ctx, r.uid, `${appBaseUrl()}/api/telegram/order-qr/${orderId}`);

  const total = res.total ?? item.price;
  const head = renderFlowText(`💳 Pague agora e garanta <b>{plano}</b>!\n\nValor: <b>{valor}</b>\n\nCopie o código Pix abaixo:`, { ...textVars(r), "{plano}": item.name, "{valor}": brl(total) });
  await send(r.ctx, r.uid, code ? `${head}\n\n${pixCodeHtml(code, "caixa")}` : head, kb);
  await scheduleJob(r, "adv_pix", orderId, new Date(Date.now() + waitMin * 60_000), { nodeId: node.id, orderId });
}

/** Libera o acesso comprado no grupo/canal do bloco "Liberar acesso". */
async function deliverAccess(r: Run, node: FlowNode) {
  try {
    const chat = await db.query.telegramBotChats.findFirst({ where: and(eq(telegramBotChats.id, str(node.data.chatId)), eq(telegramBotChats.storeId, r.ctx.storeId)) });
    if (!chat) {
      console.warn(`[advanced-runtime] Bloco Liberar acesso sem grupo válido (fluxo ${r.flow.flowId}).`);
      return;
    }
    // Última compra paga deste cliente neste fluxo.
    const rows = await db
      .select({ p: flowPurchases })
      .from(flowPurchases)
      .innerJoin(orders, eq(orders.id, flowPurchases.orderId))
      .innerJoin(telegramCustomers, eq(telegramCustomers.id, flowPurchases.customerId))
      .where(and(eq(flowPurchases.botId, r.ctx.botDbId), eq(flowPurchases.flowId, r.flow.flowId), eq(telegramCustomers.telegramUserId, r.uid), eq(orders.status, "paid"), eq(flowPurchases.kind, "adv")))
      .orderBy(desc(orders.paidAt))
      .limit(1);
    const purchase = rows[0]?.p;
    if (!purchase) {
      if (r.mode === "test") await send(r.ctx, r.uid, "🧪 <i>Liberar acesso:</i> só libera depois de um pagamento confirmado neste fluxo.");
      return;
    }
    const { grantFlowAccess } = await import("./flow-delivery");
    const link = await grantFlowAccess(purchase, r.uid, "group", chat.telegramChatId, purchase.planName, purchase.orderId, purchase.expiresAt ?? null);
    if (!link) return;
    await db
      .update(flowPurchases)
      .set({ deliveryType: "group", deliveryValue: chat.telegramChatId, inviteLink: link, updatedAt: new Date() })
      .where(eq(flowPurchases.id, purchase.id));
    await send(r.ctx, r.uid, renderFlowText("✅ <b>Acesso liberado!</b>\n\nToque no botão abaixo para entrar 👇", textVars(r)), { inline_keyboard: [[{ text: "🔓 Acessar agora", url: link }]] });
  } catch (err) {
    console.error("[advanced-runtime] Falha ao liberar acesso:", (err as Error)?.message);
    await send(r.ctx, r.uid, "⚠️ Seu pagamento foi confirmado, mas não consegui liberar o acesso agora. O vendedor já foi avisado.").catch(() => undefined);
  }
}

async function withRun(ctx: FlowCtx, flow: LoadedAdvancedFlow, mode: FlowMode, user: TgUser, fn: (r: Run) => Promise<void>) {
  const uid = String(user.id);
  const r: Run = { ctx, flow, mode, uid, user, state: await loadState(ctx.botDbId, uid, flow.flowId) };
  try {
    await fn(r);
  } finally {
    await saveState(ctx.storeId, ctx.botDbId, uid, flow.flowId, r.state);
  }
}

/* ------------------------------------------------------------------ */
/* Entradas (webhook, fila, pagamento)                                 */
/* ------------------------------------------------------------------ */
export async function runAdvancedStart(ctx: FlowCtx, flow: LoadedAdvancedFlow, mode: FlowMode, chatId: number | string, user: TgUser, startParam = "") {
  const u = { ...user, id: user.id ?? chatId };
  // Novo /start: zera o que estava pendente desta pessoa (pergunta, espera, Pix aguardando).
  await cancelJobs(ctx.botDbId, String(u.id), ["adv_wait", "adv_step", "adv_pix"]);
  await withRun(ctx, flow, mode, u, async (r) => {
    r.state = { ...blankState(), fromCampaign: mode === "live" && !!startParam.trim() };
    if (mode === "test") await send(ctx, r.uid, "🧪 <b>Modo de teste</b> do fluxo avançado (rascunho). Os clientes ainda não veem isso.");
    const start = r.flow.graph.nodes.find((n) => n.type === "inicio");
    if (start) await walk(r, nextOf(r.flow.graph, start, "out"));
  });
}

export async function runAdvancedCallback(
  ctx: FlowCtx,
  flow: LoadedAdvancedFlow,
  mode: FlowMode,
  q: { id: string; data: string; chatId: number | string; user: TgUser; messageId?: number }
): Promise<void> {
  const [, action, a1, a2] = q.data.split(":");
  const g = flow.graph;
  const chat = String(q.chatId);

  if ((action === "chk" || action === "qr") && a1 && /^[0-9a-f-]{36}$/i.test(a1)) {
    const order = await db.query.orders.findFirst({ where: and(eq(orders.id, a1), eq(orders.storeId, ctx.storeId)), columns: { id: true, status: true } });
    if (!order) return answer(ctx, q.id, "Pedido não encontrado.", true);
    if (action === "qr") {
      await answer(ctx, q.id);
      if (!(await sendMedia(ctx, chat, `${appBaseUrl()}/api/telegram/order-qr/${order.id}`, "Aponte a câmera do app do seu banco para o QR Code."))) {
        await send(ctx, chat, "Não consegui gerar o QR Code agora. Use o código copia e cola acima.");
      }
      return;
    }
    let status = order.status;
    if (status !== "paid") {
      try {
        const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
        status = (await syncOrderWithMercadoPago(order.id))?.status || status;
      } catch (err) {
        console.warn("[advanced-runtime] Falha ao consultar pagamento:", (err as Error)?.message);
      }
    }
    if (status === "paid") {
      await answer(ctx, q.id, "🎉 Pagamento confirmado!");
      const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");
      await AccessDeliveryService.processOrderDelivery(order.id);
    } else {
      await answer(ctx, q.id, "⏳ Pagamento ainda não identificado. Aguarde alguns instantes e tente de novo.", true);
    }
    return;
  }

  const node = nodeById(g, a1);
  if (!node) return answer(ctx, q.id, "Essa opção não está mais disponível. Mande /start de novo.", true);

  if (action === "g" && a2 && nodeOutputs(node).some(([k]) => k === a2)) {
    await answer(ctx, q.id);
    await clearButtons(ctx, chat, q.messageId);
    await withRun(ctx, flow, mode, q.user, async (r) => {
      if (node.type === "bump" && a2 === "sim") r.state.addOn = { name: str(node.data.name) || "Oferta extra", price: Math.max(0, num(node.data.price)) };
      if (node.type === "bump" && a2 === "nao") r.state.addOn = null;
      await walk(r, nextOf(g, node, a2));
    });
    return;
  }

  if (action === "pay" && (node.type === "upsell" || node.type === "downsell")) {
    await answer(ctx, q.id, "⏳ Gerando seu Pix...");
    await clearButtons(ctx, chat, q.messageId);
    await withRun(ctx, flow, mode, q.user, async (r) => {
      const offer = await offerFor(r, node);
      if (!offer) return walk(r, nextOf(g, node, "nao"));
      await startPix(r, node, offer, 30, "Por botão");
    });
    return;
  }

  if (action === "no" && (node.type === "upsell" || node.type === "downsell")) {
    await answer(ctx, q.id, "Tudo bem! 👍");
    await clearButtons(ctx, chat, q.messageId);
    await withRun(ctx, flow, mode, q.user, (r) => walk(r, nextOf(g, node, "nao")));
    return;
  }

  await answer(ctx, q.id);
}

/** Resposta em texto a um bloco "Pergunta". True = a mensagem era a resposta. */
export async function runAdvancedText(ctx: FlowCtx, flow: LoadedAdvancedFlow, user: TgUser, text: string): Promise<boolean> {
  const uid = String(user.id);
  let job: typeof flowJobs.$inferSelect | undefined;
  try {
    const rows = await db
      .update(flowJobs)
      .set({ status: "done", updatedAt: new Date() })
      .where(and(eq(flowJobs.botId, ctx.botDbId), eq(flowJobs.telegramUserId, uid), eq(flowJobs.kind, "adv_wait"), eq(flowJobs.status, "pending"), gt(flowJobs.runAt, new Date())))
      .returning();
    job = rows[0];
  } catch {
    return false;
  }
  if (!job || (job.flowId && job.flowId !== flow.flowId)) return false;
  const payload = (job.payload || {}) as Record<string, unknown>;
  const node = nodeById(flow.graph, str(payload.nodeId));
  if (!node) return true;
  const mode: FlowMode = payload.mode === "test" ? "test" : "live";
  await withRun(ctx, flow, mode, user, async (r) => {
    const key = str(payload.var);
    if (key) r.state.vars[key] = text.trim().slice(0, 300);
    await walk(r, nextOf(flow.graph, node, "resp"));
  });
  return true;
}

/**
 * Tarefas da fila (adv_step / adv_wait / adv_pix). Devolve o status final da tarefa.
 * Chamado por processFlowJobs.
 */
export async function runAdvancedJob(job: typeof flowJobs.$inferSelect, token: string): Promise<"done" | "canceled"> {
  const flow = await getAdvancedFlowForBot(job.botId, { includeDraft: true });
  if (!flow || (job.flowId && flow.flowId !== job.flowId)) return "canceled";
  const payload = (job.payload || {}) as Record<string, unknown>;
  const mode: FlowMode = payload.mode === "test" ? "test" : "live";
  if (mode === "live" && flow.status !== "published") return "canceled";
  const ctx: FlowCtx = { token, storeId: job.storeId, storeSlug: "", botDbId: job.botId };
  const customer = await db.query.telegramCustomers.findFirst({ where: and(eq(telegramCustomers.storeId, job.storeId), eq(telegramCustomers.telegramUserId, job.telegramUserId)), columns: { firstName: true, lastName: true, username: true } });
  const user: TgUser = { id: job.telegramUserId, first_name: customer?.firstName || "", last_name: customer?.lastName || "", username: customer?.username || "" };
  const node = nodeById(flow.graph, str(payload.nodeId));

  if (job.kind === "adv_step") {
    if (!node) return "canceled";
    await withRun(ctx, flow, mode, user, (r) => walk(r, node.id));
    return "done";
  }
  if (job.kind === "adv_wait") {
    if (!node) return "canceled";
    await withRun(ctx, flow, mode, user, (r) => walk(r, nextOf(flow.graph, node, "sem")));
    return "done";
  }
  if (job.kind === "adv_pix") {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, str(payload.orderId)), columns: { status: true } });
    if (!node || !order || order.status === "paid") return "canceled";
    await withRun(ctx, flow, mode, user, (r) => walk(r, nextOf(flow.graph, node, "nao")));
    return "done";
  }
  return "canceled";
}

/** Pagamento confirmado de uma compra do fluxo avançado: segue pela saída "Pagou" / "Comprou". */
export async function onAdvancedPaid(purchase: typeof flowPurchases.$inferSelect, token: string, telegramUserId: string, firstName = "", lastName = "") {
  const nodeId = purchase.planId.startsWith("adv:") ? purchase.planId.slice(4) : "";
  if (!purchase.botId || !nodeId) return;
  const flow = await getAdvancedFlowForBot(purchase.botId, { includeDraft: true });
  if (!flow || flow.flowId !== purchase.flowId) return;
  const node = nodeById(flow.graph, nodeId);
  if (!node) return;
  // O Pix foi pago: a espera de "não pagou" deste pedido não roda mais.
  try {
    await db
      .update(flowJobs)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(flowJobs.kind, "adv_pix"), eq(flowJobs.ref, purchase.orderId), eq(flowJobs.status, "pending")));
  } catch {
    // não bloqueia
  }
  const job = await db.query.flowJobs
    .findFirst({ where: and(eq(flowJobs.kind, "adv_pix"), eq(flowJobs.ref, purchase.orderId)), columns: { payload: true }, orderBy: [desc(flowJobs.createdAt)] })
    .catch(() => undefined);
  const mode: FlowMode = (job?.payload as Record<string, unknown> | undefined)?.mode === "test" ? "test" : "live";
  const ctx: FlowCtx = { token, storeId: purchase.storeId, storeSlug: "", botDbId: purchase.botId };
  await withRun(ctx, flow, mode, { id: telegramUserId, first_name: firstName, last_name: lastName }, (r) => walk(r, nextOf(flow.graph, node, node.type === "pix" ? "pago" : "sim")));
}
