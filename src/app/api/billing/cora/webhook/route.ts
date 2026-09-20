import { NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices, subscriptions } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { WEBGRAN_PLAN_PRICE } from '@/lib/billing/subscription-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Log payload for audit
    console.log('[CORA WEBHOOK EVENT]', JSON.stringify(payload));

    const invoiceId = payload.code || payload.invoice_id || payload.id || payload.data?.id;
    const status = (payload.status || payload.event || payload.data?.status || '').toUpperCase();

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'Identificador da cobrança ausente.' }, { status: 400 });
    }

    // Idempotent search by externalId or internal id
    const inv = await db.query.invoices.findFirst({
      where: or(eq(invoices.externalId, invoiceId), eq(invoices.id, invoiceId)),
    });

    if (!inv) {
      return NextResponse.json({ success: true, message: 'Evento recebido, cobrança não localizada no sistema.' });
    }

    // Idempotency check: if already paid, return 200 OK directly
    if (inv.status === 'PAID') {
      return NextResponse.json({ success: true, message: 'Evento já processado anteriormente.' });
    }

    // Check if status represents payment completion
    if (status === 'PAID' || status === 'APPROVED' || status === 'COMPLETED' || status === 'CONFIRMED' || status.includes('PAID')) {
      // Validate expected amount
      if (Number(inv.amount) !== WEBGRAN_PLAN_PRICE) {
        console.warn(`[AUDIT ALARM] Webhook invoice ${inv.id} amount mismatch: expected ${WEBGRAN_PLAN_PRICE}, received ${inv.amount}`);
      }

      const now = new Date();
      const nextPeriodEnd = new Date(now);
      nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

      // Update invoice to PAID
      await db
        .update(invoices)
        .set({
          status: 'PAID',
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(invoices.id, inv.id));

      // Activate seller subscription
      if (inv.subscriptionId) {
        await db
          .update(subscriptions)
          .set({
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, inv.subscriptionId));
      }

      return NextResponse.json({ success: true, message: 'Assinatura ativada com sucesso.' });
    }

    return NextResponse.json({ success: true, message: `Evento ${status} recebido.` });
  } catch (error: any) {
    console.error('Cora Webhook Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno ao processar webhook' }, { status: 500 });
  }
}
