import { db } from "@/db";
import { accesses, products } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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
      if (existing.status !== 'ACTIVE') {
        await db.update(accesses).set({
          status: 'ACTIVE',
          deliveryStatus: 'DELIVERED',
          orderId: orderId || existing.orderId,
          grantedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(accesses.id, existing.id));
      }
      return existing;
    }

    const inserted = await db.insert(accesses).values({
      storeId,
      customerId,
      productId,
      orderId,
      status: 'ACTIVE',
      deliveryStatus: 'DELIVERED',
    }).returning();

    return inserted[0];
  }

  static async revokeAccess(accessId: string) {
    return db.update(accesses)
      .set({ status: 'REVOKED', updatedAt: new Date() })
      .where(eq(accesses.id, accessId))
      .returning();
  }

  static async expireAccess(accessId: string) {
    return db.update(accesses)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(eq(accesses.id, accessId))
      .returning();
  }

  static async getCustomerAccesses(storeId: string, customerId: string) {
    return db.query.accesses.findMany({
      where: and(
        eq(accesses.storeId, storeId),
        eq(accesses.customerId, customerId),
        inArray(accesses.status, ['ACTIVE', 'PENDING', 'FAILED'])
      ),
      with: {
        product: true,
        order: true,
      },
      orderBy: (accesses, { desc }) => [desc(accesses.createdAt)]
    });
  }
}
