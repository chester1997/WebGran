import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function POST() {
  try {
    await requireAdmin();
    await mercadoPagoPlatformProvider.disconnectPlatform();
    return NextResponse.json({ success: true, message: "Conta Mercado Pago desconectada com sucesso." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 400 });
  }
}
