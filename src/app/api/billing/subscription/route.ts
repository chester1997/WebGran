import { NextResponse } from 'next/server';
import { requireSeller } from '@/lib/auth';
import { getSellerSubscription, createCoraBillingInvoice } from '@/lib/billing/subscription-service';

export const dynamic = 'force-dynamic';

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

export async function POST() {
  try {
    const seller = await requireSeller();
    const invoice = await createCoraBillingInvoice(seller.id);

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao gerar cobrança' }, { status: 500 });
  }
}
