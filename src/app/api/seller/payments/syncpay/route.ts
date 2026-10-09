import { NextRequest, NextResponse } from 'next/server';
import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { syncPayProvider } from '@/lib/payments/providers/syncpay';
import { hasFeature } from '@/lib/entitlements/entitlement-service';
import { ensurePaymentTables } from '@/db/ensure-payment-tables';

export async function GET() {
  try {
    await ensurePaymentTables();
    const seller = await requireSeller();

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'syncpay')
      ),
    });

    if (!conn) {
      return NextResponse.json({
        success: true,
        isConnected: false,
        connection: null,
      });
    }

    let clientIdMasked = '';
    if (conn.accessTokenEncrypted) {
      try {
        const rawClientId = decrypt(conn.accessTokenEncrypted);
        if (rawClientId && rawClientId.length > 8) {
          clientIdMasked = `${rawClientId.slice(0, 4)}...${rawClientId.slice(-4)}`;
        } else if (rawClientId) {
          clientIdMasked = `${rawClientId.slice(0, 2)}***`;
        }
      } catch {
        clientIdMasked = 'Configurado';
      }
    }

    return NextResponse.json({
      success: true,
      isConnected: conn.status === 'active',
      connection: {
        id: conn.id,
        status: conn.status,
        clientIdMasked,
        hasCredentials: !!conn.accessTokenEncrypted,
        updatedAt: conn.updatedAt ? new Date(conn.updatedAt).toISOString() : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar dados da SyncPay.' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    // 1. Check entitlement: payment_gateways_enabled
    const isAllowed = await hasFeature(seller.id, 'payment_gateways_enabled');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Seu plano atual não permite integrar gateways de pagamento.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Action: Test Connection
    if (body.action === 'test') {
      const conn = await syncPayProvider.getSyncPayConnection(seller.id);
      if (!conn) {
        return NextResponse.json({ success: false, message: 'SyncPay não configurado para este vendedor.' }, { status: 400 });
      }
      const testRes = await syncPayProvider.testConnection(conn.clientId, conn.clientSecret);
      return NextResponse.json(testRes);
    }

    // Action: Connect / Update Credentials
    let { clientId, clientSecret } = body;

    let conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'syncpay')
      ),
    });

    // If client provided blank fields while connection exists with stored credentials, preserve current encrypted credentials
    if ((!clientId?.trim() || !clientSecret?.trim()) && conn && conn.accessTokenEncrypted) {
      clientId = clientId?.trim() || decrypt(conn.accessTokenEncrypted);
      clientSecret = clientSecret?.trim() || (conn.refreshTokenEncrypted ? decrypt(conn.refreshTokenEncrypted) : '');
    }

    if (!clientId?.trim() || !clientSecret?.trim()) {
      return NextResponse.json({ error: 'Client ID e Client Secret são obrigatórios.' }, { status: 400 });
    }

    // 2. Validate Credentials Server-Side
    const testRes = await syncPayProvider.testConnection(clientId.trim(), clientSecret.trim());
    if (!testRes.success) {
      return NextResponse.json({ error: testRes.message }, { status: 400 });
    }

    const clientIdEncrypted = encrypt(clientId.trim());
    const clientSecretEncrypted = encrypt(clientSecret.trim());

    if (conn) {
      const [updated] = await db.update(sellerPaymentConnections)
        .set({
          storeId: store?.id || conn.storeId,
          accessTokenEncrypted: clientIdEncrypted,
          refreshTokenEncrypted: clientSecretEncrypted,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(sellerPaymentConnections.id, conn.id))
        .returning();
      conn = updated;
    } else {
      const [inserted] = await db.insert(sellerPaymentConnections)
        .values({
          sellerId: seller.id,
          storeId: store?.id || null,
          provider: 'syncpay',
          accessTokenEncrypted: clientIdEncrypted,
          refreshTokenEncrypted: clientSecretEncrypted,
          status: 'active',
        })
        .returning();
      conn = inserted;
    }

    // 4. Register Webhook for this Connection
    const { webhookId, webhookSecret } = await syncPayProvider.registerWebhook(clientId.trim(), clientSecret.trim(), conn.id);
    const webhookSecretEncrypted = encrypt(webhookSecret);

    await db.update(sellerPaymentConnections)
      .set({
        webhookId: webhookId || null,
        webhookSecretEncrypted,
        updatedAt: new Date(),
      })
      .where(eq(sellerPaymentConnections.id, conn.id));

    const rawClientId = clientId.trim();
    const clientIdMasked = rawClientId.length > 8 ? `${rawClientId.slice(0, 4)}...${rawClientId.slice(-4)}` : `${rawClientId.slice(0, 2)}***`;

    return NextResponse.json({
      success: true,
      message: 'SyncPay conectado e configurado com sucesso!',
      connection: {
        id: conn.id,
        status: 'active',
        clientIdMasked,
        hasCredentials: true,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[SyncPayAPI] Error setting up SyncPay:', err);
    return NextResponse.json({ error: err.message || 'Erro ao configurar SyncPay.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const seller = await requireSeller();

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'syncpay')
      ),
    });

    if (!conn) {
      return NextResponse.json({ error: 'Nenhuma conexão SyncPay encontrada.' }, { status: 404 });
    }

    // Soft delete: update status to inactive (preserves transactions/orders history)
    await db.update(sellerPaymentConnections)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(sellerPaymentConnections.id, conn.id));

    return NextResponse.json({
      success: true,
      message: 'Integração SyncPay desativada com sucesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao desconectar SyncPay.' }, { status: 500 });
  }
}
