import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { getCurrentUser, getCurrentStore } from '@/lib/auth';
import { paymentService } from '@/lib/payments/payment-service';
import { hasFeature } from '@/lib/entitlements/entitlement-service';

export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await getCurrentUser();
    const role = (user?.role || '').toLowerCase();
    if (!user || (role !== 'seller' && role !== 'admin' && role !== 'super_admin')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const gatewayAllowed = await hasFeature(user.id, "payment_gateways_enabled");
    if (!gatewayAllowed) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=${encodeURIComponent("Gateways de pagamento não estão disponíveis no seu plano. Faça upgrade.")}`);
    }

    const store = await getCurrentStore();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/payments/mercadopago/callback`;

    const oauthUrl = await paymentService.getOAuthConnectUrl(user.id, redirectUri, store?.id);

    return NextResponse.redirect(oauthUrl);
  } catch (error: any) {
    console.error('Error generating Mercado Pago OAuth URL:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const errorMessage = error.message || 'Erro ao conectar ao Mercado Pago';
    return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=${encodeURIComponent(errorMessage)}`);
  }
}
