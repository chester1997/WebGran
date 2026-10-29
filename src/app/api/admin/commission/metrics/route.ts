import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformCommissionMetricsService } from "@/lib/commission/platform-commission-metrics";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");
    const period = (searchParams.get("period") || "30d") as any;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const drillSellerId = searchParams.get("drillSellerId");
    const drillPage = parseInt(searchParams.get("drillPage") || "1", 10);

    // Se a requisição for para drill-down de um vendedor específico
    if (drillSellerId) {
      const drillData = await PlatformCommissionMetricsService.getSellerSplitOrders(
        drillSellerId,
        drillPage,
        10
      );
      return NextResponse.json({ success: true, drillData });
    }

    const data = await PlatformCommissionMetricsService.getCommissionDashboard({
      sellerId: sellerId || undefined,
      period,
      page,
      pageSize: 10,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    console.error("[ADMIN_COMMISSION_METRICS_GET_ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar métricas de comissão." },
      { status: 500 }
    );
  }
}

