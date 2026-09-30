import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections, orders } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import RecebimentosClient from './RecebimentosClient';

import SetupStoreClient from "../SetupStoreClient";

export default async function RecebimentosPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Fetch Mercado Pago Connection
  const connection = await db.query.sellerPaymentConnections.findFirst({
    where: and(
      eq(sellerPaymentConnections.sellerId, seller.id),
      eq(sellerPaymentConnections.provider, 'mercado_pago')
    ),
  });

  // Fetch PushinPay Connection
  const pushinPayConn = await db.query.sellerPaymentConnections.findFirst({
    where: and(
      eq(sellerPaymentConnections.sellerId, seller.id),
      eq(sellerPaymentConnections.provider, 'pushinpay')
    ),
  });

  const isPushinPayEnvActive = Boolean(process.env.PUSHINPAY_TOKEN && process.env.PUSHINPAY_TOKEN.trim());

  // Fetch Store Transactions
  const storeOrders = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
    },
  });

  // Calculate Metrics
  const paidOrders = storeOrders.filter(o => o.status === 'paid');
  const pendingOrders = storeOrders.filter(o => o.status === 'pending');

  const totalBruto = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalTaxa = paidOrders.reduce((sum, o) => sum + Number(o.platformFee || 0), 0);
  const totalLiquido = paidOrders.reduce((sum, o) => sum + Number(o.netAmount || (Number(o.total) - Number(o.platformFee || 0))), 0);

  const metrics = {
    totalBruto,
    totalTaxa,
    totalLiquido,
    paidCount: paidOrders.length,
    pendingCount: pendingOrders.length,
  };

  const formattedTransactions = storeOrders.map(o => ({
    id: o.id,
    paymentId: o.paymentId,
    customerName: o.customer?.firstName 
      ? `${o.customer.firstName} ${o.customer.lastName || ''}`.trim() 
      : o.customer?.username || 'Cliente',
    total: Number(o.total || 0),
    platformFee: Number(o.platformFee || 0),
    netAmount: Number(o.netAmount || (Number(o.total) - Number(o.platformFee || 0))),
    status: o.status,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
  }));

  return (
    <RecebimentosClient 
      connection={connection ? {
        id: connection.id,
        status: connection.status,
        providerEmail: connection.providerEmail,
        providerUserId: connection.providerUserId,
        updatedAt: connection.updatedAt ? new Date(connection.updatedAt).toISOString() : null,
      } : null}
      pushinPayConnection={{
        id: pushinPayConn?.id || null,
        status: pushinPayConn?.status || (isPushinPayEnvActive ? 'active' : 'inactive'),
        isGlobalEnvActive: isPushinPayEnvActive && !pushinPayConn,
        updatedAt: pushinPayConn?.updatedAt ? new Date(pushinPayConn.updatedAt).toISOString() : null,
      }}
      metrics={metrics}
      transactions={formattedTransactions}
    />
  );
}
