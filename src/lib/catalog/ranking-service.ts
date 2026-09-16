import { db } from "@/db";
import { products, orders, orderItems } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { subDays, subMonths } from "date-fns";

export type RankingPeriod = 'week' | 'month' | 'all';

export class RankingService {
  /**
   * Retrieves the top 10 most sold products for a store within a given period.
   * Based entirely on 'paid' orders to prevent manipulation.
   */
  static async getTopProducts(storeId: string, period: RankingPeriod = 'week') {
    let dateFilter;
    const now = new Date();

    if (period === 'week') {
      dateFilter = gte(orders.createdAt, subDays(now, 7));
    } else if (period === 'month') {
      dateFilter = gte(orders.createdAt, subMonths(now, 1));
    }

    const conditions = [
      eq(orders.storeId, storeId),
      eq(orders.status, 'paid'),
      eq(products.status, 'active')
    ];

    if (dateFilter) {
      conditions.push(dateFilter);
    }

    const topSellers = await db
      .select({
        product: products,
        salesCount: sql<number>`count(${orderItems.id})`
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.id)
      .orderBy(desc(sql`count(${orderItems.id})`))
      .limit(10);

    // Return just the array of products, optionally injecting the rank or salesCount if needed.
    // For standard Theme usage, returning the product object array is best.
    return topSellers.map((ts, index) => ({
      ...ts.product,
      rank: index + 1,
      salesCount: Number(ts.salesCount)
    }));
  }
}
