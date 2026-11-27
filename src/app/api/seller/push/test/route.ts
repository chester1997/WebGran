import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";
import { buildTestNotificationPayload } from "@/lib/push/notification-payload-builder";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const role = (user.role || "seller").toLowerCase();
    if (role !== "seller" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }

    const payload = buildTestNotificationPayload({
      userName: user.name || "",
      role: user.role || "seller",
    });

    // Atraso opcional (até 15 s) para o vendedor bloquear a tela e receber o teste com o app fechado
    const body = await req.json().catch(() => null);
    const delayMs = Math.min(15000, Math.max(0, Number(body?.delayMs) || 0));
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    const result = await SellerPushService.sendToSeller(user.id, payload);


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

    if (result.sentCount === 0) {
      return NextResponse.json(
        { success: false, message: "O envio para o seu celular falhou. Desative e ative as notificações de novo.", details: result },
        { status: 502 }
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

