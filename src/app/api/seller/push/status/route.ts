import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";


export async function GET(req: NextRequest) {
  try {
    const user = await requireSeller();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const publicKey = SellerPushService.getPublicKey();
    const hasActiveSubscription = await SellerPushService.hasActiveSubscription(user.id);

    return NextResponse.json({
      configured: !!publicKey,
      publicKey,
      hasActiveSubscription,
    });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    console.error("[API Seller Push Status] Erro:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
