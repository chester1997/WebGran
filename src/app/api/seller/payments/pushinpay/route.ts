import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';
import { hasFeature } from '@/lib/entitlements/entitlement-service';
import { ensurePaymentTables } from '@/db/ensure-payment-tables';
import { SellerGatewayControlService } from '@/lib/payments/seller-gateway-control-service';

export async function GET() {
  try {
    await ensurePaymentTables();
    const seller = await requireSeller();

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    if (!conn) {
      return NextResponse.json({
        success: true,
        isConnected: false,
        connection: null,
      });
    }

    let tokenMasked = '';
    if (conn.accessTokenEncrypted) {
      try {
        const rawToken = decrypt(conn.accessTokenEncrypted);
        if (rawToken && rawToken.length > 8) {
          tokenMasked = `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}`;
        } else if (rawToken) {
          tokenMasked = `${rawToken.slice(0, 2)}***`;
        }
      } catch {
        tokenMasked = 'Configurado';
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/pushinpay/${conn.id}`;

    const hasWebhookSecret = !!conn.webhookSecretEncrypted;
    const webhookSecretMasked = hasWebhookSecret ? '••••••••' : null;

    return NextResponse.json({
      success: true,
      isConnected: conn.status === 'active',
      connection: {
        id: conn.id,
        status: conn.status,
        accountId: conn.accountId || null,
        tokenMasked,
        webhookUrl,
        hasWebhookSecret,
        webhookSecretMasked,
        hasCredentials: !!conn.accessTokenEncrypted,
        updatedAt: conn.updatedAt ? new Date(conn.updatedAt).toISOString() : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar dados da PushinPay.' }, { status: 401 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    // 1. Check entitlement
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
      let tokenToTest = body.token?.trim();
      if (!tokenToTest) {
        const conn = await pushinPayProvider.getPushinPayConnection(seller.id);
        if (!conn) {
          return NextResponse.json({ success: false, message: 'PushinPay não configurada para este vendedor.' }, { status: 400 });
        }
        tokenToTest = conn.token;
      }

      const testRes = await pushinPayProvider.testConnection(tokenToTest);
      return NextResponse.json(testRes);
    }

    // Action: Connect / Save Token
    const isConnAllowed = await SellerGatewayControlService.isConnectionAllowed('pushinpay');
    if (!isConnAllowed) {
      return NextResponse.json(
        { error: 'Novas conexões via PushinPay foram desativadas temporariamente pela administração da plataforma.' },
        { status: 403 }
      );
    }

    let { token } = body;

    let conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    // If seller submitted blank token while connection exists with saved credentials, preserve current encrypted token
    if (!token?.trim() && conn && conn.accessTokenEncrypted) {
      token = decrypt(conn.accessTokenEncrypted);
    }

    if (!token?.trim()) {
      return NextResponse.json({ error: 'O Token da API PushinPay é obrigatório.' }, { status: 400 });
    }

    // 2. Validate Token Server-Side
    const testRes = await pushinPayProvider.testConnection(token.trim());
    if (!testRes.success) {
      return NextResponse.json({ error: testRes.message }, { status: 400 });
    }

    // 3. Resolve user/account information from PushinPay (without treating user ID as account ID)
    const accountRes = await pushinPayProvider.getAccountUser(token.trim()).catch(() => null);
    const resolvedAccountId = (body.accountId && typeof body.accountId === 'string' && body.accountId.trim())
      ? body.accountId.trim()
      : (accountRes?.accountId || conn?.accountId || null);

    const tokenEncrypted = encrypt(token.trim());
    let webhookSecretEncrypted = conn?.webhookSecretEncrypted || null;
    if (body.webhookSecret && typeof body.webhookSecret === 'string' && body.webhookSecret.trim()) {
      webhookSecretEncrypted = encrypt(body.webhookSecret.trim());
    }

    if (conn) {
      const [updated] = await db.update(sellerPaymentConnections)
        .set({
          storeId: store?.id || conn.storeId,
          accessTokenEncrypted: tokenEncrypted,
          webhookSecretEncrypted,
          accountId: resolvedAccountId,
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
          provider: 'pushinpay',
          accessTokenEncrypted: tokenEncrypted,
          webhookSecretEncrypted,
          accountId: resolvedAccountId,
          status: 'active',
        })
        .returning();
      conn = inserted;
    }

    const rawToken = token.trim();
    const tokenMasked = rawToken.length > 8 ? `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}` : `${rawToken.slice(0, 2)}***`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/pushinpay/${conn.id}`;

    return NextResponse.json({
      success: true,
      message: 'PushinPay conectada e configurada com sucesso!',
      connection: {
        id: conn.id,
        status: 'active',
        tokenMasked,
        webhookUrl,
        hasWebhookSecret: !!webhookSecretEncrypted,
        webhookSecretMasked: webhookSecretEncrypted ? '••••••••' : null,
        hasCredentials: true,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (err: any) {
    console.error('[PushinPayAPI] Error setting up PushinPay:', err);
    return NextResponse.json({ error: err.message || 'Erro ao configurar PushinPay.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const seller = await requireSeller();

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    if (!conn) {
      return NextResponse.json({ error: 'Nenhuma conexão PushinPay encontrada.' }, { status: 404 });
    }

    // Soft delete: update status to inactive (preserves orders and transactions history)
    await db.update(sellerPaymentConnections)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(sellerPaymentConnections.id, conn.id));

    return NextResponse.json({
      success: true,
      message: 'Integração PushinPay desativada com sucesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao desconectar PushinPay.' }, { status: 500 });
  }
}
