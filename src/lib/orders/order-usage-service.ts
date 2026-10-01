import { db } from "@/db";
import { orders, stores } from "@/db/schema";
import { eq, and, gte, lt, inArray, count } from "drizzle-orm";

/**
 * Computes the total number of orders created for a seller within the current calendar month.
 * Period: First day of current month 00:00:00.000 up to first day of next month 00:00:00.000.
 */
export async function getMonthlyOrderUsage(sellerId: string, referenceDate: Date = new Date()): Promise<number> {
  if (!sellerId) return 0;

  // 1. Get all stores owned by the seller
  const sellerStores = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.ownerId, sellerId));

  if (!sellerStores || sellerStores.length === 0) {
    return 0;
  }

  const storeIds = sellerStores.map((s) => s.id);

  // 2. Compute start of current calendar month & start of next calendar month
  const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1, 0, 0, 0, 0);

  // 3. Count all orders created within this calendar month for these stores
  const [result] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        inArray(orders.storeId, storeIds),
        gte(orders.createdAt, startOfMonth),
        lt(orders.createdAt, startOfNextMonth)
      )
    );

  return result?.value ?? 0;
}
