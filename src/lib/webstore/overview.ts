import { and, desc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accesses, combos, orderItems, orders, products, webCustomers } from "@/db/schema";

/**
 * Visão geral da Loja Web: só pedidos da web (session "web:<id>"), nunca os dos bots/Mini App.
 * Devolve os últimos 90 dias "crus"; o painel recorta 7/30/90 dias e compara com o período anterior.
 */
export const OVERVIEW_DAYS = 90;
const PAID = ["paid", "fulfilled"];

export interface OverviewOrder {
  id: string;
  createdAt: string;
  paidAt: string | null;
  status: string;
  total: number;
  /** origem do lead do cliente que comprou (null = não informado) */
  source: string | null;
  items: { key: string; title: string; total: number; quantity: number; vip: boolean; combo: boolean }[];
}

export interface WebOverview {
  orders: OverviewOrder[];
  newCustomers: { createdAt: string; source: string | null }[];
  allTime: { revenue: number; paidOrders: number; customers: number };
  vipActive: number;
}

export async function getWebOverview(storeId: string): Promise<WebOverview> {
  // dobro do período maior: dá para comparar 90 dias com os 90 anteriores
  const since = new Date(Date.now() - OVERVIEW_DAYS * 2 * 86400_000);
  const isWeb = like(orders.sessionId, "web:%");

  const [rows, customers, allTime, customerCount, vip] = await Promise.all([
    db
      .select({ id: orders.id, createdAt: orders.createdAt, paidAt: orders.paidAt, status: orders.status, total: orders.total, source: webCustomers.leadSource })
      .from(orders)
      .leftJoin(webCustomers, eq(webCustomers.shadowCustomerId, orders.customerId))
      .where(and(eq(orders.storeId, storeId), isWeb, or(gte(orders.createdAt, since), gte(orders.paidAt, since))))
      .orderBy(desc(orders.createdAt))
      .limit(5000),
    db.select({ createdAt: webCustomers.createdAt, source: webCustomers.leadSource }).from(webCustomers).where(and(eq(webCustomers.storeId, storeId), gte(webCustomers.createdAt, since))),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)`.mapWith(Number), n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), isWeb, inArray(orders.status, PAID))),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(webCustomers).where(eq(webCustomers.storeId, storeId)),
    db
      .select({ n: sql<number>`count(distinct ${accesses.customerId})`.mapWith(Number) })
      .from(accesses)
      .innerJoin(products, eq(products.id, accesses.productId))
      .where(
        and(
          eq(accesses.storeId, storeId),
          eq(accesses.status, "ACTIVE"),
          like(products.status, "web_vip%"),
          or(isNull(accesses.expiresAt), sql`${accesses.expiresAt} > now()`)
        )
      ),
  ]);

  const paidIds = rows.filter((r) => PAID.includes(r.status)).map((r) => r.id);
  const items = paidIds.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          comboId: orderItems.comboId,
          quantity: orderItems.quantity,
          total: orderItems.total,
          productTitle: products.title,
          productStatus: products.status,
          comboTitle: combos.title,
        })
        .from(orderItems)
        .leftJoin(products, eq(products.id, orderItems.productId))
        .leftJoin(combos, eq(combos.id, orderItems.comboId))
        .where(inArray(orderItems.orderId, paidIds))
    : [];
  const byOrder = new Map<string, OverviewOrder["items"]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) || [];
    list.push({
      key: it.productId || it.comboId || "?",
      title: it.productTitle || it.comboTitle || "Produto",
      total: Number(it.total),
      quantity: it.quantity,
      vip: String(it.productStatus || "").startsWith("web_vip"),
      combo: Boolean(it.comboId),
    });
    byOrder.set(it.orderId, list);
  }

  return {
    orders: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      status: PAID.includes(r.status) ? "paid" : r.status,
      total: Number(r.total),
      source: r.source ?? null,
      items: byOrder.get(r.id) || [],
    })),
    newCustomers: customers.map((c) => ({ createdAt: c.createdAt.toISOString(), source: c.source ?? null })),
    allTime: { revenue: allTime[0]?.revenue || 0, paidOrders: allTime[0]?.n || 0, customers: customerCount[0]?.n || 0 },
    vipActive: vip[0]?.n || 0,
  };
}
