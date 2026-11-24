import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accesses, orders, products, webCustomers, webSupportTickets } from "@/db/schema";

export interface OwnedProduct {
  accessId: string;
  productId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  deliveryType: string;
  link: string | null;
  status: string;
  expiresAt: Date | null;
  grantedAt: Date | null;
}

/** Produtos liberados para o cliente (um por produto, o acesso mais recente). */
export async function listOwnedProducts(storeId: string, shadowCustomerId: string): Promise<OwnedProduct[]> {
  const rows = await db
    .select({ a: accesses, p: products })
    .from(accesses)
    .innerJoin(products, eq(products.id, accesses.productId))
    .where(and(eq(accesses.storeId, storeId), eq(accesses.customerId, shadowCustomerId)))
    .orderBy(desc(accesses.createdAt));
  const seen = new Set<string>();
  const out: OwnedProduct[] = [];
  const now = Date.now();
  for (const { a, p } of rows) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const expired = a.expiresAt && new Date(a.expiresAt).getTime() < now;
    out.push({
      accessId: a.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      coverUrl: p.coverUrl || p.bannerUrl || null,
      deliveryType: p.deliveryType || "telegram",
      link: p.deliveryType === "product_video" ? null : a.inviteLink || null,
      status: expired ? "EXPIRED" : a.status,
      expiresAt: a.expiresAt,
      grantedAt: a.grantedAt,
    });
  }
  return out;
}

/** O cliente tem acesso ativo a este produto? */
export async function hasActiveAccess(storeId: string, shadowCustomerId: string, productId: string) {
  const a = await db.query.accesses.findFirst({
    where: and(eq(accesses.storeId, storeId), eq(accesses.customerId, shadowCustomerId), eq(accesses.productId, productId), eq(accesses.status, "ACTIVE")),
  });
  return Boolean(a && (!a.expiresAt || new Date(a.expiresAt).getTime() > Date.now()));
}

export async function listCustomerOrders(storeId: string, shadowCustomerId: string) {
  return db.query.orders.findMany({
    where: and(eq(orders.storeId, storeId), eq(orders.customerId, shadowCustomerId)),
    orderBy: [desc(orders.createdAt)],
    limit: 50,
    with: { items: { with: { product: true, combo: true } } },
  });
}

export async function listCustomerTickets(webCustomerId: string) {
  return db.query.webSupportTickets.findMany({
    where: eq(webSupportTickets.webCustomerId, webCustomerId),
    orderBy: [desc(webSupportTickets.createdAt)],
    limit: 30,
  });
}

/* ------------------------------------------------------------------ */
/* Lado do lojista                                                     */
/* ------------------------------------------------------------------ */

export interface SellerWebCustomerRow {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  telegram: string | null;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  paidOrders: number;
  pendingOrders: number;
  totalSpent: number;
  lastPurchaseAt: Date | null;
  openTickets: number;
}

export async function listSellerWebCustomers(storeId: string): Promise<SellerWebCustomerRow[]> {
  const list = await db.select().from(webCustomers).where(eq(webCustomers.storeId, storeId)).orderBy(desc(webCustomers.createdAt)).limit(500);
  if (!list.length) return [];
  const shadowIds = list.map((c) => c.shadowCustomerId);
  const stats = await db
    .select({
      customerId: orders.customerId,
      paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`.mapWith(Number),
      spent: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'paid'), 0)`,
      last: sql<Date | null>`max(${orders.paidAt})`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), inArray(orders.customerId, shadowIds)))
    .groupBy(orders.customerId);
  const tickets = await db
    .select({ id: webSupportTickets.webCustomerId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(webSupportTickets)
    .where(and(eq(webSupportTickets.storeId, storeId), eq(webSupportTickets.status, "open")))
    .groupBy(webSupportTickets.webCustomerId);
  return list.map((c) => {
    const s = stats.find((x) => x.customerId === c.shadowCustomerId);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      whatsapp: c.whatsapp,
      telegram: c.telegram,
      status: c.status,
      createdAt: c.createdAt,
      lastLoginAt: c.lastLoginAt,
      paidOrders: s?.paid || 0,
      pendingOrders: s?.pending || 0,
      totalSpent: Number(s?.spent || 0),
      lastPurchaseAt: s?.last ? new Date(s.last) : null,
      openTickets: tickets.find((t) => t.id === c.id)?.n || 0,
    };
  });
}

export async function getSellerWebCustomerDetail(storeId: string, webCustomerId: string) {
  const c = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.id, webCustomerId), eq(webCustomers.storeId, storeId)) });
  if (!c) return null;
  const [ords, owned, tickets] = await Promise.all([
    listCustomerOrders(storeId, c.shadowCustomerId),
    listOwnedProducts(storeId, c.shadowCustomerId),
    listCustomerTickets(c.id),
  ]);
  return { customer: c, orders: ords, owned, tickets };
}

export async function listSellerTickets(storeId: string) {
  return db
    .select({ t: webSupportTickets, name: webCustomers.name, email: webCustomers.email, whatsapp: webCustomers.whatsapp, telegram: webCustomers.telegram })
    .from(webSupportTickets)
    .innerJoin(webCustomers, eq(webCustomers.id, webSupportTickets.webCustomerId))
    .where(eq(webSupportTickets.storeId, storeId))
    .orderBy(desc(webSupportTickets.createdAt))
    .limit(200);
}
