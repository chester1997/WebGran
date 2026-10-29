import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { SellerGatewayControlService } from "@/lib/payments/seller-gateway-control-service";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const controls = await SellerGatewayControlService.getAllControls();
    return NextResponse.json({ success: true, controls });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    console.error("[ADMIN_SELLER_GATEWAYS_GET_ERROR]", error);
    return NextResponse.json({ error: error?.message || "Erro ao carregar controles de gateways." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requirePlatformAdmin();
    const body = await req.json();

    const { gateway, allowNewConnections, allowNewPayments, notes } = body || {};

    if (!gateway || typeof gateway !== "string") {
      return NextResponse.json({ error: "O identificador do gateway é obrigatório." }, { status: 400 });
    }

    const updated = await SellerGatewayControlService.updateGatewayControl(gateway.toLowerCase().trim(), {
      allowNewConnections: typeof allowNewConnections === "boolean" ? allowNewConnections : undefined,
      allowNewPayments: typeof allowNewPayments === "boolean" ? allowNewPayments : undefined,
      notes: notes !== undefined ? (typeof notes === "string" ? notes.trim() : null) : undefined,
      adminUser: {
        id: adminUser.id,
        name: adminUser.name || null,
        email: adminUser.email || null,
      },
    });

    return NextResponse.json({ success: true, control: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    console.error("[ADMIN_SELLER_GATEWAYS_PATCH_ERROR]", error);
    return NextResponse.json({ error: error?.message || "Erro ao atualizar controle de gateway." }, { status: 500 });
  }
}

