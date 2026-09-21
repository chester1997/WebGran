import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/admin/payments/mercadopago/callback`;

    const authUrl = await mercadoPagoPlatformProvider.getOAuthConnectUrl(redirectUri);

    return NextResponse.json({ success: true, url: authUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 400 });
  }
}
