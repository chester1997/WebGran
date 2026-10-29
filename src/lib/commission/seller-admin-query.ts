import { db } from "@/db";
import { users, subscriptions, invoices, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SellerCommissionService } from "@/lib/commission/seller-commission-service";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";

export interface SellerStoreBot {
  id: string;
  botId: string;
  username: string;
  displayName: string | null;
  status: string;
}

export interface SellerStoreItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  bots: SellerStoreBot[];
}

export interface SellerCommissionSummary {
  effectiveFeeCents: number;
  effectiveFeeReais: number;
  formattedFee: string;
  source: "PLATFORM_DEFAULT" | "CUSTOM" | "EXEMPTION";
  ruleLabel: string;
  isExempt: boolean;
  customFeeCents: number | null;
  platformDefaultFeeCents: number;
  version: number;
  exemption: {
    status: "NONE" | "PENDING" | "ACTIVE" | "EXPIRED";
    isActive: boolean;
    start: string | null;
    end: string | null;
    endFormatted: string | null;
    reason: string | null;
  };
}

export interface SellerSalesMetrics {
  paidOrdersCount: number;
  approvedVolumeReais: number;
  formattedVolume: string;
}

export interface SellerItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  status: string;
  stores: SellerStoreItem[];
  store: SellerStoreItem | null;
  commission: SellerCommissionSummary;
  sales: SellerSalesMetrics;
  subscription: {
    id: string;
    planName: string;
    price: number;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    isExpired: boolean;
  } | null;
  latestInvoice: {
    id: string;
    amount: number;
    status: string;
    provider: string;
    externalId: string | null;
    paidAt: string | null;
    dueDate: string | null;
  } | null;
}

/**
 * Loads and enriches the sellers list with:
 * - Associated stores & connected Telegram bots
 * - Dynamic effective commission fees & active exemption status
 * - Aggregated sales metrics (paid orders count & approved volume)
 * - Historical subscription details (backward compatibility)
 */
