import { NextRequest, NextResponse } from 'next/server';
import { requireSeller } from '@/lib/auth';
import { paymentService } from '@/lib/payments/payment-service';

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const conn = await paymentService.getSellerConnection(seller.id);
    if (!conn) {
      return NextResponse.json(
        { success: false, message: 'Mercado Pago não conectado para este lojista.' },
        { status: 400 }
      );
    }

    const testRes = await paymentService.testMercadoPagoConnection(seller.id);
    return NextResponse.json({
      success: true,
      message: `Token válido e conexão ativa! Conta vinculada: ${testRes.email || testRes.userId || 'OK'}`,
    });
  } catch (error: any) {
    console.error('Error testing Mercado Pago connection:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Falha ao testar conexão com o Mercado Pago.' },
      { status: 400 }
    );
  }
}

