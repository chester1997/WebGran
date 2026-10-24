import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const role = (user.role || "").toLowerCase();
    if (role !== "seller" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }

    const publicKey = SellerPushService.getPublicKey();
    const hasActiveSubscription = await SellerPushService.hasActiveSubscription(user.id);

    return NextResponse.json({
      configured: !!publicKey,
      publicKey,
      hasActiveSubscription,
    });
  } catch (err: any) {
    console.error("[API Seller Push Status] Erro:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

