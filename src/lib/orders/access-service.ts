import { db } from "@/db";
import { accesses, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export class AccessService {
  /**
   * Grants access to a product for a customer.
   */
  static async grantAccess(storeId: string, customerId: string, productId: string, orderId?: string) {
    const existing = await db.query.accesses.findFirst({
      where: and(
        eq(accesses.customerId, customerId),
        eq(accesses.productId, productId)
      )
    });

    if (existing) {
      if (existing.status !== 'active') {
        await db.update(accesses).set({
          status: 'active',
          orderId: orderId || existing.orderId,
          grantedAt: new Date()
        }).where(eq(accesses.id, existing.id));
      }
      return existing;
    }

    const inserted = await db.insert(accesses).values({
      storeId,
      customerId,
      productId,
      orderId,
      status: 'active',
    }).returning();

    return inserted[0];
  }

  static async revokeAccess(accessId: string) {
    return db.update(accesses)
      .set({ status: 'revoked' })
      .where(eq(accesses.id, accessId))
      .returning();
  }

  static async expireAccess(accessId: string) {
    return db.update(accesses)
      .set({ status: 'expired' })
      .where(eq(accesses.id, accessId))
      .returning();
  }

  static async getCustomerAccesses(storeId: string, customerId: string) {
    return db.query.accesses.findMany({
      where: and(
        eq(accesses.storeId, storeId),
        eq(accesses.customerId, customerId),
        eq(accesses.status, 'active')
      ),
      with: {
        product: true
      },
      orderBy: (accesses, { desc }) => [desc(accesses.grantedAt)]
    });
  }
}
