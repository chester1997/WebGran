import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PlatformCommissionService } from "@/lib/commission/platform-commission-service";
import { PlatformCommissionMetricsService } from "@/lib/commission/platform-commission-metrics";
import { AdminReportsService } from "@/lib/reports/admin-reports-service";
import CommissionClient from "./CommissionClient";

export default async function AdminCommissionPage() {
  await connection();
  const user = await requireAdmin();

  let initialCommission = null;
  let initialHistory: any[] = [];
  let initialMetrics = null;
  let availableSellers: any[] = [];
  let initialError: string | null = null;

  try {
    initialCommission = await PlatformCommissionService.getCurrentCommission();
    initialHistory = await PlatformCommissionService.getAuditHistory(30);
  } catch (err: any) {
    initialError = err?.message || "Configuração da comissão temporariamente indisponível no banco de dados.";
  }

  try {
    initialMetrics = await PlatformCommissionMetricsService.getCommissionDashboard({
      period: "30d",
      page: 1,
      pageSize: 10,
    });
    availableSellers = await AdminReportsService.getAvailableSellers();
  } catch (err: any) {
    console.warn("[AdminCommissionPage] Erro ao carregar métricas adicionais:", err);
  }

  return (
    <CommissionClient
      user={user}
      initialCommission={initialCommission}
      initialHistory={initialHistory}
      initialMetrics={initialMetrics}
      availableSellers={availableSellers}
      initialError={initialError}
    />
  );
}
