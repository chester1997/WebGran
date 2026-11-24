import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { eq, desc, sql, and, notLike } from "drizzle-orm";
import { orders } from "@/db/schema";
import { CustomerBlockService } from "@/lib/customers/customer-block-service";
import CustomersClient from "./CustomersClient";
import CustomersClientV2 from "./CustomersClientV2";
import { isOwnerAccount } from "@/lib/auth/owner-access";

import SetupStoreClient from "../SetupStoreClient";

export default async function CustomersPage() {
  await connection();
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const items = await db.query.telegramCustomers.findMany({
    // Clientes da Loja Web (telegram_user_id 'web:<id>') têm aba própria.
    where: and(eq(telegramCustomers.storeId, store.id), notLike(telegramCustomers.telegramUserId, 'web:%')),
    orderBy: [desc(telegramCustomers.createdAt)]
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total: items.length,
    newThisMonth: items.filter(c => new Date(c.createdAt) >= startOfMonth).length,
    withUsername: items.filter(c => Boolean(c.username)).length
  };

  const formattedCustomers = items.map(c => ({
    id: c.id,
    telegramUserId: c.telegramUserId,
    username: c.username,
    firstName: c.firstName,
    lastName: c.lastName,
    photoUrl: c.photoUrl,
    languageCode: c.languageCode,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
  }));

  // Redesign V2: só a conta proprietária vê; lojistas continuam na versão clássica.
  if (isOwnerAccount(seller)) {
    // Compras por cliente e bloqueios: consultas extras só da versão V2, com fallback seguro.
    const [purchaseRows, blockInfo] = await Promise.all([
      db
        .select({
          customerId: orders.customerId,
          paidCount: sql<number>`count(*) filter (where ${orders.status} = 'paid')`.mapWith(Number),
          paidTotal: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'paid'), 0)`,
          lastPaidAt: sql<string | null>`max(coalesce(${orders.paidAt}, ${orders.createdAt})) filter (where ${orders.status} = 'paid')`,
        })
        .from(orders)
        .where(eq(orders.storeId, store.id))
        .groupBy(orders.customerId)
        .catch((err) => {
          console.error("[SELLER_CUSTOMERS] Falha ao carregar compras por cliente:", err?.message);
          return [] as { customerId: string; paidCount: number; paidTotal: string; lastPaidAt: string | null }[];
        }),
      CustomerBlockService.listBlocks(store.id),
    ]);

    const purchases: Record<string, { paidCount: number; paidTotal: number; lastPaidAt: string | null }> = {};
    for (const r of purchaseRows) {
      purchases[r.customerId] = {
        paidCount: Number(r.paidCount) || 0,
        paidTotal: Number(r.paidTotal) || 0,
        lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt).toISOString() : null,
      };
    }
    const blocked: Record<string, { reason: string | null; blockedAt: string }> = {};
    for (const b of blockInfo.blocks) blocked[b.telegramUserId] = { reason: b.reason, blockedAt: b.blockedAt };

    return (
      <CustomersClientV2
        customers={formattedCustomers}
        stats={stats}
        purchases={purchases}
        blocked={blocked}
        blockingAvailable={blockInfo.available}
      />
    );
  }

  return (
    <CustomersClient 
      customers={formattedCustomers}
      stats={stats}
    />
  );
}
