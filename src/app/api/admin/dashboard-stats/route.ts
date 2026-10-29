import { NextResponse } from "next/server";
import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminDashboardService } from "@/lib/analytics/admin-dashboard-service";

export async function GET(req: Request) {
  await connection();
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get("period") || "30d";

    // Validate period parameter
    const validPeriods = ["7d", "30d", "90d"];
    const period = validPeriods.includes(periodParam) ? periodParam : "30d";

    const data = await AdminDashboardService.getDashboardStats(period, new Date());

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sessão não autenticada." },
        { status: 401 }
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Acesso negado. Apenas administradores podem acessar." },
        { status: 403 }
      );
    }

    console.error("ADMIN DASHBOARD STATS ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar métricas administrativas." },
      { status: 500 }
    );
  }
}
