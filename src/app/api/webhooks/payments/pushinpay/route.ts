import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment-service';

export async function POST(req: NextRequest) {
  try {
    let payload: any = null;

    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload do Webhook PushinPay inválido ou corrompido.' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Payload do Webhook PushinPay deve ser um objeto JSON válido.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id') || searchParams.get('transaction_id');

    if (idParam && !payload.id) {
      payload.id = idParam;
    }

    const result = await paymentService.handleWebhook('pushinpay', payload);

    if (!result.success && result.error) {
      if (result.error.includes('não encontrada')) {
        return NextResponse.json({ received: false, error: result.error }, { status: 404 });
      }
      if (result.error.includes('inferior') || result.error.includes('Divergência')) {
        return NextResponse.json({ received: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ received: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error('[PushinPayWebhook] Internal Error:', error);
    // Return 500 so PushinPay retries the webhook on temporary server failures
    return NextResponse.json({ received: false, error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
