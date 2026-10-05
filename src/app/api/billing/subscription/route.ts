import { NextResponse } from 'next/server';
import { requireSeller } from '@/lib/auth';
import { getSellerSubscription, createCoraBillingInvoice } from '@/lib/billing/subscription-service';


export async function GET() {
  try {
    const seller = await requireSeller();
    const data = await getSellerSubscription(seller.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    let forceNew = false;
    let planId: string | undefined = undefined;
    try {
      const body = await req.json();
      forceNew = Boolean(body?.forceNew);
      if (body?.planId) planId = String(body.planId);
    } catch {}

    const invoice = await createCoraBillingInvoice(seller.id, forceNew, planId);

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao gerar cobrança' }, { status: 500 });
  }
}
