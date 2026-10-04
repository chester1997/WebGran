import { NextResponse } from 'next/server';
import { SyncPayPlatformBillingReconciliationService } from '@/lib/billing/syncpay-platform-reconciliation-service';
import { db } from '@/db';
import { paymentWebhookEvents } from '@/db/schema';
import crypto from 'crypto';

/**
 * Endpoint exclusivamente dedicado a Webhooks do Platform Billing WebGran via SyncPay.
 * URL: /api/webhooks/syncpay/platform-billing
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {}

    const searchParams = new URL(req.url).searchParams;
    const tokenQuery = searchParams.get('token');
    const authHeader = req.headers.get('authorization') || req.headers.get('x-syncpay-token');

    // Verify webhook token if SYNCPAY_PLATFORM_WEBHOOK_TOKEN is defined
    const expectedToken = process.env.SYNCPAY_PLATFORM_WEBHOOK_TOKEN;
    if (expectedToken) {
      const providedToken = tokenQuery || authHeader?.replace(/^Bearer\s+/i, '');
      if (providedToken !== expectedToken) {
        console.warn('[SyncPayPlatformWebhook] Token de validação inválido.');
        return NextResponse.json({ error: 'Token de webhook inválido' }, { status: 401 });
      }
    }

    const eventName = (body.event || body.event_type || body.type || 'unknown').toLowerCase();
    const eventId = body.id || body.event_id || body.transaction_id || crypto.createHash('sha256').update(rawBody).digest('hex');

    console.log(`[SyncPayPlatformWebhook] Evento recebido: ${eventName} (ID: ${eventId})`);

    // Record webhook event for audit/idempotency logging if table exists
    try {
      await db.insert(paymentWebhookEvents).values({
        provider: 'syncpay_platform',
        eventId,
        eventType: eventName,
        payload: body,
      }).onConflictDoNothing();
    } catch (dbErr) {
      // Non-blocking if table or logging is omitted
    }

    // Extract subscription token from payload
    const payload = body.data || body.payload || body;
    const subscriptionToken =
      payload?.subscription_token ||
      payload?.subscriptionToken ||
      payload?.subscription_id ||
      payload?.token ||
      body?.subscription_token;

    if (subscriptionToken) {
      console.log(`[SyncPayPlatformWebhook] Reconciliando assinatura via SyncPay API: ${subscriptionToken}`);
      // Reconcile real state from SyncPay API to protect against out-of-order webhooks
      const recResult = await SyncPayPlatformBillingReconciliationService.reconcileByToken(subscriptionToken);
      console.log(`[SyncPayPlatformWebhook] Reconciliação concluída para ${subscriptionToken}:`, recResult);
    } else {
      console.warn('[SyncPayPlatformWebhook] Nenhum subscription_token encontrado no payload do evento.');
    }

    return NextResponse.json({
      received: true,
      event: eventName,
      status: 'processed',
    });
  } catch (error: any) {
    console.error('[SyncPayPlatformWebhook] Erro no processamento:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'WebGran SyncPay Platform Billing Webhook Endpoint Ready',
  });
}
