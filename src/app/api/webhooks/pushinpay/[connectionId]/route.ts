import { NextRequest, NextResponse } from 'next/server';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID ausente na URL do webhook PushinPay.' }, { status: 400 });
    }

    const orderIdHint = req.nextUrl.searchParams.get('order_id') || undefined;
    const rawBody = await req.text();
    const res = await pushinPayProvider.handleWebhook(connectionId, rawBody, req.headers, orderIdHint);


    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Falha no processamento do webhook PushinPay.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, alreadyProcessed: res.alreadyProcessed, pending: res.pending });
  } catch (err: any) {
    console.error('[PushinPayWebhookRoute] Unhandled exception:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
