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

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (decoded?.sellerId) {
        const { db } = await import('@/db');
        const { users } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        const sellerUser = await db.query.users.findFirst({
          where: eq(users.id, decoded.sellerId),
        });
        if (sellerUser && (sellerUser.role || '').toLowerCase() === 'seller') {
          return NextResponse.redirect(
            `${appUrl}/seller/recebimentos?error=${encodeURIComponent(
              'A conexão com o Mercado Pago está temporariamente indisponível para lojistas. Utilize a PushinPay.'
            )}`
          );
        }
      }
    } catch {
      // Ignore JSON parse error and continue
    }
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
