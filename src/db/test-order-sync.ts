import 'dotenv/config';
import { db } from './index';
import { orders, stores, sellerPaymentConnections } from './schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../lib/encryption';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';

export async function syncOrderWithMercadoPago(orderId: string) {
  console.log(`[OrderSync] Sincronizando pedido ${orderId}...`);

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === 'paid') {
    console.log(`[OrderSync] Pedido ${orderId} já está como PAID.`);
    return { success: true, status: 'paid', alreadyPaid: true };
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, order.storeId),
  });

  if (!store) {
    throw new Error(`Store ${order.storeId} not found`);
  }

  const conn = await db.query.sellerPaymentConnections.findFirst({
    where: and(
      eq(sellerPaymentConnections.sellerId, store.ownerId),
      eq(sellerPaymentConnections.provider, 'mercado_pago'),
      eq(sellerPaymentConnections.status, 'active')
    ),
  });

  if (!conn || !conn.accessTokenEncrypted) {
    console.warn(`[OrderSync] Vendedor sem conexão ativa com o Mercado Pago.`);
    return { success: false, error: "Conexão Mercado Pago ausente." };
  }

  const token = decrypt(conn.accessTokenEncrypted);

  // 1. Tentar buscar por external_reference na Search Payments API do MP
  const searchRes = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${order.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  let approvedPayment: any = null;

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.results && searchData.results.length > 0) {
      approvedPayment = searchData.results.find((p: any) => p.status === 'approved' || p.status_detail === 'accredited');
    }
  }

  // 2. Se não encontrou por external_reference e tem paymentId (ex: Order MP), tentar GET /v1/orders/{order.paymentId}
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
    } catch (e: any) {
      console.error("[OrderSync] Erro ao consultar /v1/orders no MP:", e.message);
    }
  }

  if (approvedPayment) {
    console.log(`[OrderSync] Pagamento aprovado localizado no Mercado Pago! PaymentId: ${approvedPayment.id}`);

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

    // Entregar Acessos
    const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);
    console.log(`[OrderSync] Entrega de acessos concluída:`, JSON.stringify(deliveryResults, null, 2));

    return {
      success: true,
      status: 'paid',
      paymentId: String(approvedPayment.id),
      deliveries: deliveryResults
    };
  }

  console.log(`[OrderSync] Pedido ${orderId} ainda não foi pago no Mercado Pago.`);
  return { success: true, status: 'pending' };
}

// If run directly as a script
if (require.main === module) {
  const targetOrderId = "f6b32494-c53e-464b-97e3-de2e8dc9c80b";
  syncOrderWithMercadoPago(targetOrderId)
    .then((res) => console.log("SYNC RESULT:", JSON.stringify(res, null, 2)))
    .catch(console.error)
    .finally(() => process.exit(0));
}
