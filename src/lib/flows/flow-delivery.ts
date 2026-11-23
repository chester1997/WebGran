/**
 * Entrega e expiração das compras de planos dos fluxos (tabela flow_purchases).
 *
 * Entrega: o plano libera um grupo, supergrupo ou canal do Telegram.
 *  - Destino por ID (-100…): o bot (admin do chat) gera um convite de uso único para o comprador
 *    e, no vencimento, remove a pessoa do chat.
 *  - Destino por link: o bot só envia o link (não dá para controlar a entrada nem remover depois).
 *
 * Tudo aqui é "fail-open": sem a tabela (migration 0025) ou sem compra de fluxo no pedido,
 * as funções devolvem false/zero e o sistema segue o caminho normal do Mini App.
 */
import { and, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { flowPurchases, orders, salesFlows, telegramBots, telegramCustomers } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import { telegramFetch } from "@/lib/telegram/client";
import { normalizeBasicConfig, planPeriodLabel, type PeriodUnit } from "./basic-config";
import { brl, greeting, renderFlowText } from "./flow-runtime";

type Purchase = typeof flowPurchases.$inferSelect;

function isMissingTable(err: unknown) {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code;
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  // 42703: coluna nova (migration 0026) ainda não existe.
  return code === "42P01" || code === "42703" || /(relation|column) .*(flow_purchases|kind|extras).* does not exist/i.test(msg);
}

/** Data de vencimento do plano a partir do pagamento. Vitalício = null. */
export function planExpiresAt(unit: string, amount: number, from: Date): Date | null {
  if (unit === "vitalicio") return null;
  const n = Math.max(1, Math.round(amount || 1));
  const d = new Date(from);
  switch (unit as PeriodUnit) {
    case "segundos": d.setSeconds(d.getSeconds() + n); break;
    case "minutos": d.setMinutes(d.getMinutes() + n); break;
    case "horas": d.setHours(d.getHours() + n); break;
    case "dias": d.setDate(d.getDate() + n); break;
    case "semanas": d.setDate(d.getDate() + 7 * n); break;
    case "meses": {
      const day = d.getDate();
      d.setMonth(d.getMonth() + n);
      if (d.getDate() !== day) d.setDate(0); // 31/01 + 1 mês = 28 ou 29/02
      break;
    }
    case "anos": d.setFullYear(d.getFullYear() + n); break;
    default: d.setMonth(d.getMonth() + n);
  }
  return d;
}

/** Busca a compra de fluxo do pedido. Null se o pedido não é de fluxo ou a tabela não existe. */
export async function getFlowPurchaseByOrder(orderId: string): Promise<Purchase | null> {
  try {
    const rows = await db.select().from(flowPurchases).where(eq(flowPurchases.orderId, orderId)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

async function botFor(p: Purchase) {
  if (!p.botId) return null;
  const bot = await db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, p.botId), eq(telegramBots.storeId, p.storeId)) });
  if (!bot?.tokenEncrypted) return null;
  return { bot, token: decrypt(bot.tokenEncrypted) };
}

async function flowConfig(flowId: string | null) {
  if (!flowId) return null;
  const f = await db.query.salesFlows.findFirst({ where: eq(salesFlows.id, flowId), columns: { config: true } });
  return f ? normalizeBasicConfig(f.config) : null;
}

const isChatId = (v: string) => /^-?\d{5,20}$/.test(v.trim());

type Tg = NonNullable<Awaited<ReturnType<typeof botFor>>>;

/** Libera um destino (grupo por ID ou link) e devolve o link de acesso. */
async function grantAccess(tg: Tg, telegramUserId: string, type: string, value: string, name: string, orderId: string, expiresAt: Date | null): Promise<string> {
  if (type === "group" && isChatId(value)) {
    const chatId = value.trim();
    const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");
    const perm = await TelegramDeliveryService.validateBotAndChatPermission(tg.token, chatId, tg.bot.botId);
    if (!perm.success) throw new Error(`O bot não tem permissão no grupo/canal ${chatId}: ${perm.error}`);
    const member = await TelegramDeliveryService.checkBuyerMembership(tg.token, chatId, telegramUserId);
    if (member) return `https://t.me/c/${chatId.replace(/^-100/, "")}/1`;
    // Convite de uso único, válido por 7 dias (ou até o plano vencer, o que vier antes).
    const weekAhead = Date.now() + 7 * 24 * 3600 * 1000;
    const until = Math.floor(Math.min(weekAhead, expiresAt ? expiresAt.getTime() : weekAhead) / 1000);
    const invite = await TelegramDeliveryService.createTelegramInvite(tg.token, chatId, name, orderId, until);
    return invite.inviteLink;
  }
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Destino de entrega inválido.");
  return url;
}

