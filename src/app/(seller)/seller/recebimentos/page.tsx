import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections, orders } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import RecebimentosClient from './RecebimentosClient';

export default async function RecebimentosPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return (
      <div className="p-8 text-zinc-400">
        Nenhuma loja encontrada para esta conta.
      </div>
    );
  }

  // Fetch Mercado Pago Connection
  const connection = await db.query.sellerPaymentConnections.findFirst({
    where: eq(sellerPaymentConnections.sellerId, seller.id),
  });

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
      metrics={metrics}
      transactions={formattedTransactions}
    />
  );
}
