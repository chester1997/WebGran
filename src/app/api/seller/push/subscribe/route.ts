import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";
import { z } from "zod";


const subscribeSchema = z.object({
  endpoint: z.string().url("Endpoint de push inválido."),
  keys: z.object({
    p256dh: z.string().min(1, "Chave p256dh é obrigatória."),
    auth: z.string().min(1, "Chave auth é obrigatória."),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireSeller();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados de assinatura inválidos.", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { endpoint, keys, userAgent } = parsed.data;

    const result = await SellerPushService.registerSubscription({
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || req.headers.get("user-agent") || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Erro ao registrar assinatura." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Assinatura Push registrada com sucesso." });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    console.error("[API Seller Push Subscribe] Erro:", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
