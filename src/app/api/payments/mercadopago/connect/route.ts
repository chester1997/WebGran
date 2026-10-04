import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { getCurrentUser, getCurrentStore } from '@/lib/auth';
import { paymentService } from '@/lib/payments/payment-service';
import { hasFeature } from '@/lib/entitlements/entitlement-service';

async function buildMercadoPagoOAuthUrl(req: NextRequest, customRedirectUri?: string) {
  const user = await getCurrentUser();
  const role = (user?.role || '').toLowerCase();
  if (!user || (role !== 'seller' && role !== 'admin' && role !== 'super_admin')) {
    return { error: 'Não autorizado', status: 401 };
  }

  const gatewayAllowed = await hasFeature(user.id, "payment_gateways_enabled");
  if (!gatewayAllowed) {
    return { error: 'Gateways de pagamento não estão disponíveis no seu plano. Faça upgrade.', status: 403 };
  }

  const store = await getCurrentStore();
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const appUrl = rawAppUrl.replace(/\/+$/, '');
  
  let redirectUri = `${appUrl}/api/payments/mercadopago/callback`;
  if (customRedirectUri && (customRedirectUri.includes('localhost') || customRedirectUri.includes('127.0.0.1'))) {
    redirectUri = customRedirectUri;
  }

  const oauthUrl = await paymentService.getOAuthConnectUrl(user.id, redirectUri, store?.id);
  return { oauthUrl };
}

export async function GET(req: NextRequest) {
  await connection();
  try {
    const result = await buildMercadoPagoOAuthUrl(req);
    if ('error' in result) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;
      return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=${encodeURIComponent(result.error || 'Erro ao conectar')}`);
    }
    return NextResponse.redirect(result.oauthUrl);
  } catch (error: any) {
    console.error('Error generating Mercado Pago OAuth URL (GET):', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const errorMessage = error.message || 'Erro ao conectar ao Mercado Pago';
    return NextResponse.redirect(`${appUrl}/seller/recebimentos?error=${encodeURIComponent(errorMessage)}`);
  }
}

export async function POST(req: NextRequest) {
  await connection();
  try {
    let customRedirectUri: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.redirectUri === 'string' && body.redirectUri.trim()) {
        customRedirectUri = body.redirectUri.trim();
      }
    } catch {
      // Body JSON parsing optional or empty
    }

    const result = await buildMercadoPagoOAuthUrl(req, customRedirectUri);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, url: result.oauthUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating Mercado Pago OAuth URL (POST):', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar conexão com Mercado Pago.' },
      { status: 500 }
    );
  }
}
