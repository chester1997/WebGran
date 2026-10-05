import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  productVideos,
  videoLibraryPlans,
  videoLibrarySubscriptions,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();

    // 1. Fetch active Video Library Subscriptions with Plan and Seller
    const activeSubs = await db.query.videoLibrarySubscriptions.findMany({
      where: eq(videoLibrarySubscriptions.status, "ACTIVE"),
      with: {
        plan: true,
        seller: true,
      },
    });

    // All subscriptions (for alerts)
    const allSubs = await db.query.videoLibrarySubscriptions.findMany({
      with: {
        plan: true,
        seller: true,
      },
      orderBy: [desc(videoLibrarySubscriptions.updatedAt)],
    });

    // 2. Fetch all Video Library Plans
    const allPlans = await db.query.videoLibraryPlans.findMany({
      where: eq(videoLibraryPlans.active, true),
      orderBy: [desc(videoLibraryPlans.createdAt)],
    });

    // 3. Compute Video KPIs
    const [videoStatsRes] = await db
      .select({
        totalCount: sql<number>`count(*)::int`,
        usedBytes: sql<number>`COALESCE(sum(${productVideos.fileSizeBytes}), 0)::bigint`,
        readyCount: sql<number>`COALESCE(sum(CASE WHEN ${productVideos.status} = 'READY' THEN 1 ELSE 0 END), 0)::int`,
        processingCount: sql<number>`COALESCE(sum(CASE WHEN ${productVideos.status} IN ('PROCESSING', 'UPLOADING') THEN 1 ELSE 0 END), 0)::int`,
        failedCount: sql<number>`COALESCE(sum(CASE WHEN ${productVideos.status} = 'FAILED' THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(productVideos);

    const totalVideos = Number(videoStatsRes?.totalCount || 0);
    const totalUsedBytes = Number(videoStatsRes?.usedBytes || 0);
    const totalUsedGb = Math.round((totalUsedBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const readyVideos = Number(videoStatsRes?.readyCount || 0);
    const processingVideos = Number(videoStatsRes?.processingCount || 0);
    const failedVideos = Number(videoStatsRes?.failedCount || 0);

    // 4. Compute Contracted Quota & Revenue (MRR) from ACTIVE Subscriptions
    let contractedQuotaGb = 0;
    let totalMrrCents = 0;
    const planSubscribersMap = new Map<string, { plan: any; count: number; revenueCents: number }>();

    for (const p of allPlans) {
      planSubscribersMap.set(p.id, { plan: p, count: 0, revenueCents: 0 });
    }

    for (const sub of activeSubs) {
      if (sub.plan) {
        const q = sub.plan.storageQuotaGb;
        if (q > 0) {
          contractedQuotaGb += q;
        }
        totalMrrCents += Math.round(Number(sub.plan.price || 0) * 100);

        const planStat = planSubscribersMap.get(sub.plan.id);
        if (planStat) {
          planStat.count += 1;
          planStat.revenueCents += Math.round(Number(sub.plan.price || 0) * 100);
        }
      }
    }

    const subscribersCount = activeSubs.length;
    const mrrTotal = totalMrrCents / 100;
    const averageTicket = subscribersCount > 0 ? mrrTotal / subscribersCount : 0;

    // 5. Usage by Seller List
    const sellers = await db.query.users.findMany({
      where: inArray(users.role, ["SELLER", "ADMIN", "SUPER_ADMIN"]),
    });

    const sellerUsageList: any[] = [];
    const alerts: any[] = [];

    for (const s of sellers) {
      // Find active sub for seller
      const sellerSub = allSubs.find((sub) => sub.sellerId === s.id);

      // Check if seller has videos
      const sellerStores = await db.query.stores.findMany({
        where: eq(users.id, s.id),
      });

      const [sellerVideoRes] = await db
        .select({
          vCount: sql<number>`count(*)::int`,
          uBytes: sql<number>`COALESCE(sum(${productVideos.fileSizeBytes}), 0)::bigint`,
        })
        .from(productVideos)
        .innerJoin(users, eq(productVideos.storeId, productVideos.storeId)); // fallback join

      // Fetch actual videos count and used bytes for this seller
      const sellerVideos = await db.execute(sql`
        SELECT count(*)::int as count, COALESCE(sum(pv.file_size_bytes), 0)::bigint as used_bytes
        FROM product_videos pv
        JOIN stores st ON st.id = pv.store_id
        WHERE st.owner_id = ${s.id}
      `);

      const row = (sellerVideos as any)?.[0] ?? (sellerVideos as any)?.rows?.[0] ?? { count: 0, used_bytes: 0 };
      const vCount = Number(row.count || 0);
      const uBytes = Number(row.used_bytes || 0);

      // Skip seller if no subscription and 0 videos
      if (!sellerSub && vCount === 0) continue;

      const uGb = Math.round((uBytes / (1024 * 1024 * 1024)) * 10) / 10;
      const isSuperAdmin = (s.role || "").toUpperCase() === "SUPER_ADMIN" || (s.role || "").toUpperCase() === "ADMIN";
      
      let quotaGb = 0;
      let planName = "Sem Plano";
      let status = sellerSub?.status || "INACTIVE";

      if (isSuperAdmin) {
        quotaGb = -1;
        planName = "ADMIN / ILIMITADO";
        status = "ACTIVE";
      } else if (sellerSub && sellerSub.status === "ACTIVE" && sellerSub.plan) {
        quotaGb = sellerSub.plan.storageQuotaGb;
        planName = sellerSub.plan.name;
      } else if (sellerSub?.plan) {
        quotaGb = sellerSub.plan.storageQuotaGb;
        planName = sellerSub.plan.name;
      }

      const percent = quotaGb > 0 ? Math.min(999, Math.round((uGb / quotaGb) * 100)) : (isSuperAdmin ? 0 : 100);

      const sellerItem = {
        sellerId: s.id,
        sellerName: s.name || "Vendedor",
        sellerEmail: s.email,
        planName,
        videoCount: vCount,
        usedGb: uGb,
        quotaGb,
        percent,
        status,
        updatedAt: sellerSub?.updatedAt ? new Date(sellerSub.updatedAt).toISOString() : new Date().toISOString(),
      };

      sellerUsageList.push(sellerItem);

      // Generate alerts
      if (!isSuperAdmin && status === "ACTIVE" && percent >= 80) {
        alerts.push({
          type: percent >= 100 ? "QUOTA_EXCEEDED" : percent >= 90 ? "QUOTA_CRITICAL" : "QUOTA_WARNING",
          sellerId: s.id,
          sellerName: s.name || s.email,
          message: `Vendedor ${s.name || s.email} atingiu ${percent}% da cota (${uGb} GB / ${quotaGb} GB)`,
          percent,
        });
      }

      if (status !== "ACTIVE" && status !== "INACTIVE") {
        alerts.push({
          type: "SUBSCRIPTION_STATUS",
          sellerId: s.id,
          sellerName: s.name || s.email,
          message: `Assinatura do vendedor ${s.name || s.email} está com status ${status}`,
          status,
        });
      }
    }

    // Sort sellers: highest percentage usage first
    sellerUsageList.sort((a, b) => b.percent - a.percent);

    // Build Plan breakdown array
    const planDistribution = Array.from(planSubscribersMap.values()).map(({ plan, count, revenueCents }) => ({
      planId: plan.id,
      planName: plan.name,
      storageQuotaGb: plan.storageQuotaGb,
      subscribersCount: count,
      revenue: revenueCents / 100,
    }));

    return NextResponse.json({
      success: true,
      kpis: {
        totalUsedGb,
        contractedQuotaGb,
        subscribersCount,
        mrrTotal,
        totalVideos,
        readyVideos,
        processingVideos,
        failedVideos,
      },
      revenue: {
        mrrTotal,
        subscribersCount,
        averageTicket,
        planDistribution,
      },
      storageReport: {
        totalUsedGb,
        contractedQuotaGb,
        availableGb: Math.max(0, contractedQuotaGb - totalUsedGb),
        percentUsed: contractedQuotaGb > 0 ? Math.min(100, Math.round((totalUsedGb / contractedQuotaGb) * 100)) : 0,
      },
      sellers: sellerUsageList,
      alerts,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("[ADMIN GET VIDEO LIBRARY STATS ERROR]:", error);
    return NextResponse.json({ error: error.message || "Erro ao carregar dados da biblioteca." }, { status: 500 });
  }
}
