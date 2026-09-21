import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function GET() {
  try {
    await requireAdmin();
    const statusData = await mercadoPagoPlatformProvider.getPlatformStatus();
    return NextResponse.json({ success: true, ...statusData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