/** Libera um destino para a compra (usado pelo bloco "Liberar acesso" do fluxo avançado). */
export async function grantFlowAccess(p: Purchase, telegramUserId: string, type: string, value: string, name: string, orderId: string, expiresAt: Date | null): Promise<string | null> {
  const tg = await botFor(p);
  if (!tg) return null;
  return grantAccess(tg, telegramUserId, type, value, name, orderId, expiresAt);
}

type Extra = { id: string; name: string; price: number; deliveryType: string; deliveryValue: string; inviteLink?: string };

/**
 * Entrega a compra de um pedido pago (plano, upsell, bônus do Order Bump ou mimo).
 * Devolve true se o pedido é de fluxo (entregue ou não), para quem chamou NÃO seguir a entrega
 * de produtos. False = pedido normal do Mini App.
 */
export async function deliverFlowPurchase(orderId: string): Promise<boolean> {
  const purchase = await getFlowPurchaseByOrder(orderId);
  if (!purchase) return false;

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status !== "paid" || !order.paymentMethod || !order.paymentId) return true;

  // Trava atômica: só um processo entrega (webhook e "verificar pagamento" podem chegar juntos).
  const claimed = await db
    .update(flowPurchases)
    .set({ deliveredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(flowPurchases.id, purchase.id), isNull(flowPurchases.deliveredAt), inArray(flowPurchases.status, ["PENDING", "FAILED"])))
    .returning({ id: flowPurchases.id });
  if (!claimed.length) return true;

  const kind = (purchase as Purchase & { kind?: string }).kind || "plan";
  let delivered = false;
  let customerTgId = "";
  let firstName = "";
  let lastName = "";
  const c = await flowConfig(purchase.flowId);

  try {
    const customer = await db.query.telegramCustomers.findFirst({ where: eq(telegramCustomers.id, purchase.customerId) });
    const tg = await botFor(purchase);
    if (!tg) throw new Error("O bot do fluxo não foi encontrado ou está sem token.");
    if (!customer?.telegramUserId) throw new Error("Cliente sem Telegram vinculado.");
    customerTgId = customer.telegramUserId;
    firstName = customer.firstName || "";
    lastName = customer.lastName || "";
    const protect = Boolean(c?.inicio.antiClone);
    const sendText = (text: string, kb?: unknown) =>
      telegramFetch(tg.token, "sendMessage", { chat_id: customerTgId, text, parse_mode: "HTML", reply_markup: kb, protect_content: protect || undefined, link_preview_options: { is_disabled: true } });
    const sendPic = async (url: string) => {
      try {
        const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
        await telegramFetch(tg.token, isVideo ? "sendVideo" : "sendPhoto", { chat_id: customerTgId, [isVideo ? "video" : "photo"]: url, protect_content: protect || undefined });
      } catch (err) {
        console.warn("[flow-delivery] Mídia da entrega falhou:", (err as Error)?.message);
      }
    };
    const baseVars = {
      "{nome}": firstName,
      "{saudacao}": greeting(),
      "{plano}": purchase.planName,
      "{nome_plano}": purchase.planName,
      "{valor}": brl(Number(order.total)),
      "{valor_final}": Number(order.total).toFixed(2).replace(".", ","),
      "{duracao}": planPeriodLabel({ unit: purchase.periodUnit as PeriodUnit, amount: purchase.periodAmount }),
    };

    if (kind === "adv") {
      // Fluxo avançado: o pagamento só marca a compra; a entrega é o bloco "Liberar acesso"
      // (o fluxo segue pela saída "Pagou" logo abaixo).
      const expiresAt = planExpiresAt(purchase.periodUnit, purchase.periodAmount, order.paidAt || new Date());
      await db.update(flowPurchases).set({ status: "ACTIVE", expiresAt, error: null, updatedAt: new Date() }).where(eq(flowPurchases.id, purchase.id));
      try {
        const { onAdvancedPaid } = await import("./advanced-runtime");
        await onAdvancedPaid({ ...purchase, status: "ACTIVE", expiresAt }, tg.token, customerTgId, firstName, lastName);
      } catch (err) {
        // A compra já está paga e marcada: um erro ao seguir o fluxo não desfaz a venda.
        console.error(`[flow-delivery] Fluxo avançado após o pagamento do pedido ${orderId} falhou:`, (err as Error)?.message);
      }
    } else if (kind === "mimo") {
      // Mimo: nada a entregar, só o agradecimento.
      await db.update(flowPurchases).set({ status: "ACTIVE", error: null, updatedAt: new Date() }).where(eq(flowPurchases.id, purchase.id));
      if (c?.mimos.mediaUrl) await sendPic(c.mimos.mediaUrl);
      await sendText(renderFlowText(c?.mimos.thanks.trim() || "💖 Recebemos seu mimo, {nome}! Muito obrigado pelo carinho.", baseVars) || "💖 Obrigado!");
    } else {
      const paidAt = order.paidAt || new Date();
      const expiresAt = planExpiresAt(purchase.periodUnit, purchase.periodAmount, paidAt);
      const accessUrl = await grantAccess(tg, customerTgId, purchase.deliveryType, purchase.deliveryValue, purchase.planName, orderId, expiresAt);

      // Bônus do Order Bump (acesso permanente ao destino do bônus).
      const extras = (((purchase as Purchase & { extras?: unknown }).extras as Extra[]) || []).filter((x) => x && x.deliveryValue);
      const extrasOut: Extra[] = [];
      for (const x of extras) {
        try {
          extrasOut.push({ ...x, inviteLink: await grantAccess(tg, customerTgId, x.deliveryType, x.deliveryValue, x.name, orderId, null) });
        } catch (err) {
          console.error(`[flow-delivery] Bônus ${x.name} do pedido ${orderId} falhou:`, (err as Error)?.message);
          extrasOut.push(x);
        }
      }

      await db
        .update(flowPurchases)
        .set({ status: "ACTIVE", inviteLink: accessUrl, expiresAt, error: null, updatedAt: new Date(), ...(extras.length ? { extras: extrasOut } : {}) })
        .where(eq(flowPurchases.id, purchase.id));

      // Mensagem de entrega: a do Upsell (se houver) ou a do Entregável (ou a padrão).
      const vars = { ...baseVars, "{link_vip}": accessUrl };
      const isUpsell = kind === "upsell";
      const template = (isUpsell && c?.upsell.deliveryMsg.trim()) || c?.vip.msg.trim() || "✅ <b>Pagamento confirmado!</b>\n\nOlá {nome}! Seu acesso ao <b>{nome_plano}</b> ({duracao}) foi liberado. Toque no botão abaixo para entrar 👇";
      const mediaUrl = (isUpsell && c?.upsell.deliveryMediaUrl) || c?.vip.mediaUrl || "";
      if (mediaUrl) await sendPic(mediaUrl);
      await sendText(renderFlowText(template, vars) || "✅ Pagamento confirmado!", { inline_keyboard: [[{ text: "🔓 Acessar agora", url: accessUrl }]] });
      for (const x of extrasOut) {
        if (x.inviteLink) await sendText(`🎁 Seu bônus <b>${x.name.replace(/[<>&]/g, "")}</b> foi liberado!`, { inline_keyboard: [[{ text: "🔓 Acessar bônus", url: x.inviteLink }]] });
      }
    }
    delivered = true;
  } catch (err) {
    const message = (err as Error)?.message || "Falha na entrega.";
    console.error(`[flow-delivery] Entrega do pedido ${orderId} falhou:`, message);
    await db
      .update(flowPurchases)
      .set({ status: "FAILED", deliveredAt: null, error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(flowPurchases.id, purchase.id));
  }

  // Depois da compra: para o downsell, agenda os upsells e manda o evento de compra.
  if (delivered && purchase.botId && customerTgId) {
    try {
      const { cancelFlowJobs } = await import("./flow-jobs");
      await cancelFlowJobs(purchase.botId, customerTgId, ["downsell"]);
      const { getBasicFlowForBot, scheduleUpsells } = await import("./flow-runtime");
      const flow = await getBasicFlowForBot(purchase.botId, { includeDraft: true });
      if (flow && flow.flowId === purchase.flowId) {
        if (kind === "plan") await scheduleUpsells(flow, purchase.storeId, purchase.botId, customerTgId);
        else if (kind === "upsell") await scheduleUpsells(flow, purchase.storeId, purchase.botId, customerTgId, purchase.planId);
        if (flow.status === "published") {
          const { trackFlowEvent } = await import("./flow-tracking");
          await trackFlowEvent({ rastreio: flow.config.rastreio, event: "purchase", storeId: purchase.storeId, botDbId: purchase.botId, telegramUserId: customerTgId, firstName, lastName, orderId, value: Number(order.total), itemId: purchase.planId, itemName: purchase.planName, createdAt: order.createdAt, paidAt: order.paidAt });
        }
      }
    } catch (err) {
      console.error("[flow-delivery] Pós-compra falhou:", (err as Error)?.message);
    }
  }

  // Avisos de venda ao lojista (os mesmos do Mini App). Não bloqueiam.
  try {
    const { SellerSaleNotificationService } = await import("@/lib/notifications/seller-sale-notification-service");
    await SellerSaleNotificationService.notifySellerOfSale(orderId);
  } catch (err) {
    console.error("[flow-delivery] Aviso de venda falhou:", (err as Error)?.message);
  }
  try {
    const { SellerPushService } = await import("@/lib/push/seller-push-service");
    await SellerPushService.notifySellerOfSale(orderId);
  } catch (err) {
    console.error("[flow-delivery] Push de venda falhou:", (err as Error)?.message);
  }
  return true;
}

