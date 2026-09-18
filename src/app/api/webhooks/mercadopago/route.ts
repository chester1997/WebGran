import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment-service';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let payload: any = {};

    try {
      payload = await req.json();
    } catch {
      // Body might be empty, check searchParams
    }

    // Merge searchParams query data if present
    const topic = searchParams.get('topic') || searchParams.get('type');
    const id = searchParams.get('id') || searchParams.get('data.id');

    if (id) {
      payload.data = { id: payload.data?.id || id };
    }
    if (topic) {
      payload.type = payload.type || topic;
    }

    // Process webhook asynchronously without blocking MP response if needed
    await paymentService.handleWebhook('mercado_pago', payload);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error handling Mercado Pago webhook:', error);
    // Respond 200 to acknowledge webhook receipt and prevent infinite retries from MP
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
