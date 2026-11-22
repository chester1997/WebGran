import { db } from "@/db";
import { orders, plaqueRedemptions, stores } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

/** Faturamento acumulado (pedidos pagos) da loja — mesma conta do card da lateral. */
export async function getStorePaidRevenue(storeId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(cast(${orders.total} as numeric)), 0)` })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "paid")));
  return Number(row?.total || 0);
}

/** A tabela ainda não existe (migração 0027 não rodou). */
export function isMissingRedemptionsTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } } | null;
  const code = e?.code || e?.cause?.code;
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return code === "42P01" || (/plaque_redemptions/.test(msg) && /does not exist|não existe/i.test(msg));
}

export type RedemptionRow = typeof plaqueRedemptions.$inferSelect;

/** Pedidos da loja. tableReady=false quando a migração ainda não rodou. */
export async function listStoreRedemptions(storeId: string): Promise<{ tableReady: boolean; rows: RedemptionRow[] }> {
  try {
    const rows = await db
      .select()
      .from(plaqueRedemptions)
      .where(eq(plaqueRedemptions.storeId, storeId))
      .orderBy(desc(plaqueRedemptions.createdAt));
    return { tableReady: true, rows };
  } catch (err) {
    if (isMissingRedemptionsTable(err)) return { tableReady: false, rows: [] };
    throw err;
  }
}

/** Todos os pedidos (admin), com o nome da loja. */
export async function listAllRedemptions(): Promise<{
  tableReady: boolean;
  rows: (RedemptionRow & { storeName: string | null })[];
}> {
  try {
    const rows = await db
      .select({ r: plaqueRedemptions, storeName: stores.name })
      .from(plaqueRedemptions)
      .leftJoin(stores, eq(stores.id, plaqueRedemptions.storeId))
      .orderBy(desc(plaqueRedemptions.createdAt));
    return { tableReady: true, rows: rows.map(({ r, storeName }) => ({ ...r, storeName })) };
  } catch (err) {
    if (isMissingRedemptionsTable(err)) return { tableReady: false, rows: [] };
    throw err;
  }
}
