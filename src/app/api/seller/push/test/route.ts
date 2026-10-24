import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const role = (user.role || "").toLowerCase();
    if (role !== "seller" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }

    const result = await SellerPushService.sendToSeller(user.id, {
      title: "🔔 Teste de Notificação WebGran",
      body: "Suas notificações push PWA estão ativas e funcionando perfeitamente!",
      url: "/seller/settings",
      tag: "test-push",
    });

    if (result.skipped) {
      return NextResponse.json(
        {
          success: false,
          message: result.reason || "Vendedor não possui dispositivos ativos ou VAPID não configurado.",
          details: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notificação enviada para ${result.sentCount} dispositivo(s).`,
      details: result,
    });
  } catch (err: any) {
    console.error("[API Seller Push Test] Erro:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

