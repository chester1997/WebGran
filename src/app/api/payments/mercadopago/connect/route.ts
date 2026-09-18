import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentStore } from '@/lib/auth';
import { paymentService } from '@/lib/payments/payment-service';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'seller') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const store = await getCurrentStore();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/payments/mercadopago/callback`;

    const oauthUrl = await paymentService.getOAuthConnectUrl(user.id, redirectUri, store?.id);

    return NextResponse.redirect(oauthUrl);
  } catch (error: any) {
    console.error('Error generating Mercado Pago OAuth URL:', error);
    return NextResponse.json({ error: error.message || 'Erro ao conectar ao Mercado Pago' }, { status: 500 });
  }
}
