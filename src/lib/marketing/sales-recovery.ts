/**
 * Marketing → Recuperação de vendas.
 *
 * Quem gerou uma compra no bot/mini app e não pagou recebe até 3 mensagens no bot, falando do
 * produto (nunca de "Pix"), com um botão que abre o carrinho do mini app com os itens de volta.
 *
 *  - Agendamento: na criação do pedido (CheckoutService), na fila que já existe (flow_jobs, kind "recovery").
 *  - Envio: processFlowJobs → runRecoveryJob. Antes de cada mensagem confere se ainda faz sentido
 *    (não pagou, não comprou depois, não tem o produto, não gerou outra compra mais nova).
 *  - Fase de testes: só a loja da conta proprietária. Sem as tabelas (migração 0035), nada acontece.
 */
import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accesses,
  botStartEvents,
  combos,
  flowJobs,
  orderItems,
  orders,
  products,
  salesRecoverySends,
  salesRecoverySettings,
  stores,
  telegramBots,
  telegramCustomers,
} from "@/db/schema";
import { isOwnerUser } from "@/lib/bots/owner-guard";

export interface RecoveryStep {
  on: boolean;
  delayMinutes: number;
  text: string;
  button: string;
}

export interface RecoverySettings {
  enabled: boolean;
  quietHours: boolean;
  steps: RecoveryStep[];
}

export const MAX_STEPS = 3;

export const DEFAULT_STEPS: RecoveryStep[] = [
  {
    on: true,
    delayMinutes: 15,
    text: "Oi {nome}! 👋 Vi que você se interessou por {produto} 🎬\n\nEle ficou separado para você, é só concluir para começar a assistir agora.",
    button: "▶️ Concluir minha compra",
  },
  {
    on: true,
    delayMinutes: 180,
    text: "{nome}, {produto} ainda está te esperando 👀\n\nMuita gente já está assistindo, não fica de fora!",
    button: "▶️ Quero assistir",
  },
  {
    on: false,
    delayMinutes: 1440,
    text: "Última chamada, {nome}! 🔥 {produto} continua separado para você, mas não por muito tempo.",
    button: "🎬 Garantir o meu",
  },
];

export const DEFAULT_SETTINGS: RecoverySettings = { enabled: false, quietHours: true, steps: DEFAULT_STEPS };

function isMissing(err: unknown) {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code;
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return code === "42P01" || code === "42703" || /(relation|column) .* does not exist/i.test(msg);
}

/** Fase de testes: só a loja da conta proprietária usa a recuperação. */
export function recoveryAllowedForOwner(ownerId?: string | null) {
  return isOwnerUser(ownerId ? { id: ownerId } : null);
}

export function normalizeSteps(raw: unknown): RecoveryStep[] {
  const list = Array.isArray(raw) ? raw : [];
  return DEFAULT_STEPS.map((def, i) => {
    const s = (list[i] || {}) as Partial<RecoveryStep>;
    const delay = Math.round(Number(s.delayMinutes));
    return {
      on: typeof s.on === "boolean" ? s.on : def.on,
      delayMinutes: Number.isFinite(delay) ? Math.min(7 * 1440, Math.max(5, delay)) : def.delayMinutes,
      text: typeof s.text === "string" && s.text.trim() ? s.text.slice(0, 900) : def.text,
      button: typeof s.button === "string" && s.button.trim() ? s.button.trim().slice(0, 40) : def.button,
    };
  });
}

export async function getRecoverySettings(storeId: string): Promise<RecoverySettings & { ready: boolean }> {
  try {
    const row = await db.query.salesRecoverySettings.findFirst({ where: eq(salesRecoverySettings.storeId, storeId) });
    if (!row) return { ...DEFAULT_SETTINGS, ready: true };
    return { enabled: row.enabled, quietHours: row.quietHours, steps: normalizeSteps(row.steps), ready: true };
  } catch (err) {
    if (!isMissing(err)) console.warn("[recovery] Falha ao ler configuração:", (err as Error)?.message);
    return { ...DEFAULT_SETTINGS, ready: false };
  }
}

