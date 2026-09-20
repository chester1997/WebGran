import { requireSeller, getCurrentStore } from "@/lib/auth";
import { AnalyticsService } from "@/lib/analytics/analytics-service";
import { DashboardClient } from "./DashboardClient";
import SetupStoreClient from "./SetupStoreClient";

export default async function SellerDashboardPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const initialData = await AnalyticsService.getStoreAnalytics(store.id, "30D");

  return <DashboardClient initialData={initialData} />;
}
