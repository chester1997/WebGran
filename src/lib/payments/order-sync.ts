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
        approvedPayment = searchData.results.find((p: any) => p.status === 'approved' || p.status_detail === 'accredited');
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
        if (orderMpData.status === 'processed' || orderMpData.status === 'approved') {
          const firstTx = orderMpData.transactions?.payments?.[0];
          approvedPayment = {
            id: firstTx?.id || orderMpData.id,
            status: 'approved',
            marketplace_fee: orderMpData.marketplace_fee || 0,
            payment_method_id: firstTx?.payment_method?.id || 'pix',
            paid_amount: orderMpData.total_amount
          };
        }
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
          const payData = await payRes.json();
          if (payData.status === 'approved' || payData.status_detail === 'accredited') {
            approvedPayment = payData;
          }
        }
      } catch {
        // Non-blocking fallback
      }
    }
  }

  if (approvedPayment) {
    const totalNum = Number(order.total);
    let platformFeeNum = 0;
    let splitStatus: 'CONFIRMED' | 'REQUESTED' | 'FAILED' | 'SKIPPED' = 'REQUESTED';
    let splitConfirmedAt: Date | null = null;

    if (totalNum < 0.50 || order.splitStatus === 'SKIPPED') {
      splitStatus = 'SKIPPED';
      platformFeeNum = 0;
    } else {
      // Check official fee evidence in approvedPayment (charges_details, fee_details or marketplace_fee)
      const officialMpFee = Number(approvedPayment.marketplace_fee || 0);
      const hasFeeEvidence = officialMpFee > 0 || (
        approvedPayment.charges_details && 
        Array.isArray(approvedPayment.charges_details) &&
        approvedPayment.charges_details.some((c: any) => c.type === 'marketplace_fee' || c.type === 'application_fee')
      );

      if (hasFeeEvidence || officialMpFee >= 0.50) {
        platformFeeNum = 0.50;
        splitStatus = 'CONFIRMED';
        splitConfirmedAt = new Date();
      } else {
        // If marketplace_fee evidence is not yet confirmed by API, keep as REQUESTED without premature revenue recognition
        platformFeeNum = 0;
        splitStatus = 'REQUESTED';
      }
    }

    const netAmountNum = Math.max(0, totalNum - platformFeeNum);

    await db.update(orders)
      .set({
        status: 'paid',
        paymentId: String(approvedPayment.id),
        paymentMethod: approvedPayment.payment_method_id || approvedPayment.payment_type_id || 'pix',
        platformFee: platformFeeNum.toFixed(2),
        netAmount: netAmountNum.toFixed(2),
        splitStatus,
        splitConfirmedAt,
        splitDetails: approvedPayment.charges_details || approvedPayment.fee_details || null,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    // Delegate Access Delivery
    const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);

    const accessList = await db.query.accesses.findMany({
      where: eq(accesses.orderId, order.id),
    });

    return {
      success: true,
      status: 'paid',
      paymentId: String(approvedPayment.id),
      accesses: accessList,
      deliveries: deliveryResults
    };
  }

  return { success: true, status: order.status };
}
