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
    const platformFeeNum = Number(approvedPayment.marketplace_fee || (totalNum * 0.1));
    const netAmountNum = totalNum - platformFeeNum;

    await db.update(orders)
      .set({
        status: 'paid',
        paymentId: String(approvedPayment.id),
        paymentMethod: approvedPayment.payment_method_id || approvedPayment.payment_type_id || 'pix',
        platformFee: platformFeeNum.toFixed(2),
        netAmount: netAmountNum.toFixed(2),
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
