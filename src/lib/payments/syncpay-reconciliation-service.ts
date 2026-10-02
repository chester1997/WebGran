import { db } from '@/db';
import { orders, sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncPayProvider, SyncPayProvider } from './providers/syncpay';
import { AccessDeliveryService } from '@/lib/delivery/access-delivery-service';

export class SyncPayReconciliationService {
  private provider: SyncPayProvider;

  constructor() {
    this.provider = syncPayProvider;
  }

  /**
   * Reconciles all pending SyncPay orders for a store or seller by querying SyncPay API.
   */
  async reconcilePendingOrders(sellerId: string): Promise<{ checked: number; updated: number }> {
    const conn = await this.provider.getSyncPayConnection(sellerId);
    if (!conn) {
      return { checked: 0, updated: 0 };
    }

    // Find all pending orders with paymentMethod = 'syncpay'
    const pendingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending'),
        eq(orders.paymentMethod, 'syncpay')
      ),
    });

    let checked = 0;
    let updated = 0;

    for (const order of pendingOrders) {
      if (!order.paymentId) continue;
      checked++;

      try {
        const txStatus = await this.provider.getPixPaymentStatus(order.paymentId, conn.clientId, conn.clientSecret);
        if (!txStatus) continue;

        const rawStatus = String(txStatus.status || '').toLowerCase().trim();
        const isPaid = ['completed', 'paid', 'approved', 'sucesso'].includes(rawStatus);
        const isFailed = ['failed', 'refused', 'cancelled', 'canceled', 'expired'].includes(rawStatus);

        if (isPaid) {
          const updatedRows = await db.update(orders)
            .set({
              status: 'paid',
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(
              eq(orders.id, order.id),
              eq(orders.status, 'pending')
            ))
            .returning();

          if (updatedRows.length > 0) {
            updated++;
            await AccessDeliveryService.processOrderDelivery(order.id);
          }
        } else if (isFailed) {
          await db.update(orders)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
          updated++;
        }
      } catch (err) {
        console.error(`[SyncPayReconciliationService] Error reconciling order ${order.id}:`, err);
      }
    }

    return { checked, updated };
  }
}

export const syncPayReconciliationService = new SyncPayReconciliationService();
