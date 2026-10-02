import { NextRequest, NextResponse } from 'next/server';
import { syncPayProvider } from '@/lib/payments/providers/syncpay';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID ausente na URL.' }, { status: 400 });
    }

    // Must extract raw text BEFORE parsing JSON for HMAC-SHA256 signature verification
    const rawBody = await req.text();
    const res = await syncPayProvider.handleWebhook(connectionId, rawBody, req.headers);

    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Falha no processamento do webhook SyncPay.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SyncPayWebhookRoute] Unhandled exception:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
