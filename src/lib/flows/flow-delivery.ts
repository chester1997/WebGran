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
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
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
  return code === "42P01" || /relation .*flow_purchases.* does not exist/i.test(msg);
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

/**
 * Entrega o plano de um pedido pago. Devolve true se o pedido é de fluxo (entregue ou não),
 * para quem chamou NÃO seguir a entrega de produtos. False = pedido normal do Mini App.
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

  try {
    const customer = await db.query.telegramCustomers.findFirst({ where: eq(telegramCustomers.id, purchase.customerId) });
    const tg = await botFor(purchase);
    if (!tg) throw new Error("O bot do fluxo não foi encontrado ou está sem token.");
    if (!customer?.telegramUserId) throw new Error("Cliente sem Telegram vinculado.");

    const paidAt = order.paidAt || new Date();
    const expiresAt = planExpiresAt(purchase.periodUnit, purchase.periodAmount, paidAt);
    let accessUrl = "";

    if (purchase.deliveryType === "group" && isChatId(purchase.deliveryValue)) {
      const chatId = purchase.deliveryValue.trim();
      const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");
      const perm = await TelegramDeliveryService.validateBotAndChatPermission(tg.token, chatId, tg.bot.botId);
      if (!perm.success) throw new Error(`O bot não tem permissão no grupo/canal ${chatId}: ${perm.error}`);
      const member = await TelegramDeliveryService.checkBuyerMembership(tg.token, chatId, customer.telegramUserId);
      if (member) {
        accessUrl = `https://t.me/c/${chatId.replace(/^-100/, "")}/1`;
      } else {
        // Convite de uso único, válido por 7 dias (ou até o plano vencer, o que vier antes).
        const weekAhead = Date.now() + 7 * 24 * 3600 * 1000;
        const until = Math.floor(Math.min(weekAhead, expiresAt ? expiresAt.getTime() : weekAhead) / 1000);
        const invite = await TelegramDeliveryService.createTelegramInvite(tg.token, chatId, purchase.planName, orderId, until);
        accessUrl = invite.inviteLink;
      }
    } else {
      accessUrl = purchase.deliveryValue.trim();
    }
    if (!/^https?:\/\//i.test(accessUrl)) throw new Error("Destino de entrega inválido.");

    await db
      .update(flowPurchases)
      .set({ status: "ACTIVE", inviteLink: accessUrl, expiresAt, error: null, updatedAt: new Date() })
      .where(eq(flowPurchases.id, purchase.id));

    // Mensagem do Acesso VIP (ou a padrão).
    const c = await flowConfig(purchase.flowId);
    const vars = {
      "{nome}": customer.firstName || "",
      "{saudacao}": greeting(),
      "{plano}": purchase.planName,
      "{nome_plano}": purchase.planName,
      "{valor}": brl(Number(purchase.price)),
      "{valor_final}": Number(purchase.price).toFixed(2).replace(".", ","),
      "{duracao}": planPeriodLabel({ unit: purchase.periodUnit as PeriodUnit, amount: purchase.periodAmount }),
      "{link_vip}": accessUrl,
    };
    const protect = Boolean(c?.inicio.antiClone);
    const template = c?.vip.msg.trim() || "✅ <b>Pagamento confirmado!</b>\n\nOlá {nome}! Seu acesso ao <b>{nome_plano}</b> ({duracao}) foi liberado. Toque no botão abaixo para entrar 👇";
    if (c?.vip.mediaUrl) {
      try {
        const isVideo = /\.(mp4|mov)(\?|$)/i.test(c.vip.mediaUrl);
        await telegramFetch(tg.token, isVideo ? "sendVideo" : "sendPhoto", { chat_id: customer.telegramUserId, [isVideo ? "video" : "photo"]: c.vip.mediaUrl, protect_content: protect || undefined });
      } catch (err) {
        console.warn("[flow-delivery] Mídia do VIP falhou:", (err as Error)?.message);
      }
    }
    await telegramFetch(tg.token, "sendMessage", {
      chat_id: customer.telegramUserId,
      text: renderFlowText(template, vars) || "✅ Pagamento confirmado!",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🔓 Acessar agora", url: accessUrl }]] },
      protect_content: protect || undefined,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    const message = (err as Error)?.message || "Falha na entrega.";
    console.error(`[flow-delivery] Entrega do pedido ${orderId} falhou:`, message);
    await db
      .update(flowPurchases)
      .set({ status: "FAILED", deliveredAt: null, error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(flowPurchases.id, purchase.id));
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
      if (tg && customer?.telegramUserId) {
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
        const c = await flowConfig(p.flowId);
        const msg = c?.expiracao.msg.trim() || "⏰ Seu plano <b>{nome_plano}</b> expirou. Para voltar ao grupo, é só assinar de novo 👇";
        const vars = { "{nome}": customer.firstName || "", "{saudacao}": greeting(), "{plano}": p.planName, "{nome_plano}": p.planName };
        try {
          if (c?.expiracao.mediaUrl) await telegramFetch(tg.token, "sendPhoto", { chat_id: customer.telegramUserId, photo: c.expiracao.mediaUrl });
          await telegramFetch(tg.token, "sendMessage", {
            chat_id: customer.telegramUserId,
            text: renderFlowText(msg, vars),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: c?.inicio.btn || "🔥 Ver Planos", callback_data: "fl:plans" }]] },
          });
        } catch (err) {
          console.warn("[flow-delivery] Aviso de expiração falhou:", (err as Error)?.message);
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
