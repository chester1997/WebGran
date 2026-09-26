import { NextResponse } from "next/server";
import { connection } from "next/server";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const origin = url.origin;

    if (error || !code) {
      console.error("[MP Platform OAuth Callback Error]", error);
      return NextResponse.redirect(`${origin}/admin/settings?error=${encodeURIComponent(error || "Autorização cancelada")}`);
    }

    const redirectUri = `${origin}/api/admin/payments/mercadopago/callback`;
    await mercadoPagoPlatformProvider.handleOAuthCallback(code, redirectUri);

    return NextResponse.redirect(`${origin}/admin/settings?status=mp_connected`);
  } catch (err: any) {
    console.error("[MP Platform Callback Exception]", err);
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/admin/settings?error=${encodeURIComponent(err.message || "Falha na conexão Mercado Pago")}`);
  }
}