export async function saveRecoverySettings(storeId: string, input: RecoverySettings) {
  const steps = normalizeSteps(input.steps);
  const values = { enabled: Boolean(input.enabled), quietHours: Boolean(input.quietHours), steps, updatedAt: new Date() };
  await db
    .insert(salesRecoverySettings)
    .values({ storeId, ...values })
    .onConflictDoUpdate({ target: salesRecoverySettings.storeId, set: values });
  if (!values.enabled) {
    // Desligou: o que estava na fila não sai mais.
    await db
      .update(flowJobs)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(flowJobs.storeId, storeId), eq(flowJobs.kind, "recovery"), eq(flowJobs.status, "pending")));
  }
}

/** Horário de silêncio (23h–8h, horário de Brasília): empurra para as 8h. */
function respectQuietHours(at: Date): Date {
  const BRT = -3;
  const local = new Date(at.getTime() + BRT * 3_600_000);
  const h = local.getUTCHours();
  if (h >= 8 && h < 23) return at;
  const target = new Date(local);
  if (h >= 23) target.setUTCDate(target.getUTCDate() + 1);
  target.setUTCHours(8, 0, 0, 0);
  return new Date(target.getTime() - BRT * 3_600_000);
}

/** Qual bot fala com o cliente: o de origem do pedido, o dono dos produtos ou o último que ele iniciou. */
async function resolveBotId(storeId: string, telegramUserId: string, originBotId: string | null, ownerBotId: string | null) {
  const candidates = [originBotId, ownerBotId].filter(Boolean) as string[];
  if (!candidates.length) {
    const [last] = await db
      .select({ botId: botStartEvents.botId })
      .from(botStartEvents)
      .where(and(eq(botStartEvents.storeId, storeId), eq(botStartEvents.telegramUserId, telegramUserId), isNotNull(botStartEvents.botId)))
      .orderBy(desc(botStartEvents.createdAt))
      .limit(1);
    if (last?.botId) candidates.push(last.botId);
  }
  for (const id of candidates) {
    const bot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.id, id), eq(telegramBots.storeId, storeId)),
      columns: { id: true, status: true },
    });
    if (bot && bot.status === "active") return bot.id;
  }
  return null;
}

/**
 * Agenda as mensagens de recuperação de um pedido recém-criado. Nunca lança erro
 * (o checkout não pode falhar por causa disso).
 */
