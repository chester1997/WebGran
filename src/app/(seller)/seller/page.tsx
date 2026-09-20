import { requireSeller, getCurrentStore } from "@/lib/auth";
import { AnalyticsService } from "@/lib/analytics/analytics-service";
import { DashboardClient } from "./DashboardClient";

export default async function SellerDashboardPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  const initialData = await AnalyticsService.getStoreAnalytics(store.id, "30D");

  return <DashboardClient initialData={initialData} />;
}
