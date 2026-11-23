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
import { flowJobs, flowPurchases, orders, products, salesFlowBots, salesFlows, telegramBotChats, telegramBots, telegramCustomers } from "@/db/schema";
import { telegramFetch } from "@/lib/telegram/client";
import { graphOrder, jsonList, nodeOutputs, normalizeGraph, type AbVariant, type CondRule, type FlowGraph, type FlowNode, type MsgButton, type MsgItem } from "./advanced-graph";
import { brl, greeting, pixCodeHtml, renderFlowText, type FlowCtx, type FlowMode } from "./flow-runtime";
import type { PeriodUnit } from "./basic-config";

export const ADV_PREFIX: Record<FlowMode, string> = { live: "al", test: "at" };

export interface LoadedAdvancedFlow {
  flowId: string;
  status: "draft" | "published";
  graph: FlowGraph;
}

type TgUser = { id: number | string; first_name?: string; last_name?: string; username?: string; language_code?: string };
type Kb = { inline_keyboard: Array<Array<Record<string, unknown>>> };

interface AdvState {
  vars: Record<string, string>;
  /** Order Bump aceito: entra somado no próximo Pix. */
  addOn: { name: string; price: number } | null;
  lastProductId: string;
  fromCampaign: boolean;
  /** Já passou pelo /start (para "Ignorar /start repetido"). */
  started: boolean;
  /** Origem do link de campanha (start=s-..._c-..._m-...). */
  utm: { source: string; medium: string; campaign: string };
  lang: string;
  /** Valor do último pagamento confirmado (bloco Pixel). */
  lastAmount: number;
  /** Último grupo liberado (bloco Remover). */
  lastChatId: string;
}

const blankState = (): AdvState => ({ vars: {}, addOn: null, lastProductId: "", fromCampaign: false, started: false, utm: { source: "", medium: "", campaign: "" }, lang: "", lastAmount: 0, lastChatId: "" });
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
    return { ...blankState(), ...p, vars: { ...(p.vars || {}) }, utm: { ...blankState().utm, ...(p.utm || {}) } };
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
  const out: Record<string, string> = { "{nome}": r.user.first_name || "", "{sobrenome}": r.user.last_name || "", "{username}": r.user.username ? "@" + r.user.username : "", "{saudacao}": greeting(), "{cidade}": "" };
  for (const [k, v] of Object.entries(r.state.vars)) if (/^[a-z0-9_]{1,30}$/i.test(k)) out[`{${k}}`] = v;
  return out;
}
const render = (r: Run, t: unknown) => renderFlowText(str(t), textVars(r));
const cb = (r: Run, ...parts: string[]) => [ADV_PREFIX[r.mode], ...parts].join(":");

const UNIT_MS: Record<string, number> = { segundos: 1000, minutos: 60_000, horas: 3_600_000, dias: 86_400_000 };

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

