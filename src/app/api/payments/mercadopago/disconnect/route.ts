import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { paymentService } from '@/lib/payments/payment-service';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const role = (user?.role || '').toLowerCase();
    if (!user || (role !== 'seller' && role !== 'admin' && role !== 'super_admin')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    await paymentService.disconnectSeller(user.id);
    return NextResponse.json({ success: true, message: 'Mercado Pago desconectado com sucesso' });
  } catch (error: any) {
    console.error('Error disconnecting Mercado Pago:', error);
    return NextResponse.json({ error: error.message || 'Erro ao desconectar Mercado Pago' }, { status: 500 });
  }
}