/**
 * Vence os planos dos fluxos: remove o cliente do grupo/canal (quando a entrega foi por ID)
 * e manda a mensagem da seção Expiração. Chamado pelo cron de manutenção.
 */
export async function processExpiredFlowPurchases(limit = 200): Promise<{ processed: number; removed: number; failed: number }> {
  const out = { processed: 0, removed: 0, failed: 0 };
  let due: Purchase[];
  try {
    due = await db
      .select()
      .from(flowPurchases)
      .where(and(eq(flowPurchases.status, "ACTIVE"), lte(flowPurchases.expiresAt, new Date())))
      .limit(limit);
  } catch (err) {
    if (isMissingTable(err)) return out;
    throw err;
  }

  for (const p of due) {
    out.processed++;
    let removal = "SKIPPED";
    let error: string | null = null;
    try {
      const customer = await db.query.telegramCustomers.findFirst({ where: eq(telegramCustomers.id, p.customerId) });
      const tg = await botFor(p);
      // Renovou antes de vencer (outra compra ativa no mesmo destino): não remove nem avisa.
      const renewed = await db
        .select({ id: flowPurchases.id })
        .from(flowPurchases)
        .where(and(eq(flowPurchases.customerId, p.customerId), eq(flowPurchases.deliveryValue, p.deliveryValue), eq(flowPurchases.status, "ACTIVE"), ne(flowPurchases.id, p.id), or(isNull(flowPurchases.expiresAt), gt(flowPurchases.expiresAt, new Date()))))
        .limit(1);
      if (renewed.length) {
        removal = "SKIPPED_RENEWED";
      } else if (tg && customer?.telegramUserId) {
        if (p.deliveryType === "group" && isChatId(p.deliveryValue)) {
          const chatId = p.deliveryValue.trim();
          const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");
          const member = await TelegramDeliveryService.checkBuyerMembership(tg.token, chatId, customer.telegramUserId);
          if (member) {
            // ban + unban = remove sem impedir que volte ao comprar de novo
            await telegramFetch(tg.token, "banChatMember", { chat_id: chatId, user_id: customer.telegramUserId });
            await telegramFetch(tg.token, "unbanChatMember", { chat_id: chatId, user_id: customer.telegramUserId, only_if_banned: true });
            removal = "SUCCESS";
            out.removed++;
          } else {
            removal = "SKIPPED_NOT_MEMBER";
          }
        }
        if ((p as Purchase & { kind?: string }).kind === "adv") {
          try {
            const { onAdvancedExpired } = await import("./advanced-runtime");
            await onAdvancedExpired(p, tg.token, customer.telegramUserId, customer.firstName || "");
          } catch (err) {
            console.warn("[flow-delivery] Fluxo avançado no vencimento falhou:", (err as Error)?.message);
          }
        } else {
        const c = await flowConfig(p.flowId);
        const f = p.flowId ? await db.query.salesFlows.findFirst({ where: eq(salesFlows.id, p.flowId), columns: { status: true } }) : null;
        const prefix = f?.status === "published" ? "fl" : "ft";
        // Renovação: os planos direto na mensagem, com o desconto da seção Expiração.
        const { planRows } = await import("./flow-runtime");
        const renewRows = c ? planRows(c, prefix, c.expiracao.discount > 0 ? "r" : undefined) : [];
        const msg = c?.expiracao.msg.trim() || "⏰ Seu plano <b>{nome_plano}</b> expirou. Para voltar ao grupo, é só assinar de novo 👇";
        const vars = { "{nome}": customer.firstName || "", "{saudacao}": greeting(), "{plano}": p.planName, "{nome_plano}": p.planName };
        try {
          if (c?.expiracao.mediaUrl) await telegramFetch(tg.token, "sendPhoto", { chat_id: customer.telegramUserId, photo: c.expiracao.mediaUrl });
          await telegramFetch(tg.token, "sendMessage", {
            chat_id: customer.telegramUserId,
            text: renderFlowText(msg, vars),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: renewRows.length ? renewRows : [[{ text: "🔄 Renovar acesso", callback_data: `${prefix}:plans` }]] },
          });
        } catch (err) {
          console.warn("[flow-delivery] Aviso de expiração falhou:", (err as Error)?.message);
        }
        }
      }
    } catch (err) {
      removal = "FAILED";
      error = ((err as Error)?.message || "Falha ao remover.").slice(0, 500);
      out.failed++;
    }
    await db
      .update(flowPurchases)
      .set({ status: "EXPIRED", expiredAt: new Date(), removalStatus: removal, error, updatedAt: new Date() })
      .where(eq(flowPurchases.id, p.id));
  }
  return out;
}
