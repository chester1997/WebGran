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
    await requireSeller();

    // SyncPay connection & testing is temporarily disabled for sellers
    return NextResponse.json(
      { error: 'A conexão e configuração da SyncPay está temporariamente indisponível para lojistas. Utilize a PushinPay.' },
      { status: 403 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar requisição.' }, { status: 401 });
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
