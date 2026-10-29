import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import RecebimentosClient from './RecebimentosClient';
import SetupStoreClient from "../SetupStoreClient";
import { ensurePaymentTables } from '@/db/ensure-payment-tables';
import { SellerGatewayControlService } from '@/lib/payments/seller-gateway-control-service';

export default async function RecebimentosPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Ensure DB columns & tables exist on production database (e.g. Neon)
  await ensurePaymentTables();

  let connection = null;
  let syncPayConn = null;
  let pushinPayConn = null;
  let adminControls = {
    pushinpay: { allowNewConnections: true, allowNewPayments: true },
    mercadopago: { allowNewConnections: true, allowNewPayments: true },
    syncpay: { allowNewConnections: false, allowNewPayments: false },
  };

  try {
    const controls = await SellerGatewayControlService.getAllControls();
    for (const c of controls) {
      if (c.gateway === 'pushinpay' || c.gateway === 'mercadopago' || c.gateway === 'syncpay') {
        adminControls[c.gateway] = {
          allowNewConnections: c.allowNewConnections,
          allowNewPayments: c.allowNewPayments,
        };
      }
    }
  } catch (err) {
    console.error('[RecebimentosPage] Error fetching gateway controls:', err);
  }

  try {
    // Fetch Mercado Pago Connection
    connection = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'mercado_pago')
      ),
    });
  } catch (err) {
    console.error('[RecebimentosPage] Error fetching Mercado Pago connection:', err);
  }

  try {
    // Fetch SyncPay Connection
    syncPayConn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'syncpay')
      ),
    });
  } catch (err) {
    console.error('[RecebimentosPage] Error fetching SyncPay connection:', err);
  }

  try {
    // Fetch PushinPay Connection
    pushinPayConn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });
  } catch (err) {
    console.error('[RecebimentosPage] Error fetching PushinPay connection:', err);
  }

  return (
    <RecebimentosClient 
      connection={connection ? {
        id: connection.id,
        status: connection.status,
        providerEmail: connection.providerEmail,
        providerUserId: connection.providerUserId,
        updatedAt: connection.updatedAt ? new Date(connection.updatedAt).toISOString() : null,
      } : null}
      syncPayConnection={{
        id: syncPayConn?.id || null,
        status: syncPayConn?.status || 'inactive',
        updatedAt: syncPayConn?.updatedAt ? new Date(syncPayConn.updatedAt).toISOString() : null,
      }}
      pushinPayConnection={{
        id: pushinPayConn?.id || null,
        status: pushinPayConn?.status || 'inactive',
        updatedAt: pushinPayConn?.updatedAt ? new Date(pushinPayConn.updatedAt).toISOString() : null,
      }}
      adminControls={adminControls}
    />
  );
}

