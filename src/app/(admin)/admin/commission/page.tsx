import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PlatformCommissionService } from "@/lib/commission/platform-commission-service";
import CommissionClient from "./CommissionClient";

export default async function AdminCommissionPage() {
  await connection();
  const user = await requireAdmin();

  let initialCommission = null;
  let initialHistory: any[] = [];
  let initialError: string | null = null;

  try {
    initialCommission = await PlatformCommissionService.getCurrentCommission();
    initialHistory = await PlatformCommissionService.getAuditHistory(30);
  } catch (err: any) {
    initialError = err?.message || 'Configuração da comissão temporariamente indisponível no banco de dados.';
  }

  return (
    <CommissionClient
      user={user}
      initialCommission={initialCommission}
      initialHistory={initialHistory}
      initialError={initialError}
    />
  );
}
