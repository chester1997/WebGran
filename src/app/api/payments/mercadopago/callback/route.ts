import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (error || !code) {
    console.error('Mercado Pago OAuth Error:', error);
    return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=oauth_failed`);
  }

  try {
    const redirectUri = `${appUrl}/api/payments/mercadopago/callback`;
    await paymentService.handleOAuthCallback(code, redirectUri, state || undefined);

    return NextResponse.redirect(`${appUrl}/seller/recebimentos?success=connected`);
  } catch (err: any) {
    console.error('Error handling Mercado Pago OAuth callback:', err);
    return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=${encodeURIComponent(err.message || 'callback_failed')}`);
  }
}
