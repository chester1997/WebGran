import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { AnalyticsService } from "@/lib/analytics/analytics-service";
import { db } from "@/db";
import { telegramBots, sellerPaymentConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";
import SetupStoreClient from "./SetupStoreClient";
import { SellerSetupChecklistData } from "@/components/analytics/SellerSetupChecklist";

export default async function SellerDashboardPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Executa as consultas SSR em paralelo com estrito isolamento multi-tenant
  let storeBots: { id: string; username: string; displayName: string | null; notificationRecipients?: { id: string; status: string }[] }[] = [];
  let setupChecklist: SellerSetupChecklistData | null = null;
  let initialData;

  try {
    const [botsResult, paymentConnectionResult, analyticsResult] = await Promise.all([
      // 1. Bots da loja do vendedor autenticado (com destinatários de aviso de venda)
      db.query.telegramBots.findMany({
        where: eq(telegramBots.storeId, store.id),
        columns: { id: true, username: true, displayName: true },
        with: {
          notificationRecipients: {
            columns: { id: true, status: true },
          },
        },
      }),

      // 2. Conexão ativa de gateway de pagamento do vendedor da sessão
      db.query.sellerPaymentConnections.findFirst({
        where: and(
          eq(sellerPaymentConnections.sellerId, user.id),
          eq(sellerPaymentConnections.status, "active")
        ),
      }),

      // 3. Analytics da loja autenticada
      AnalyticsService.getStoreAnalytics(store.id, "30D"),
    ]);

    storeBots = botsResult;
    initialData = analyticsResult;

    // Checagem de avisos de venda
    const hasLegacyTelegramNotification = Boolean(store.telegramNotificationId && store.telegramNotificationId.trim());
    const hasActiveBotRecipient = storeBots.some((bot) =>
      bot.notificationRecipients?.some((recipient) => recipient.status === "active")
    );
    const hasSaleNotifications = hasLegacyTelegramNotification || hasActiveBotRecipient;

    // Primeiro bot sem avisos ativos para direcionar o CTA do checklist
    const firstBotWithoutNotifications = storeBots.find(
      (bot) => !bot.notificationRecipients?.some((recipient) => recipient.status === "active")
    );

    setupChecklist = {
      hasPaymentGateway: Boolean(paymentConnectionResult),
      hasProducts: (initialData.catalog?.totalProducts || 0) > 0,
      hasBot: storeBots.length > 0,
      hasSaleNotifications,
      firstBotWithoutNotificationsId: firstBotWithoutNotifications?.id || storeBots[0]?.id || null,
    };
  } catch (error: any) {
    // Em caso de falha em qualquer das consultas auxiliares, registra log sanitizado
    // e oculta o checklist para evitar dados inconsistentes ao usuário.
    console.error("[SellerDashboardPage] Error loading dashboard data in parallel:", error?.message || "Unknown error");
    setupChecklist = null;

    // Fallback de analytics seguro
    try {
      initialData = await AnalyticsService.getStoreAnalytics(store.id, "30D");
    } catch (_fallbackErr: any) {
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
  }

  // Remove `notificationRecipients` ao passar bots para DashboardClient (mantém tipagem esperada)
  const cleanBots = storeBots.map((b) => ({
    id: b.id,
    username: b.username,
    displayName: b.displayName,
  }));

  return <DashboardClient initialData={initialData} bots={cleanBots} setupChecklist={setupChecklist} />;
}
