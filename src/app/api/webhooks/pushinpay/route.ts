import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'pushinpay_root_webhook',
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const orderIdHint = req.nextUrl.searchParams.get('order_id') || undefined;

    let transactionId = '';
    const cleanBody = (rawBody || '').replace(/^\uFEFF/, '').trim();

    if (cleanBody) {
      if (cleanBody.startsWith('{') || cleanBody.startsWith('[')) {
        try {
          const json = JSON.parse(cleanBody);
          transactionId = String(json.id || json.transaction_id || json.transactionId || '').trim();
        } catch {
          // ignore
        }
      }
      if (!transactionId) {
        try {
          const params = new URLSearchParams(cleanBody);
          transactionId = String(params.get('id') || params.get('transaction_id') || '').trim();
        } catch {
          // ignore
        }
      }
    }

    let resolvedConnectionId: string | null = null;

    // 1. Try to find order by transactionId
    if (transactionId) {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(orders.paymentId, transactionId),
          eq(orders.paymentMethod, 'pushinpay')
        ),
      });

      if (order?.storeId) {
        const conn = await pushinPayProvider.getPushinPayConnection(undefined, order.storeId);
        if (conn?.id) resolvedConnectionId = conn.id;
      }
    }

    // 2. Try to find order by orderIdHint
    if (!resolvedConnectionId && orderIdHint) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderIdHint),
      });

      if (order?.storeId) {
        const conn = await pushinPayProvider.getPushinPayConnection(undefined, order.storeId);
        if (conn?.id) resolvedConnectionId = conn.id;
      }
    }

    if (!resolvedConnectionId) {
      console.warn('[PushinPayRootWebhook] Não foi possível resolver connectionId para o webhook:', {
        transactionId,
        orderIdHint,
      });
      return NextResponse.json(
        { error: 'Connection ID não pôde ser determinado para esta notificação PushinPay.' },
        { status: 400 }
      );
    }

    const res = await pushinPayProvider.handleWebhook(resolvedConnectionId, rawBody, req.headers, orderIdHint);

    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Falha no processamento do webhook PushinPay.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, alreadyProcessed: res.alreadyProcessed, pending: res.pending });
  } catch (err: any) {
    console.error('[PushinPayRootWebhook] Unhandled exception:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