/* ---------- envio por tipo de mídia ---------- */
type MediaKind = "photo" | "video" | "videonote" | "voice" | "audio" | "document";
function kindOf(url: string): MediaKind {
  if (/\.(ogg|oga|opus)(\?|$)/i.test(url)) return "voice";
  if (/\.(mp3|m4a|wav|aac)(\?|$)/i.test(url)) return "audio";
  if (/\.(mp4|mov)(\?|$)/i.test(url)) return "video";
  if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) return "photo";
  return "document";
}
const METHOD: Record<MediaKind, [string, string]> = {
  photo: ["sendPhoto", "photo"],
  video: ["sendVideo", "video"],
  videonote: ["sendVideoNote", "video_note"],
  voice: ["sendVoice", "voice"],
  audio: ["sendAudio", "audio"],
  document: ["sendDocument", "document"],
};
/** Envia uma mídia do tipo pedido. Legenda longa vai numa mensagem separada. Retorna se enviou. */
async function sendAs(r: Run, kind: MediaKind, url: string, opts: { caption?: string; spoiler?: boolean; kb?: Kb } = {}): Promise<boolean> {
  if (!/^https:\/\//i.test(url || "")) return false;
  const caption = opts.caption && kind !== "videonote" && opts.caption.length <= 1024 ? opts.caption : undefined;
  const [method, field] = METHOD[kind];
  try {
    await telegramFetch(r.ctx.token, method, {
      chat_id: r.uid,
      [field]: url,
      caption,
      parse_mode: caption ? "HTML" : undefined,
      has_spoiler: opts.spoiler && (kind === "photo" || kind === "video") ? true : undefined,
      reply_markup: opts.kb,
    });
  } catch (err) {
    // Recado redondo só aceita vídeo quadrado: cai para vídeo normal.
    if (kind === "videonote") return sendAs(r, "video", url, opts);
    console.warn("[advanced-runtime] Mídia não enviada:", (err as Error)?.message);
    return false;
  }
  if (opts.caption && !caption) await send(r.ctx, r.uid, opts.caption);
  return true;
}

const spoilerHtml = (html: string, on: unknown) => (on && html ? `<tg-spoiler>${html}</tg-spoiler>` : html);

async function chatAction(r: Run, action: string) {
  try {
    await telegramFetch(r.ctx.token, "sendChatAction", { chat_id: r.uid, action });
  } catch {
    // não bloqueia
  }
}

/** Hora atual em Brasília no formato HH:MM. */
function nowBrasilia(): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Avalia uma condição do bloco "Condição". */
async function matchRule(r: Run, rule: CondRule): Promise<boolean> {
  const val = str(rule.value).trim();
  switch (rule.kind) {
    case "horario": {
      const now = nowBrasilia();
      const from = val || "00:00";
      const to = str(rule.value2) || "23:59";
      return from <= to ? now >= from && now <= to : now >= from || now <= to; // faixa que vira a noite
    }
    case "idioma":
      return !!val && r.state.lang.toLowerCase().startsWith(val.toLowerCase());
    case "utm_source":
    case "utm_medium":
    case "utm_campaign": {
      const got = str(r.state.utm[rule.kind.slice(4) as keyof AdvState["utm"]]).toLowerCase();
      return val === "*" ? !!got : !!val && got === val.toLowerCase();
    }
    case "pagou": {
      const paid = await checkRule(r, "Já comprou algum plano");
      return val === "nao" ? !paid : paid;
    }
    default:
      return false;
  }
}

/** Valida a resposta do bloco Input. */
function validAnswer(kind: string, text: string): boolean {
  const t = text.trim();
  if (kind === "numero") return /^-?\d+([.,]\d+)?$/.test(t);
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  if (kind === "telefone") return t.replace(/\D/g, "").length >= 10;
  return t.length > 0;
}

/** Link de campanha: t.me/bot?start=s-facebook_c-black_m-stories (s=source, c=campaign, m=medium). */
export function parseCampaign(param: string): AdvState["utm"] {
  const out = { source: "", medium: "", campaign: "" };
  const p = param.trim();
  if (!p) return out;
  const parts = p.split("_");
  let matched = false;
  for (const part of parts) {
    const m = /^([scm])-(.+)$/i.exec(part);
    if (!m) continue;
    matched = true;
    const v = m[2].slice(0, 60);
    if (m[1].toLowerCase() === "s") out.source = v;
    else if (m[1].toLowerCase() === "c") out.campaign = v;
    else out.medium = v;
  }
  if (!matched) out.source = p.slice(0, 60); // qualquer outro código vira a origem
  return out;
}

/** Evento de Pixel (API de Conversões do Facebook). Não bloqueia o fluxo. */
async function firePixel(r: Run, d: Record<string, string | number>) {
  const pixel = str(d.fbPixelId).trim();
  const token = str(d.fbToken).trim();
  const event = str(d.event).trim();
  if (!pixel || !token || !event) return;
  const value = num(d.value) || r.state.lastAmount || 0;
  const crypto = await import("crypto");
  const hash = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
  try {
    await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: event,
          event_time: Math.floor(Date.now() / 1000),
          event_id: `${event}-${r.flow.flowId}-${r.uid}-${Math.floor(Date.now() / 60000)}`,
          action_source: "chat",
          user_data: { external_id: [hash(r.uid)], ...(r.user.first_name ? { fn: [hash(r.user.first_name)] } : {}) },
          ...(value > 0 ? { custom_data: { currency: "BRL", value: Math.round(value * 100) / 100 } } : {}),
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[advanced-runtime] Pixel não enviado:", (err as Error)?.message);
  }
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

      /* ---------- Comunicação ---------- */
      case "mensagem": {
        const items = jsonList<MsgItem>(d.items);
        const allButtons = jsonList<MsgButton>(d.buttons).filter((b) => str(b.label).trim());
        const rows: Kb["inline_keyboard"] = [];
        let cbIndex = 0;
        for (const b of allButtons.slice(0, 8)) {
          const url = str(b.url).trim();
          if (url) {
            if (/^https:\/\//i.test(url)) rows.push([{ text: str(b.label).slice(0, 64), url }]);
          } else {
            rows.push([{ text: str(b.label).slice(0, 64), callback_data: cb(r, "g", node.id, `b${cbIndex}`) }]);
            cbIndex++;
          }
        }
        const kb = rows.length ? { inline_keyboard: rows } : undefined;
        const btnText = render(r, d.btnText);
        // Sem "texto acima dos botões", os botões vão no último texto.
        const lastTextIdx = !btnText && kb ? items.map((x) => x.t).lastIndexOf("texto") : -1;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.t === "texto") {
            const html = spoilerHtml(render(r, it.text), it.spoiler);
            if (html) await send(r.ctx, r.uid, html, i === lastTextIdx ? kb : undefined);
          } else if (it.t === "midia") {
            await sendAs(r, kindOf(str(it.url)), str(it.url), { spoiler: !!it.spoiler });
          } else if (it.t === "delay") {
            await chatAction(r, "typing");
            await sleep(Math.min(10, Math.max(1, num(it.sec))) * 1000);
          }
        }
        if (kb && (btnText || lastTextIdx < 0)) await send(r.ctx, r.uid, btnText || "👇", kb);
        if (cbIndex > 0) {
          // Espera o clique (ou o timeout automático).
          const mins = num(d.timeout);
          if (mins > 0) await scheduleJob(r, "adv_btn", node.id, new Date(Date.now() + mins * 60_000), { nodeId: node.id });
          return;
        }
        id = nextOf(g, node, "out");
        break;
      }

      case "texto": {
        const html = spoilerHtml(render(r, d.text), num(d.spoiler));
        if (html) await send(r.ctx, r.uid, html);
        id = nextOf(g, node, "out");
        break;
      }

      case "imagem":
        await sendAs(r, "photo", str(d.url), { caption: render(r, d.caption), spoiler: num(d.spoiler) === 1 });
        id = nextOf(g, node, "out");
        break;

      case "video":
        if (d.format === "redondo") await sendAs(r, "videonote", str(d.url));
        else await sendAs(r, "video", str(d.url), { caption: render(r, d.caption), spoiler: num(d.spoiler) === 1 });
        id = nextOf(g, node, "out");
        break;

      case "audio": {
        const url = str(d.url);
        const kind: MediaKind = d.mode === "musica" || kindOf(url) !== "voice" ? "audio" : "voice";
        await sendAs(r, kind, url, { caption: render(r, d.caption) });
        id = nextOf(g, node, "out");
        break;
      }

      case "arquivo":
        await sendAs(r, "document", str(d.url), { caption: render(r, d.caption) });
        id = nextOf(g, node, "out");
        break;

      case "midia": {
        const url = str(d.url);
        await sendAs(r, kindOf(url) === "video" ? "video" : "photo", url, { caption: render(r, d.caption) });
        id = nextOf(g, node, "out");
        break;
      }

      case "digitando": {
        const action = d.action === "gravando" ? "record_voice" : "typing";
        const sec = Math.max(1, Math.min(600, num(d.sec)));
        const next = nextOf(g, node, "out");
        if (sec <= 12) {
          // O indicador some sozinho em ~5 s: renova até completar o tempo.
          for (let left = sec; left > 0; left -= 4) {
            await chatAction(r, action);
            await sleep(Math.min(4, left) * 1000);
          }
          id = next;
          break;
        }
        await chatAction(r, action);
        if (next) await scheduleJob(r, "adv_step", `${node.id}:${Date.now()}`, new Date(Date.now() + sec * 1000), { nodeId: next });
        return;
      }

      case "fakecall": {
        const name = str(d.name).trim();
        const head = name ? `📞 <b>${escapeHtml(name)}</b> está te ligando…` : "";
        const msg = render(r, d.msg);
        const kb: Kb = { inline_keyboard: [[{ text: str(d.acceptBtn) || "📞 Atender chamada", callback_data: cb(r, "g", node.id, "atendeu") }], [{ text: str(d.declineBtn) || "❌ Recusar", callback_data: cb(r, "g", node.id, "recusou") }]] };
        await send(r.ctx, r.uid, [head, msg].filter(Boolean).join("\n\n") || "📞 Chamada de vídeo recebida", kb);
        return; // espera atender ou recusar
      }

      /* ---------- Lógica ---------- */
      case "espera": {
        const next = nextOf(g, node, "out");
        if (!next) return;
        const ms = Math.max(0, num(d.n)) * (UNIT_MS[str(d.u)] || 60_000);
        if (ms <= 10_000) {
          await sleep(ms);
          id = next;
          break;
        }
        await scheduleJob(r, "adv_step", `${node.id}:${Date.now()}`, new Date(Date.now() + ms), { nodeId: next });
        return;
      }

      case "condicao": {
        const rules = jsonList<CondRule>(d.rules);
        let out = "senao";
        for (let i = 0; i < rules.length; i++) {
          if (await matchRule(r, rules[i])) {
            out = `c${i}`;
            break;
          }
        }
        id = nextOf(g, node, out);
        break;
      }

      case "ab": {
        const vs = jsonList<AbVariant>(d.variants).slice(0, 8);
        const total = vs.reduce((a, v) => a + Math.max(0, num(v.pct)), 0);
        let roll = Math.random() * (total || 1);
        let pick = 0;
        for (let i = 0; i < vs.length; i++) {
          roll -= Math.max(0, num(vs[i].pct));
          if (roll < 0) {
            pick = i;
            break;
          }
        }
        id = nextOf(g, node, "abcdefgh"[pick]);
        break;
      }

      case "input":
      case "pergunta": {
        await send(r.ctx, r.uid, render(r, d.text) || "Responda aqui 👇");
        await cancelJobs(r.ctx.botDbId, r.uid, ["adv_wait"]);
        const unit = node.type === "pergunta" ? "minutos" : str(d.u) || "segundos";
        const wait = Math.max(1, num(d.wait)) * (UNIT_MS[unit] || 1000);
        await scheduleJob(r, "adv_wait", "q", new Date(Date.now() + Math.max(wait, 15_000)), { nodeId: node.id, var: str(d.var).replace(/[^a-z0-9_]/gi, "").slice(0, 30), kind: str(d.kind) || "texto" });
        return; // espera a resposta
      }

      case "botoes": {
        const outs = nodeOutputs(node);
        const kb: Kb = { inline_keyboard: outs.map(([k, label]) => [{ text: label.slice(0, 64), callback_data: cb(r, "g", node.id, k) }]) };
        await send(r.ctx, r.uid, render(r, d.text) || "Escolha uma opção 👇", outs.length ? kb : undefined);
        return; // espera o clique
      }

      case "salto":
        id = jumpTarget(g, str(d.target));
        break;

      /* ---------- Pagamento ---------- */
      case "pagamento": {
        const value = Math.round(num(d.value) * 100) / 100;
        if (value < 1) {
          await send(r.ctx, r.uid, "⚠️ Esta cobrança ainda não está disponível.");
          return;
        }
        const add = r.state.addOn;
        r.state.addOn = null;
        const name = str(d.desc).trim() || "Pagamento";
        await startPix(r, node, { name: add ? `${name} + ${add.name}` : name, price: value + (add?.price || 0), unit: "vitalicio", amount: 1 }, Math.max(1, num(d.timeout)), str(d.qr) || "botao", str(d.msg));
        return; // espera o pagamento
      }

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

      /* ---------- Entrega ---------- */
      case "grupo":
      case "entrega":
        await deliverAccess(r, node);
        id = nextOf(g, node, "out");
        break;

      case "bottaxa": {
        const bot = await db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, str(d.botId)), eq(telegramBots.storeId, r.ctx.storeId)), columns: { username: true, displayName: true } });
        const user = str(bot?.username).replace(/^@/, "");
        if (user) {
          const label = str(d.btnText).trim() || `🤖 Acessar ${bot?.displayName || "@" + user}`;
          await send(r.ctx, r.uid, "👉 Clique no botão abaixo para acessar:", { inline_keyboard: [[{ text: label.slice(0, 64), url: `https://t.me/${user}?start=flow` }]] });
        }
        id = nextOf(g, node, "out");
        break;
      }

      case "remover": {
        const chatId = str(d.groupId).trim() || r.state.lastChatId;
        if (/^-?\d{5,20}$/.test(chatId)) {
          try {
            await telegramFetch(r.ctx.token, "banChatMember", { chat_id: chatId, user_id: r.uid });
            await telegramFetch(r.ctx.token, "unbanChatMember", { chat_id: chatId, user_id: r.uid, only_if_banned: true });
          } catch (err) {
            console.warn("[advanced-runtime] Remover do grupo falhou:", (err as Error)?.message);
          }
        }
        id = nextOf(g, node, "out");
        break;
      }

      case "pixel":
        if (r.mode === "live") await firePixel(r, d);
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
async function startPix(r: Run, node: FlowNode, item: { name: string; price: number; unit: PeriodUnit; amount: number }, waitMin: number, qrMode: string, customMsg = "") {
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
  const qr = qrMode === "Por botão" ? "botao" : qrMode === "Junto do Pix" ? "junto" : qrMode;
  if (qr === "botao" && hasQr) kb.inline_keyboard.push([{ text: "📱 Mostrar QR Code", callback_data: cb(r, "qr", orderId) }]);
  if (qr === "junto" && hasQr) await sendMedia(r.ctx, r.uid, `${appBaseUrl()}/api/telegram/order-qr/${orderId}`);

  const total = res.total ?? item.price;
  const template = customMsg.trim() || `💳 Pague agora e garanta <b>{plano}</b>!\n\nValor: <b>{valor}</b>\n\nCopie o código Pix abaixo:`;
  const head = renderFlowText(template, { ...textVars(r), "{plano}": item.name, "{descricao}": item.name, "{valor}": brl(total) });
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
      if (r.mode === "test") await send(r.ctx, r.uid, "🧪 <i>Grupo:</i> o convite só é liberado depois de um pagamento confirmado neste fluxo.");
      return;
    }
    const { grantFlowAccess } = await import("./flow-delivery");
    // Bloco Grupo: o tempo de acesso vem do bloco (0 = sem vencimento).
    const expiresAt = node.type === "grupo" ? (num(node.data.days) > 0 ? new Date(Date.now() + num(node.data.days) * 86_400_000) : null) : purchase.expiresAt ?? null;
    const link = await grantFlowAccess(purchase, r.uid, "group", chat.telegramChatId, purchase.planName, purchase.orderId, expiresAt);
    if (!link) return;
    await db
      .update(flowPurchases)
      .set({ deliveryType: "group", deliveryValue: chat.telegramChatId, inviteLink: link, expiresAt, updatedAt: new Date(), ...(node.type === "grupo" ? { extras: [{ id: `grp:${node.id}`, name: chat.title, price: 0, deliveryType: "group", deliveryValue: chat.telegramChatId }] } : {}) })
      .where(eq(flowPurchases.id, purchase.id));
    r.state.lastChatId = chat.telegramChatId;
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
  await withRun(ctx, flow, mode, u, async (r) => {
    const start0 = r.flow.graph.nodes.find((n) => n.type === "inicio");
    if (mode === "live" && r.state.started && num(start0?.data.ignoreRepeat) === 1) return; // já entrou antes
    // Novo /start: zera o que estava pendente desta pessoa (pergunta, espera, Pix aguardando).
    await cancelJobs(ctx.botDbId, r.uid, ["adv_wait", "adv_step", "adv_pix", "adv_btn"]);
    const param = mode === "live" ? startParam : "";
    r.state = { ...blankState(), started: true, fromCampaign: !!param.trim(), utm: parseCampaign(param), lang: str(u.language_code), lastChatId: r.state.lastChatId };
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
    await cancelJobs(ctx.botDbId, String(q.user.id), ["adv_btn"]);
    await withRun(ctx, flow, mode, q.user, async (r) => {
      if (node.type === "fakecall" && a2 === "atendeu" && node.data.videoUrl) await sendAs(r, "video", str(node.data.videoUrl));
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

/** Resposta em texto a um bloco "Input"/"Pergunta". True = a mensagem era a resposta. */
export async function runAdvancedText(ctx: FlowCtx, flow: LoadedAdvancedFlow, user: TgUser, text: string): Promise<boolean> {
  const uid = String(user.id);
  const pendingWhere = and(eq(flowJobs.botId, ctx.botDbId), eq(flowJobs.telegramUserId, uid), eq(flowJobs.kind, "adv_wait"), eq(flowJobs.status, "pending"), gt(flowJobs.runAt, new Date()));
  let waiting: typeof flowJobs.$inferSelect | undefined;
  try {
    waiting = await db.query.flowJobs.findFirst({ where: pendingWhere });
  } catch {
    return false;
  }
  if (!waiting || (waiting.flowId && waiting.flowId !== flow.flowId)) return false;
  const payload = (waiting.payload || {}) as Record<string, unknown>;
  // Resposta no formato errado (número, e-mail, telefone): pede de novo e continua esperando.
  if (!validAnswer(str(payload.kind) || "texto", text)) {
    const tip: Record<string, string> = { numero: "um número", email: "um e-mail válido", telefone: "um telefone com DDD" };
    await send(ctx, uid, `⚠️ Por favor, responda com ${tip[str(payload.kind)] || "uma mensagem de texto"}.`);
    return true;
  }
  const claimed = await db.update(flowJobs).set({ status: "done", updatedAt: new Date() }).where(and(eq(flowJobs.id, waiting.id), eq(flowJobs.status, "pending"))).returning({ id: flowJobs.id });
  if (!claimed.length) return true;
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
    await withRun(ctx, flow, mode, user, (r) => walk(r, nextOf(flow.graph, node, node.type === "pagamento" ? "expirou" : "nao")));
    return "done";
  }
  if (job.kind === "adv_btn") {
    if (!node) return "canceled";
    await withRun(ctx, flow, mode, user, (r) => walk(r, nextOf(flow.graph, node, "sem")));
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
  await withRun(ctx, flow, mode, { id: telegramUserId, first_name: firstName, last_name: lastName }, (r) => {
    r.state.lastAmount = Number(purchase.price) || r.state.lastAmount;
    return walk(r, nextOf(flow.graph, node, node.type === "pix" || node.type === "pagamento" ? "pago" : "sim"));
  });
}

/** Acesso do bloco Grupo venceu (o cliente já foi removido): segue pela saída "Expirado". */
export async function onAdvancedExpired(purchase: typeof flowPurchases.$inferSelect, token: string, telegramUserId: string, firstName = "") {
  const grp = ((purchase.extras as { id?: string }[]) || []).find((x) => str(x?.id).startsWith("grp:"));
  if (!purchase.botId || !grp) return;
  const flow = await getAdvancedFlowForBot(purchase.botId, { includeDraft: true });
  if (!flow || flow.flowId !== purchase.flowId) return;
  const node = nodeById(flow.graph, str(grp.id).slice(4));
  if (!node) return;
  const ctx: FlowCtx = { token, storeId: purchase.storeId, storeSlug: "", botDbId: purchase.botId };
  const mode: FlowMode = flow.status === "published" ? "live" : "test";
  await withRun(ctx, flow, mode, { id: telegramUserId, first_name: firstName }, (r) => walk(r, nextOf(flow.graph, node, "expirado")));
}
