import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";
import { z } from "zod";

const unsubscribeSchema = z.object({
  endpoint: z.string().url("Endpoint de push inválido."),
});

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

    const body = await req.json().catch(() => null);
    const parsed = unsubscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados de desativação inválidos.", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { endpoint } = parsed.data;

    const result = await SellerPushService.unsubscribe({
      userId: user.id,
      endpoint,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Erro ao desativar assinatura." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Assinatura Push desativada com sucesso." });
  } catch (err: any) {
    console.error("[API Seller Push Unsubscribe] Erro:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

