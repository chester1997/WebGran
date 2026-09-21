import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { accessToken, email } = body;

    if (!accessToken) {
      return NextResponse.json({ error: "Access Token é obrigatório." }, { status: 400 });
    }

    const result = await mercadoPagoPlatformProvider.saveAccessTokenDirect(accessToken, email);
    return NextResponse.json({ success: true, message: "Mercado Pago conectado com sucesso!", mpUserId: result.mpUserId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao conectar Mercado Pago" }, { status: 400 });
  }
}
