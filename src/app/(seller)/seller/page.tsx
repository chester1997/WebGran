import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { AnalyticsService } from "@/lib/analytics/analytics-service";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";
import SetupStoreClient from "./SetupStoreClient";

export default async function SellerDashboardPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  let storeBots: { id: string; username: string; displayName: string | null }[] = [];
  try {
    storeBots = await db.query.telegramBots.findMany({
      where: eq(telegramBots.storeId, store.id),
      columns: { id: true, username: true, displayName: true },
    });
  } catch (_e) {
    // Non-blocking fallback
  }

  let initialData;
  try {
    initialData = await AnalyticsService.getStoreAnalytics(store.id, "30D");
  } catch (analyticsErr: any) {
    console.error("[SellerDashboardPage] Error loading initial store analytics:", analyticsErr?.message || analyticsErr);
    // Provide safe resilient fallback state
    initialData = {
      period: "30D",
      storeName: store.name,
      kpis: {
        revenue: { value: 0, formatted: "R$ 0,00", changePercent: null, trend: "neutral" as const, subtitle: "Últimos 30 dias" },
        salesCount: { value: 0, formatted: "0", changePercent: null, trend: "neutral" as const, subtitle: "Últimos 30 dias" },
        customersCount: { value: 0, formatted: "0", changePercent: null, trend: "neutral" as const, subtitle: "Últimos 30 dias" },
        averageTicket: { value: 0, formatted: "R$ 0,00", changePercent: null, trend: "neutral" as const, subtitle: "Últimos 30 dias" },
      },
      chartSeries: [],
      channels: [],
      topProducts: [],
      recentOrders: [],
      hourlySales: [],
      activity: { salesToday: 0, newCustomersPeriod: 0, customersToday: 0, activeAccesses: 0, pendingPayments: 0, pendingDeliveries: 0 },
      activityLog: [],
      catalog: { totalProducts: 0, activeProducts: 0, inactiveProducts: 0, categoriesCount: 0 },
      hasSales: false,
      commercialMetrics: {
        period: "30D",
        storeId: store.id,
        approvedSales: { total: 0, formatted: "R$ 0,00", count: 0, targetGoal: null, targetProgressPercent: null, hasTargetGoal: false },
        conversionRate: { ratePercent: null, formatted: "Sem dados", isTelemetryAvailable: true, totalVisits: 0, convertedOrders: 0, totalPixGerados: 0, totalPixPagos: 0, statusMessage: "Carregando dados..." },
        botStarts: { totalStarts: 0, formatted: "0", isTelemetryAvailable: true, uniqueUsers: 0, statusMessage: "Carregando dados..." },
        averageTicket: { averageTicket: 0, formatted: "R$ 0,00", consideredSalesCount: 0, approvedPixCount: 0, generatedPixCount: 0, pixConversionRatePercent: null },
        performanceSeries: [],
        last7DaysPerformance: [],
      },
    };
  }

  return <DashboardClient initialData={initialData} bots={storeBots} />;
}