export async function scheduleSalesRecovery(orderId: string): Promise<number> {
  try {
    const [o] = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        originBotId: orders.originBotId,
        ownerBotId: orders.ownerBotId,
        telegramUserId: telegramCustomers.telegramUserId,
        ownerId: stores.ownerId,
      })
      .from(orders)
      .innerJoin(telegramCustomers, eq(telegramCustomers.id, orders.customerId))
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!o || !recoveryAllowedForOwner(o.ownerId)) return 0;
    // Só clientes do Telegram (a Loja Web usa ids "web:...").
    if (!/^\d+$/.test(String(o.telegramUserId))) return 0;

    const settings = await getRecoverySettings(o.storeId);
    if (!settings.ready || !settings.enabled) return 0;
    const steps = settings.steps.map((s, i) => ({ ...s, i })).filter((s) => s.on);
    if (!steps.length) return 0;

    // Só a compra mais recente entra: as mensagens pendentes de compras anteriores saem da fila.
    await db
      .update(flowJobs)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(flowJobs.storeId, o.storeId), eq(flowJobs.telegramUserId, String(o.telegramUserId)), eq(flowJobs.kind, "recovery"), eq(flowJobs.status, "pending")));

    // No máximo uma sequência por cliente a cada 24 horas.
    const [recent] = await db
      .select({ id: salesRecoverySends.id })
      .from(salesRecoverySends)
      .where(and(eq(salesRecoverySends.customerId, o.customerId), eq(salesRecoverySends.status, "sent"), gt(salesRecoverySends.sentAt, new Date(Date.now() - 86_400_000))))
      .limit(1);
    if (recent) return 0;

    const botId = await resolveBotId(o.storeId, String(o.telegramUserId), o.originBotId, o.ownerBotId);
    if (!botId) return 0;

    const base = o.createdAt ? new Date(o.createdAt) : new Date();
    const rows = steps.map((s) => {
      let runAt = new Date(base.getTime() + s.delayMinutes * 60_000);
      if (settings.quietHours) runAt = respectQuietHours(runAt);
      return {
        storeId: o.storeId,
        botId,
        flowId: null,
        telegramUserId: String(o.telegramUserId),
        kind: "recovery",
        ref: o.id,
        runAt,
        payload: { step: s.i, orderId: o.id, customerId: o.customerId },
      };
    });
    const inserted = await db.insert(flowJobs).values(rows).returning({ id: flowJobs.id });
    return inserted.length;
  } catch (err) {
    if (!isMissing(err)) console.warn("[recovery] Falha ao agendar:", (err as Error)?.message);
    return 0;
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function appBaseUrl() {
  let raw = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
  if (!raw.startsWith("http")) raw = `https://${raw}`;
  if (raw.includes("webgran.online") && !raw.includes("www.webgran.online")) raw = raw.replace("webgran.online", "www.webgran.online");
  return raw.replace(/\/+$/, "");
}

/** Texto do lojista → HTML do Telegram, com as variáveis preenchidas (produto em negrito). */
export function renderRecoveryText(template: string, vars: { nome: string; produto: string; valor: string }) {
  const nome = vars.nome.trim();
  let t = esc(template);
  // Sem nome: "Oi {nome}!" → "Oi!", "chamada, {nome}!" → "chamada!", "{nome}, seu" → "seu".
  t = nome ? t.replace(/\{nome\}/g, esc(nome)) : t.replace(/,[ \t]*\{nome\}/g, "").replace(/[ \t]*\{nome\}/g, "");
  t = t
    .replace(/\{produto\}/g, `<b>${esc(vars.produto)}</b>`)
    .replace(/\{valor\}/g, `<b>${esc(vars.valor)}</b>`);
  return t
    .split("\n")
    .map((line) => line.replace(/^[ \t,;]+/, ""))
    .join("\n")
    .trim();
}

type JobRow = typeof flowJobs.$inferSelect;

/** Envia uma mensagem de recuperação. Usado pela fila (flow-jobs). */
export async function runRecoveryJob(job: JobRow, token: string): Promise<"done" | "failed" | "canceled"> {
  const payload = (job.payload || {}) as { step?: number; orderId?: string; customerId?: string };
  const step = Number(payload.step);
  const orderId = String(payload.orderId || job.ref || "");
  if (!orderId || !Number.isInteger(step)) return "canceled";

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.storeId !== job.storeId) return "canceled";
  // Já pagou (ou o pedido falhou por falta de meio de pagamento): nada a recuperar.
  if (!["pending", "cancelled", "expired"].includes(order.status)) return "canceled";

  const store = await db.query.stores.findFirst({ where: eq(stores.id, order.storeId), columns: { id: true, slug: true, ownerId: true } });
  if (!store || !recoveryAllowedForOwner(store.ownerId)) return "canceled";

  const settings = await getRecoverySettings(store.id);
  const cfg = settings.steps[step];
  if (!settings.enabled || !cfg || !cfg.on) return "canceled";

  const customer = await db.query.telegramCustomers.findFirst({ where: eq(telegramCustomers.id, order.customerId) });
  if (!customer || !/^\d+$/.test(String(customer.telegramUserId))) return "canceled";

  // Gerou outra compra depois desta (ela tem a própria sequência) ou pagou alguma compra depois: para.
  const [newer] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.customerId, customer.id), gt(orders.createdAt, order.createdAt)))
    .limit(1);
  if (newer) return "canceled";
  const [paidLater] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.customerId, customer.id), inArray(orders.status, ["paid", "fulfilled"]), gt(orders.paidAt, order.createdAt)))
    .limit(1);
  if (paidLater) return "canceled";

  // Esta mensagem já saiu?
  const [already] = await db
    .select({ id: salesRecoverySends.id })
    .from(salesRecoverySends)
    .where(and(eq(salesRecoverySends.orderId, order.id), eq(salesRecoverySends.step, step)))
    .limit(1);
  if (already) return "canceled";

  // Itens do pedido que o cliente ainda não tem
  const items = await db
    .select({
      productId: orderItems.productId,
      comboId: orderItems.comboId,
      quantity: orderItems.quantity,
      total: orderItems.total,
      pTitle: products.title,
      pCover: products.coverUrl,
      pStatus: products.status,
      cTitle: combos.title,
      cCover: combos.coverUrl,
      cStatus: combos.status,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(combos, eq(combos.id, orderItems.comboId))
    .where(eq(orderItems.orderId, order.id));

  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  const owned = new Set<string>();
  if (productIds.length) {
    const rows = await db
      .select({ productId: accesses.productId, expiresAt: accesses.expiresAt })
      .from(accesses)
      .where(and(eq(accesses.storeId, store.id), eq(accesses.customerId, customer.id), eq(accesses.status, "ACTIVE"), inArray(accesses.productId, productIds)));
    const now = Date.now();
    for (const r of rows) if (!r.expiresAt || r.expiresAt.getTime() > now) owned.add(r.productId);
  }

  const wanted = items.filter((i) =>
    i.productId ? i.pStatus === "active" && !owned.has(i.productId) : i.comboId ? i.cStatus === "active" : false
  );
  if (!wanted.length) return "canceled";

  // Devolve os itens ao carrinho do mini app (só os que não estão lá).
  try {
    const { CartService } = await import("@/lib/cart/cart-service");
    const cart = await CartService.getCart(store.id, customer.id);
    const inCart = new Set((cart.items || []).map((c) => String(c.comboId || c.id)));
    for (const i of wanted) {
      try {
        if (i.productId && !inCart.has(i.productId)) await CartService.addItem(store.id, customer.id, i.productId, i.quantity || 1);
        else if (i.comboId && !inCart.has(i.comboId)) await CartService.addComboItem(store.id, customer.id, i.comboId, i.quantity || 1);
      } catch {
        /* item indisponível: segue com os outros */
      }
    }
  } catch (err) {
    console.warn("[recovery] Falha ao montar o carrinho:", (err as Error)?.message);
  }

  const first = wanted[0];
  const firstTitle = (first.productId ? first.pTitle : first.cTitle) || "seu conteúdo";
  const produto = wanted.length > 1 ? `${firstTitle} e mais ${wanted.length - 1}` : firstTitle;
  const valor = brl(wanted.reduce((acc, i) => acc + Number(i.total || 0), 0));
  const html = renderRecoveryText(cfg.text, { nome: customer.firstName || "", produto, valor });

  const base = appBaseUrl();
  const replyMarkup = {
    inline_keyboard: [[{ text: cfg.button || "▶️ Concluir minha compra", web_app: { url: `${base}/miniapp/${store.slug}/cart?b=${job.botId}` } }]],
  };
  const rawCover = (first.productId ? first.pCover : first.cCover) || "";
  const cover = rawCover ? (rawCover.startsWith("http") ? rawCover : `${base}${rawCover.startsWith("/") ? "" : "/"}${rawCover}`) : "";

  const { TelegramBotService } = await import("@/lib/telegram/bot");
  const bot = new TelegramBotService(token);
  let sent = false;
  let error: string | null = null;
  if (cover && html.length <= 1000) {
    try {
      await bot.sendPhoto(customer.telegramUserId, cover, html, replyMarkup, "HTML");
      sent = true;
    } catch (err) {
      error = (err as Error)?.message || "Falha ao enviar a foto";
    }
  }
  if (!sent) {
    try {
      await bot.sendMessage(customer.telegramUserId, html, replyMarkup, "HTML");
      sent = true;
      error = null;
    } catch (err) {
      error = ((err as Error)?.message || "Falha ao enviar").slice(0, 500);
    }
  }

  await db
    .insert(salesRecoverySends)
    .values({ storeId: store.id, orderId: order.id, customerId: customer.id, botId: job.botId, step, status: sent ? "sent" : "failed", error })
    .onConflictDoNothing();

  if (!sent) {
    // Bloqueou o bot ou nunca falou com ele: as próximas mensagens desta compra também não chegariam.
    if (/403|blocked|chat not found|deactivated/i.test(error || "")) {
      await db
        .update(flowJobs)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(and(eq(flowJobs.kind, "recovery"), eq(flowJobs.ref, order.id), eq(flowJobs.status, "pending")));
    }
    return "failed";
  }
  return "done";
}

export interface RecoveryStats {
  contacted: number;
  messages: number;
  recovered: number;
  revenue: number;
  recent: { orderId: string; name: string; product: string; steps: number; sentAt: string; recovered: boolean }[];
}

/** Números da aba: últimos 30 dias. Venda recuperada = cliente pagou até 3 dias depois da 1ª mensagem. */
export async function getRecoveryStats(storeId: string): Promise<RecoveryStats> {
  const empty: RecoveryStats = { contacted: 0, messages: 0, recovered: 0, revenue: 0, recent: [] };
  try {
    const res = (await db.execute(sql`
      WITH s AS (
        SELECT order_id, customer_id, MIN(sent_at) AS first_at, MAX(sent_at) AS last_at, COUNT(*)::int AS steps
        FROM sales_recovery_sends
        WHERE store_id = ${storeId} AND status = 'sent' AND sent_at > NOW() - INTERVAL '30 days'
        GROUP BY order_id, customer_id
      ),
      r AS (
        SELECT DISTINCT ON (s.order_id) s.order_id, o.id AS paid_id, o.total::numeric AS total
        FROM s
        JOIN orders o ON o.store_id = ${storeId} AND o.customer_id = s.customer_id
          AND o.status IN ('paid', 'fulfilled') AND o.paid_at >= s.first_at AND o.paid_at <= s.first_at + INTERVAL '3 days'
        ORDER BY s.order_id, o.paid_at
      )
      SELECT
        s.order_id, s.steps, s.last_at,
        COALESCE(NULLIF(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, ''))), ''), c.username, 'Cliente') AS name,
        (SELECT COALESCE(p.title, cb.title) FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN combos cb ON cb.id = oi.combo_id
           WHERE oi.order_id = s.order_id LIMIT 1) AS product,
        r.paid_id, r.total
      FROM s
      JOIN telegram_customers c ON c.id = s.customer_id
      LEFT JOIN r ON r.order_id = s.order_id
      ORDER BY s.last_at DESC
    `)) as unknown;
    const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] })?.rows || []) as {
      order_id: string; steps: number; last_at: string | Date; name: string; product: string | null; paid_id: string | null; total: string | null;
    }[];
    const paid = new Map<string, number>();
    for (const r of rows) if (r.paid_id) paid.set(r.paid_id, Number(r.total || 0));
    return {
      contacted: rows.length,
      messages: rows.reduce((a, r) => a + Number(r.steps || 0), 0),
      recovered: paid.size,
      revenue: [...paid.values()].reduce((a, b) => a + b, 0),
      recent: rows.slice(0, 20).map((r) => ({
        orderId: r.order_id,
        name: r.name,
        product: r.product || "—",
        steps: Number(r.steps || 0),
        sentAt: new Date(r.last_at).toISOString(),
        recovered: Boolean(r.paid_id),
      })),
    };
  } catch (err) {
    if (!isMissing(err)) console.warn("[recovery] Falha nos números:", (err as Error)?.message);
    return empty;
  }
}
