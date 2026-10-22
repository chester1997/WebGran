import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PlatformCommissionService } from "@/lib/commission/platform-commission-service";
import CommissionClient from "./CommissionClient";

export default async function AdminCommissionPage() {
  await connection();
  const user = await requireAdmin();

  const initialCommission = await PlatformCommissionService.getCurrentCommission();
  const initialHistory = await PlatformCommissionService.getAuditHistory(30);

  return (
    <CommissionClient
      user={user}
      initialCommission={initialCommission}
      initialHistory={initialHistory}
    />
  );
}
