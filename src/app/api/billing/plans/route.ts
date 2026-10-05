import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, planFeatures, features } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSeller } from "@/lib/auth";

export async function GET() {
  try {
    await requireSeller();

    const plans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.active, true),
      orderBy: (p, { asc }) => [asc(p.price)],
    });

    const formatted = await Promise.all(
      plans.map(async (plan) => {
        const pfList = await db
          .select({
            featureKey: features.key,
            type: features.type,
            value: planFeatures.value,
          })
          .from(planFeatures)
          .innerJoin(features, eq(planFeatures.featureId, features.id))
          .where(eq(planFeatures.planId, plan.id));

        const featureMap: Record<string, any> = {};
        for (const pf of pfList) {
          let parsed = pf.value;
          if (parsed && typeof parsed === "object" && "value" in parsed) {
            parsed = (parsed as any).value;
          }
          featureMap[pf.featureKey] = parsed;
        }

        const rawQuota = featureMap["video_storage_quota_gb"] ?? 50;
        const storageQuotaGb = rawQuota === -1 || rawQuota === "-1" ? -1 : Number(rawQuota) || 50;
        const maxProducts = featureMap["max_products"] ?? plan.maxProducts ?? -1;
        const maxProductVideos = featureMap["max_product_videos"] ?? -1;

        return {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description || "Plano WebGran SaaS",
          price: Number(plan.price),
          billingInterval: plan.billingInterval,
          storageQuotaGb,
          maxProducts: maxProducts === -1 ? "Ilimitado" : Number(maxProducts),
          maxProductVideos: maxProductVideos === -1 ? "Ilimitado" : Number(maxProductVideos),
          features: featureMap,
        };
      })
    );

    return NextResponse.json({
      success: true,
      plans: formatted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar planos disponíveis." },
      { status: error.message?.includes("não autorizado") ? 401 : 500 }
    );
  }
}
