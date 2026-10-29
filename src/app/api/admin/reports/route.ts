import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminReportsService } from "@/lib/reports/admin-reports-service";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "30d") as any;
    const sellerId = searchParams.get("sellerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const data = await AdminReportsService.getReportData({
      period,
      sellerId: sellerId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    console.error("[ADMIN_REPORTS_GET_ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao gerar relatório administrativo." },
      { status: 500 }
    );
  }
}

