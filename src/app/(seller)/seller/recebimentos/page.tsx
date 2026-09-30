import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    />
  );
}
