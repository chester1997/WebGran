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
      checked++;

      try {
        const { extractSyncPayStatus } = await import('./providers/syncpay');
        const queryIds = Array.from(new Set([order.paymentId, order.id])).filter(Boolean) as string[];

        for (const queryId of queryIds) {
          if (!queryId || queryId.startsWith('sync_')) continue;
          const txStatus = await this.provider.getPixPaymentStatus(queryId, conn.clientId, conn.clientSecret);
          if (!txStatus) continue;

          const rawStatus = extractSyncPayStatus(txStatus);
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
            break;
          } else if (isFailed) {
            await db.update(orders)
              .set({ status: 'failed', updatedAt: new Date() })
              .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
            updated++;
            break;
          }
        }
      } catch (err) {
        console.error(`[SyncPayReconciliationService] Error reconciling order ${order.id}:`, err);
      }
    }

    return { checked, updated };
  }
}

export const syncPayReconciliationService = new SyncPayReconciliationService();
