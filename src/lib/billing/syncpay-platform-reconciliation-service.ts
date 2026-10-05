import { db } from '@/db';
import { subscriptions, invoices, videoLibrarySubscriptions } from '@/db/schema';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { SyncPayPlatformBillingService } from './syncpay-platform-billing-service';

export interface ReconciliationResult {
  subscriptionId: string;
  previousStatus: string;
  newStatus: string;
  synced: boolean;
  error?: string;
}

export class SyncPayPlatformBillingReconciliationService {
  /**
   * Maps SyncPay status strings to WebGran local subscription status enum values.
   */
  static mapStatus(remoteStatus: string): 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' {
    const s = (remoteStatus || '').toLowerCase().trim();
    switch (s) {
      case 'active':
      case 'paid':
      case 'ativado':
        return 'ACTIVE';
      case 'overdue':
      case 'past_due':
      case 'em_atraso':
      case 'atrasada':
        return 'PAST_DUE';
      case 'suspended':
      case 'suspenso':
      case 'suspensa':
        return 'SUSPENDED';
      case 'cancelled':
      case 'canceled':
      case 'cancelado':
      case 'cancelada':
        return 'CANCELLED';
      case 'pending_first_payment':
      case 'pending':
      case 'aguardando_pagamento':
      default:
        return 'PENDING';
    }
  }

  /**
   * Reconciles a single subscription using its syncpaySubscriptionToken.
   */
  static async reconcileByToken(syncpaySubscriptionToken: string): Promise<ReconciliationResult> {
    const localSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.syncpaySubscriptionToken, syncpaySubscriptionToken),
    });

    if (localSub) {
      return this.reconcileSubscriptionRecord(localSub);
    }

    // Check videoLibrarySubscriptions table
    const videoSub = await db.query.videoLibrarySubscriptions.findFirst({
      where: eq(videoLibrarySubscriptions.syncpaySubscriptionToken, syncpaySubscriptionToken),
    });

    if (videoSub) {
      return this.reconcileVideoSubscriptionRecord(videoSub);
    }

    return {
      subscriptionId: 'unknown',
      previousStatus: 'UNKNOWN',
      newStatus: 'UNKNOWN',
      synced: false,
      error: `Assinatura não encontrada no banco local para o token SyncPay ${syncpaySubscriptionToken}`,
    };
  }

  static async reconcileVideoSubscriptionRecord(videoSub: any): Promise<ReconciliationResult> {
    const token = videoSub.syncpaySubscriptionToken;
    if (!token) {
      return {
        subscriptionId: videoSub.id,
        previousStatus: videoSub.status,
        newStatus: videoSub.status,
        synced: false,
        error: 'Assinatura de vídeo não possui syncpaySubscriptionToken vinculada.',
      };
    }

    try {
      const res = await SyncPayPlatformBillingService.getSubscription(token);
      const data = res?.data || res;
      const remoteStatus = data?.status || data?.subscription?.status || 'pending_first_payment';
      const mappedStatus = this.mapStatus(remoteStatus);

      const now = new Date();
      let currentPeriodStart = videoSub.currentPeriodStart;
      let currentPeriodEnd = videoSub.currentPeriodEnd;

      const periodStartRemote = data?.current_period_start || data?.cycle_start || data?.started_at;
      const periodEndRemote = data?.current_period_end || data?.due_date || data?.next_billing_date;

      if (periodStartRemote) {
        currentPeriodStart = new Date(periodStartRemote);
      }
      if (periodEndRemote) {
        currentPeriodEnd = new Date(periodEndRemote);
      } else if (mappedStatus === 'ACTIVE' && videoSub.status !== 'ACTIVE') {
        currentPeriodStart = now;
        currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      await db
        .update(videoLibrarySubscriptions)
        .set({
          status: mappedStatus,
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: now,
        })
        .where(eq(videoLibrarySubscriptions.id, videoSub.id));

      return {
        subscriptionId: videoSub.id,
        previousStatus: videoSub.status,
        newStatus: mappedStatus,
        synced: true,
      };
    } catch (err: any) {
      console.error(`[Reconciliation] Erro ao reconciliar assinatura de vídeo ${videoSub.id}:`, err);
      return {
        subscriptionId: videoSub.id,
        previousStatus: videoSub.status,
        newStatus: videoSub.status,
        synced: false,
        error: err.message || 'Erro ao consultar API da SyncPay',
      };
    }
  }

  /**
   * Reconciles a local subscription database record with SyncPay API.
   */
  static async reconcileSubscriptionRecord(localSub: any): Promise<ReconciliationResult> {
    const token = localSub.syncpaySubscriptionToken;
    if (!token) {
      return {
        subscriptionId: localSub.id,
        previousStatus: localSub.status,
        newStatus: localSub.status,
        synced: false,
        error: 'Assinatura local não possui syncpaySubscriptionToken vinculada.',
      };
    }

    try {
      const res = await SyncPayPlatformBillingService.getSubscription(token);
      const data = res?.data || res;
      const remoteStatus = data?.status || data?.subscription?.status || 'pending_first_payment';
      const mappedStatus = this.mapStatus(remoteStatus);

      const now = new Date();
      let currentPeriodStart = localSub.currentPeriodStart;
      let currentPeriodEnd = localSub.currentPeriodEnd;

      // Extract cycle dates if provided by SyncPay
      const periodStartRemote = data?.current_period_start || data?.cycle_start || data?.started_at;
      const periodEndRemote = data?.current_period_end || data?.due_date || data?.next_billing_date;

      if (periodStartRemote) {
        currentPeriodStart = new Date(periodStartRemote);
      }
      if (periodEndRemote) {
        currentPeriodEnd = new Date(periodEndRemote);
      } else if (mappedStatus === 'ACTIVE' && localSub.status !== 'ACTIVE') {
        // If activated and no end date given, grant 30 days
        currentPeriodStart = now;
        currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Update database if status or period changed
      await db
        .update(subscriptions)
        .set({
          status: mappedStatus,
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, localSub.id));

      // Reconcile invoices if a charge was paid
      const charges = data?.charges || data?.history || [];
      const paidCharge = charges.find((c: any) => (c.status || '').toLowerCase() === 'paid');
      if (paidCharge) {
        const latestInvoice = await db.query.invoices.findFirst({
          where: and(
            eq(invoices.subscriptionId, localSub.id),
            eq(invoices.status, 'PENDING')
          ),
        });

        if (latestInvoice) {
          const paidAtDate = paidCharge.paid_at ? new Date(paidCharge.paid_at) : now;
          await db
            .update(invoices)
            .set({
              status: 'PAID',
              paidAt: paidAtDate,
              updatedAt: now,
            })
            .where(eq(invoices.id, latestInvoice.id));
        }
      }

      return {
        subscriptionId: localSub.id,
        previousStatus: localSub.status,
        newStatus: mappedStatus,
        synced: true,
      };
    } catch (err: any) {
      console.error(`[Reconciliation] Erro ao reconciliar assinatura ${localSub.id}:`, err);
      return {
        subscriptionId: localSub.id,
        previousStatus: localSub.status,
        newStatus: localSub.status,
        synced: false,
        error: err.message || 'Erro ao consultar API da SyncPay',
      };
    }
  }

  /**
   * Reconciles all local subscriptions that possess a syncpaySubscriptionToken.
   */
  static async reconcileAll(): Promise<ReconciliationResult[]> {
    const list = await db.query.subscriptions.findMany({
      where: isNotNull(subscriptions.syncpaySubscriptionToken),
    });

    const results: ReconciliationResult[] = [];
    for (const sub of list) {
      const res = await this.reconcileSubscriptionRecord(sub);
      results.push(res);
    }

    return results;
  }
}
