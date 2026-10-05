import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, subscriptions, subscriptionPlans, productVideos } from "@/db/schema";
import { eq, sql, ne } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { getSellerEntitlement } from "@/lib/entitlements/entitlement-service";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const allStores = await db.query.stores.findMany({
      with: {
        owner: true,
      },
    });

    const sellerStorageList = await Promise.all(
      allStores.map(async (store) => {
        const owner = store.owner;
        const sellerId = owner.id;

        // Fetch seller subscription & plan
        const [sub] = await db
          .select({
            status: subscriptions.status,
            planName: subscriptionPlans.name,
            planSlug: subscriptionPlans.slug,
          })
          .from(subscriptions)
          .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
          .where(eq(subscriptions.sellerId, sellerId))
          .limit(1);

        // Fetch entitlement for storage
        const entitlement = await getSellerEntitlement(sellerId, "video_storage_quota_gb");
        const isUnlimited =
          entitlement.source === "ADMIN_EXEMPT" ||
          entitlement.isUnlimited ||
          entitlement.value === -1 ||
          owner.role === "admin" ||
          owner.role === "super_admin";

        const quotaGb = isUnlimited ? null : typeof entitlement.value === "number" ? entitlement.value : Number(entitlement.value) || 50;

        // Fetch used bytes & video counts
        const [usedRes] = await db
          .select({
            totalBytes: sql<number>`COALESCE(SUM(${productVideos.fileSizeBytes}), 0)`,
            totalVideos: sql<number>`COUNT(${productVideos.id})`,
          })
          .from(productVideos)
          .where(
            eq(productVideos.storeId, store.id)
          );

        const usedBytes = Number(usedRes?.totalBytes || 0);
        const usedGB = Number((usedBytes / (1024 * 1024 * 1024)).toFixed(1));
        const videoCount = Number(usedRes?.totalVideos || 0);

        const percentage =
          quotaGb !== null && quotaGb > 0
            ? Math.min(100, Number(((usedGB / quotaGb) * 100).toFixed(1)))
            : 0;

        return {
          sellerId,
          sellerName: owner.name || "Vendedor",
          sellerEmail: owner.email,
          role: owner.role,
          storeId: store.id,
          storeName: store.name,
          planName: isUnlimited ? "Proprietário (Isento)" : sub?.planName || "WebGran",
          subStatus: sub?.status || "ACTIVE",
          quotaGb: isUnlimited ? "ILIMITADO" : quotaGb,
          usedGB,
          percentage: isUnlimited ? 0 : percentage,
          videoCount,
          isUnlimited,
        };
      })
    );

    return NextResponse.json({
      success: true,
      sellers: sellerStorageList,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("[ADMIN STORAGE GET ERROR]:", error);
    return NextResponse.json({ error: error.message || "Erro ao carregar visão de armazenamento." }, { status: 500 });
  }
}
