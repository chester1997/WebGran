import { NextResponse } from 'next/server';
import { requireSeller } from '@/lib/auth';
import { confirmInvoicePayment } from '@/lib/billing/subscription-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'ID da cobrança ausente.' }, { status: 400 });
    }

    const result = await confirmInvoicePayment(invoiceId, seller.id);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Erro ao verificar pagamento' }, { status: 400 });
  }
}
