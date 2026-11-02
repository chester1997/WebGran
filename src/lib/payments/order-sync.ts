import { db } from '@/db';
import { orders, stores, sellerPaymentConnections, accesses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { AccessDeliveryService } from '@/lib/delivery/access-delivery-service';

export async function syncOrderWithMercadoPago(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === 'paid') {
    const accessList = await db.query.accesses.findMany({
      where: eq(accesses.orderId, order.id),
    });
    return { success: true, status: 'paid', alreadyPaid: true, accesses: accessList };
  }

  // Support PushinPay orders
  if (order.paymentMethod === 'pushinpay') {
    const { pushinPayProvider } = await import('./providers/pushinpay');
    const pushinConn = await pushinPayProvider.getPushinPayConnection(undefined, order.storeId);
    if (pushinConn && order.paymentId) {
      const txData = await pushinPayProvider.getPixPaymentStatus(order.paymentId, pushinConn.token);
      const expectedCents = Math.round(Number(order.total) * 100);
      const isPaid = txData && String(txData.status || '').toLowerCase().trim() === 'paid';
      const idMatches = txData && String(txData.id).trim().toLowerCase() === String(order.paymentId).trim().toLowerCase();
      const valueMatches = txData && (txData.value === undefined || txData.value === null || Number(txData.value) === expectedCents);

      if (isPaid && idMatches && valueMatches) {
        const { SplitReconciliationService } = await import('./split-reconciliation-service');
        const platformAccountId = process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID?.trim() ||
          process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID?.trim() || null;

        const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
          order,
          officialTx: txData,
          platformAccountId,
        });

        let orderWasUpdated = false;

        const runSyncTx = async (tx: any) => {
          const updatePayload: Record<string, any> = {
            status: 'paid',
            splitStatus: evalResult.status,
            splitError: evalResult.splitError,
            splitDetails: evalResult.splitDetails,
            paidAt: new Date(),
            updatedAt: new Date(),
          };

          if (evalResult.platformFeeStr !== null) {
            updatePayload.platformFee = evalResult.platformFeeStr;
          }
          if (evalResult.netAmountStr !== null) {
            updatePayload.netAmount = evalResult.netAmountStr;
          }
          if (evalResult.splitConfirmedAt !== null) {
            updatePayload.splitConfirmedAt = evalResult.splitConfirmedAt;
          }

          const updatedRows = await tx.update(orders)
            .set(updatePayload)
            .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
            .returning({ id: orders.id });

          if (updatedRows && updatedRows.length > 0) {
            orderWasUpdated = true;
            if (evalResult.auditAction !== 'NONE') {
              await SplitReconciliationService.recordAuditLog({
                orderId: order.id,
                previousStatus: order.splitStatus,
                newStatus: evalResult.status,
                action: evalResult.auditAction,
                splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
                platformAccountId,
                evidenceDetails: evalResult.splitDetails,
                notes: evalResult.divergenceReason || 'Reconciliação automática via polling order-sync',
              }, tx);
            }
          }
        };

        await (db as any).transaction(runSyncTx);

        if (orderWasUpdated) {
          const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);

          if (evalResult.status === 'PROCESSED') {
            try {
              const { PlatformFinancialNotificationService } = await import('@/lib/push/platform-financial-notification-service');
              await PlatformFinancialNotificationService.notifyOwnerOfCommission({
                orderId: order.id,
                eventType: 'SPLIT_PROCESSED',
                platformFeeReais: evalResult.platformFeeStr,
                splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
              });
            } catch (notifErr) {
              console.warn('[OrderSync] Falha não bloqueante ao notificar proprietário sobre split:', notifErr);
            }
          }

          const accessList = await db.query.accesses.findMany({
            where: eq(accesses.orderId, order.id),
          });
          return { success: true, status: 'paid', paymentId: order.paymentId, accesses: accessList, deliveries: deliveryResults };
        }
      }
    }
    return { success: true, status: order.status };
  }


  // Support SyncPay orders
  if (order.paymentMethod === 'syncpay') {
    const { syncPayProvider, extractSyncPayStatus } = await import('./providers/syncpay');
    const syncConn = await syncPayProvider.getSyncPayConnection(undefined, order.storeId);
    if (syncConn) {
      const queryIds = Array.from(new Set([order.paymentId, order.id])).filter(Boolean) as string[];
      for (const queryId of queryIds) {
        if (!queryId || queryId.startsWith('sync_')) continue;
        const txStatus = await syncPayProvider.getPixPaymentStatus(queryId, syncConn.clientId, syncConn.clientSecret);
        if (txStatus) {
          const rawStatus = extractSyncPayStatus(txStatus);
          const isPaid = ['completed', 'paid', 'approved', 'sucesso'].includes(rawStatus);
          if (isPaid) {
            await db.update(orders)
              .set({
                status: 'paid',
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
            const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);
            const accessList = await db.query.accesses.findMany({
              where: eq(accesses.orderId, order.id),
            });
            return { success: true, status: 'paid', paymentId: order.paymentId, accesses: accessList, deliveries: deliveryResults };
          }
        }
      }
    }
    return { success: true, status: order.status };
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, order.storeId),
  });

  if (!store) {
    return { success: false, status: order.status, error: "Store not found" };
  }

  const conn = await db.query.sellerPaymentConnections.findFirst({
    where: and(
      eq(sellerPaymentConnections.sellerId, store.ownerId),
      eq(sellerPaymentConnections.provider, 'mercado_pago'),
      eq(sellerPaymentConnections.status, 'active')
    ),
  });

  if (!conn || !conn.accessTokenEncrypted) {
    return { success: false, status: order.status, error: "Conexão Mercado Pago ausente." };
  }

  const token = decrypt(conn.accessTokenEncrypted);

  let approvedPayment: any = null;

  // 1. Search Mercado Pago Payments API by external_reference
  try {
    const searchRes = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${order.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        approvedPayment = searchData.results.find((p: any) => p.status === 'approved' || p.status_detail === 'accredited')
          || searchData.results.find((p: any) => p.status === 'refunded' || p.status === 'cancelled' || p.status === 'rejected')
          || searchData.results[0];
      }
    }
  } catch (err) {
    console.error("[OrderSync] Erro ao buscar por external_reference:", err);
  }

  // 2. If not found by external_reference and order.paymentId exists, try GET /v1/orders/{order.paymentId} or GET /v1/payments/{order.paymentId}
  if (!approvedPayment && order.paymentId) {
    try {
      const orderMpRes = await fetch(`https://api.mercadopago.com/v1/orders/${order.paymentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (orderMpRes.ok) {
        const orderMpData = await orderMpRes.json();
        const firstTx = orderMpData.transactions?.payments?.[0];
        approvedPayment = {
          id: firstTx?.id || orderMpData.id,
          status: firstTx?.status || orderMpData.status,
          status_detail: firstTx?.status_detail || orderMpData.status_detail,
          marketplace_fee: orderMpData.marketplace_fee || 0,
          application_fee: firstTx?.application_fee || orderMpData.application_fee || 0,
          payment_method_id: firstTx?.payment_method?.id || 'pix',
          paid_amount: orderMpData.total_amount,
          charges_details: orderMpData.charges_details || firstTx?.charges_details,
          fee_details: orderMpData.fee_details || firstTx?.fee_details,
        };
      }
    } catch {
      // Non-blocking fallback
    }

    if (!approvedPayment) {
      try {
        const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${order.paymentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (payRes.ok) {
          approvedPayment = await payRes.json();
        }
      } catch {
        // Non-blocking fallback
      }
    }
  }

  if (approvedPayment) {
    const { SplitReconciliationService } = await import('./split-reconciliation-service');
    const evalResult = SplitReconciliationService.evaluateMercadoPagoSplit({
      order,
      officialTx: approvedPayment,
    });

    const isApproved = approvedPayment.status === 'approved' || approvedPayment.status_detail === 'accredited';
    const isRefunded = approvedPayment.status === 'refunded' || approvedPayment.status === 'charged_back';
    const isCancelledOrRejected = approvedPayment.status === 'cancelled' || approvedPayment.status === 'rejected';

    let orderWasUpdated = false;

    const runSyncTx = async (tx: any) => {
      const updatePayload: Record<string, any> = {
        paymentId: String(approvedPayment.id),
        paymentMethod: approvedPayment.payment_method_id || approvedPayment.payment_type_id || 'mercadopago',
        splitStatus: evalResult.status,
        splitError: evalResult.splitError,
        splitDetails: evalResult.splitDetails,
        updatedAt: new Date(),
      };

      if (isApproved && order.status === 'pending') {
        updatePayload.status = 'paid';
        updatePayload.paidAt = new Date();
      } else if (isRefunded && order.status !== 'refunded') {
        updatePayload.status = 'refunded';
      } else if (isCancelledOrRejected && order.status === 'pending') {
        updatePayload.status = 'cancelled';
      }

      if (evalResult.platformFeeStr !== null) {
        updatePayload.platformFee = evalResult.platformFeeStr;
      }
      if (evalResult.netAmountStr !== null) {
        updatePayload.netAmount = evalResult.netAmountStr;
      }
      if (evalResult.splitConfirmedAt !== null) {
        updatePayload.splitConfirmedAt = evalResult.splitConfirmedAt;
      }

      const updatedRows = await tx.update(orders)
        .set(updatePayload)
        .where(eq(orders.id, order.id))
        .returning({ id: orders.id });

      if (updatedRows && updatedRows.length > 0) {
        orderWasUpdated = true;
        if (evalResult.auditAction !== 'NONE') {
          await SplitReconciliationService.recordAuditLog({
            orderId: order.id,
            previousStatus: order.splitStatus,
            newStatus: evalResult.status,
            action: evalResult.auditAction,
            splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
            evidenceDetails: evalResult.splitDetails,
            notes: evalResult.divergenceReason || 'Reconciliação automática via polling/webhook Mercado Pago',
          }, tx);
        }
      }
    };

    await (db as any).transaction(runSyncTx);

    if (orderWasUpdated && isApproved && order.status === 'pending') {
      const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);

      if (evalResult.status === 'PROCESSED' || evalResult.status === 'CONFIRMED') {
        try {
          const { PlatformFinancialNotificationService } = await import('@/lib/push/platform-financial-notification-service');
          await PlatformFinancialNotificationService.notifyOwnerOfCommission({
            orderId: order.id,
            eventType: 'SPLIT_PROCESSED',
            platformFeeReais: evalResult.platformFeeStr || '0.50',
            splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
          });
        } catch (notifErr) {
          console.warn('[OrderSync] Falha não bloqueante ao notificar sobre comissão MP:', notifErr);
        }
      }

      const accessList = await db.query.accesses.findMany({
        where: eq(accesses.orderId, order.id),
      });

      return {
        success: true,
        status: 'paid',
        paymentId: String(approvedPayment.id),
        accesses: accessList,
        deliveries: deliveryResults,
      };
    }

    const currentStatus = isApproved ? 'paid' : (isRefunded ? 'refunded' : (isCancelledOrRejected ? 'cancelled' : order.status));
    return { success: true, status: currentStatus, paymentId: String(approvedPayment.id) };
  }

  return { success: true, status: order.status };
}
