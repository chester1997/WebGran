import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminReportsService } from "@/lib/reports/admin-reports-service";
import AdminReportsClient from "./AdminReportsClient";

export default async function AdminReportsPage() {
  await connection();

  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    redirect("/seller");
  }

  let initialData = null;
  let initialError: string | null = null;

  try {
    initialData = await AdminReportsService.getReportData({
      period: "30d",
      page: 1,
      pageSize: 20,
    });
  } catch (err: any) {
    console.error("[AdminReportsPage] Erro ao carregar dados iniciais:", err);
    initialError = err?.message || "Erro ao carregar dados do relatório.";
  }

  return (
    <AdminReportsClient
      adminUser={adminUser}
      initialData={initialData}
      initialError={initialError}
    />
  );
}