export async function loadAdminSellersList(): Promise<SellerItem[]> {
  const sellersData = await db.query.users.findMany({
    where: eq(users.role, "seller"),
    with: {
      stores: {
        with: {
          bots: true,
        },
      },
    },
    orderBy: [desc(users.createdAt)],
  });

  const now = new Date();

  // Single efficient batch query for all paid orders across all stores
  let paidOrders: { storeId: string; total: string | number }[] = [];
  try {
    paidOrders = await db.query.orders.findMany({
      where: eq(orders.status, "paid"),
      columns: {
        storeId: true,
        total: true,
      },
    });
  } catch (err) {
    console.warn("[SELLER_ADMIN_QUERY] Could not fetch paid orders:", err);
  }

  const storeMetrics = new Map<string, { count: number; volume: number }>();
  for (const o of paidOrders) {
    const current = storeMetrics.get(o.storeId) || { count: 0, volume: 0 };
    current.count += 1;
    current.volume += Number(o.total || 0);
    storeMetrics.set(o.storeId, current);
  }

  const enrichedSellers: SellerItem[] = await Promise.all(
    sellersData.map(async (seller) => {
      // 1. Stores and Telegram Bots
      const formattedStores: SellerStoreItem[] = (seller.stores || []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        bots: ((s as any).bots || []).map((b: any) => ({
          id: b.id,
          botId: b.botId,
          username: b.username,
          displayName: b.displayName || null,
          status: b.status,
        })),
      }));

      const primaryStore = formattedStores[0] || null;

      // 2. Aggregated Sales Metrics
      let totalPaidCount = 0;
      let totalApprovedVolume = 0;
      for (const s of formattedStores) {
        const m = storeMetrics.get(s.id);
        if (m) {
          totalPaidCount += m.count;
          totalApprovedVolume += m.volume;
        }
      }

      // 3. Commission Settings & Effective Fee
      let effectiveFee: any = null;
      let setting: any = null;
      try {
        [effectiveFee, setting] = await Promise.all([
          SellerCommissionService.resolveEffectiveFee(seller.id, now),
          SellerCommissionService.getSellerCommissionSetting(seller.id),
        ]);
      } catch (commErr) {
        console.warn(`[SELLER_ADMIN_QUERY] Error resolving commission for seller ${seller.id}:`, commErr);
        effectiveFee = {
          sellerId: seller.id,
          effectiveFeeCents: 50,
          effectiveFeeReais: 0.5,
          formattedFee: "R$ 0,50",
          source: "PLATFORM_DEFAULT",
          isExempt: false,
          customFeeCents: null,
          platformDefaultFeeCents: 50,
          exemption: {
            status: "NONE",
            isActive: false,
            start: null,
            end: null,
            reason: null,
          },
          referenceDate: now,
        };
      }

      let ruleLabel = "Padrão da Plataforma";
      if (effectiveFee.source === "EXEMPTION") {
        ruleLabel = "Isenção Temporária Ativa";
      } else if (effectiveFee.source === "CUSTOM") {
        ruleLabel = "Taxa Personalizada";
      }

      const commission: SellerCommissionSummary = {
        effectiveFeeCents: effectiveFee.effectiveFeeCents,
        effectiveFeeReais: effectiveFee.effectiveFeeReais,
        formattedFee: effectiveFee.formattedFee,
        source: effectiveFee.source,
        ruleLabel,
        isExempt: effectiveFee.isExempt,
        customFeeCents: effectiveFee.customFeeCents,
        platformDefaultFeeCents: effectiveFee.platformDefaultFeeCents,
        version: setting?.version ?? 1,
        exemption: {
          status: effectiveFee.exemption.status,
          isActive: effectiveFee.exemption.isActive,
          start: effectiveFee.exemption.start ? new Date(effectiveFee.exemption.start).toISOString() : null,
          end: effectiveFee.exemption.end ? new Date(effectiveFee.exemption.end).toISOString() : null,
          endFormatted: effectiveFee.exemption.end ? formatBusinessDateTime(effectiveFee.exemption.end) : null,
          reason: effectiveFee.exemption.reason,
        },
      };

      // 4. Backward-compatible Subscriptions & Invoices
      let sub: any = null;
      try {
        sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.sellerId, seller.id),
          with: {
            plan: true,
            invoices: {
              orderBy: [desc(invoices.createdAt)],
              limit: 1,
            },
          },
        });
      } catch (subErr) {
        // Safe fallback in test mocks or environments lacking subscriptions table
      }

      const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
      const isExpired = periodEnd ? periodEnd < now : false;

      // Seller status calculation
      let computedStatus = "active";
      if (seller.role === "suspended" || primaryStore?.status === "suspended" || sub?.status === "SUSPENDED") {
        computedStatus = "suspended";
      } else if (!primaryStore || primaryStore?.status === "inactive") {
        computedStatus = "inactive";
      } else if (seller.role === "pending") {
        computedStatus = "pending";
      }

      return {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role,
        createdAt: seller.createdAt ? new Date(seller.createdAt).toISOString() : new Date().toISOString(),
        status: computedStatus,
        stores: formattedStores,
        store: primaryStore,
        commission,
        sales: {
          paidOrdersCount: totalPaidCount,
          approvedVolumeReais: totalApprovedVolume,
          formattedVolume: totalApprovedVolume.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
        },
        subscription: sub ? {
          id: sub.id,
          planName: sub.plan?.name || "WebGran SaaS",
          price: sub.plan?.price ? Number(sub.plan.price) : 0,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toISOString() : null,
          currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
          isExpired,
        } : null,
        latestInvoice: sub?.invoices && sub.invoices.length > 0 ? {
          id: sub.invoices[0].id,
          amount: Number(sub.invoices[0].amount),
          status: sub.invoices[0].status,
          provider: sub.invoices[0].provider,
          externalId: sub.invoices[0].externalId,
          paidAt: sub.invoices[0].paidAt ? new Date(sub.invoices[0].paidAt).toISOString() : null,
          dueDate: sub.invoices[0].dueDate ? new Date(sub.invoices[0].dueDate).toISOString() : null,
        } : null,
      };
    })
  );

  return enrichedSellers;
}

