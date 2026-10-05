import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, planFeatures, features, subscriptions } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requirePlatformAdmin();

    // Ensure 'video_storage_quota_gb' feature exists in catalog
    let storageFeature = await db.query.features.findFirst({
      where: eq(features.key, "video_storage_quota_gb"),
    });

    if (!storageFeature) {
      const inserted = await db
        .insert(features)
        .values({
          name: "Quota de Armazenamento de Vídeos (GB)",
          key: "video_storage_quota_gb",
          description: "Limite de armazenamento de vídeos da biblioteca em GB (-1 = Ilimitado)",
          type: "QUOTA",
          defaultValue: "50",
          isActive: true,
        })
        .returning();
      storageFeature = inserted[0];
    }

    const plans = await db.query.subscriptionPlans.findMany({
      orderBy: [desc(subscriptionPlans.createdAt)],
    });

    const formattedPlans = await Promise.all(
      plans.map(async (p) => {
        // Fetch storage quota feature value
        const [storagePf] = await db
          .select({ value: planFeatures.value })
          .from(planFeatures)
          .where(
            eq(planFeatures.planId, p.id)
          );

        const pfList = await db.query.planFeatures.findMany({
          where: eq(planFeatures.planId, p.id),
          with: { feature: true },
        });

        const storagePfRecord = pfList.find((pf) => pf.feature?.key === "video_storage_quota_gb");
        let rawQuota = storagePfRecord?.value;
        if (rawQuota && typeof rawQuota === "object" && "value" in rawQuota) {
          rawQuota = (rawQuota as any).value;
        }

        const storageQuotaGb = rawQuota === -1 || rawQuota === "-1" ? -1 : Number(rawQuota ?? 50);

        const subCount = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.planId, p.id));

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          price: Number(p.price),
          billingInterval: p.billingInterval || "month",
          active: p.active,
          storageQuotaGb,
          maxProducts: p.maxProducts ?? -1,
          maxBots: p.maxBots ?? -1,
          syncpayPlanToken: p.syncpayPlanToken || null,
          activeSubscriptionsCount: subCount[0]?.count || 0,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({ success: true, plans: formattedPlans });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("[ADMIN GET VIDEO LIBRARY PLANS ERROR]:", error);
    return NextResponse.json({ error: error.message || "Erro ao carregar planos de armazenamento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requirePlatformAdmin();
    const body = await req.json();
    const { id, name, slug, price, description, billingInterval, storageQuotaGb, active } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nome do plano é obrigatório." }, { status: 400 });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleanSlug) {
      return NextResponse.json({ error: "Slug do plano é inválido." }, { status: 400 });
    }

    const quotaNumber = storageQuotaGb === -1 || storageQuotaGb === "-1" ? -1 : Number(storageQuotaGb) || 50;

    // Ensure feature 'video_storage_quota_gb' exists
    let storageFeature = await db.query.features.findFirst({
      where: eq(features.key, "video_storage_quota_gb"),
    });
    if (!storageFeature) {
      const inserted = await db
        .insert(features)
        .values({
          name: "Quota de Armazenamento de Vídeos (GB)",
          key: "video_storage_quota_gb",
          description: "Limite de armazenamento de vídeos da biblioteca em GB (-1 = Ilimitado)",
          type: "QUOTA",
          defaultValue: "50",
          isActive: true,
        })
        .returning();
      storageFeature = inserted[0];
    }

    const now = new Date();
    let planRecord;

    if (id) {
      const updated = await db
        .update(subscriptionPlans)
        .set({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          description: description ? description.trim() : null,
          billingInterval: billingInterval || "month",
          active: active !== undefined ? Boolean(active) : true,
          updatedAt: now,
        })
        .where(eq(subscriptionPlans.id, id))
        .returning();

      planRecord = updated[0];
    } else {
      const created = await db
        .insert(subscriptionPlans)
        .values({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          description: description ? description.trim() : null,
          billingInterval: billingInterval || "month",
          active: active !== undefined ? Boolean(active) : true,
        })
        .returning();

      planRecord = created[0];
    }

    // Upsert storageQuotaGb in plan_features
    const existingPf = await db.query.planFeatures.findFirst({
      where: (pf, { and, eq }) => and(eq(pf.planId, planRecord.id), eq(pf.featureId, storageFeature.id)),
    });

    if (existingPf) {
      await db
        .update(planFeatures)
        .set({
          value: { value: quotaNumber },
          updatedAt: now,
        })
        .where(eq(planFeatures.id, existingPf.id));
    } else {
      await db.insert(planFeatures).values({
        planId: planRecord.id,
        featureId: storageFeature.id,
        value: { value: quotaNumber },
      });
    }

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "SAVE_VIDEO_LIBRARY_PLAN",
      planId: planRecord.id,
      quotaGb: quotaNumber,
      timestamp: now.toISOString(),
    }));

    return NextResponse.json({ success: true, plan: planRecord });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("[ADMIN POST VIDEO LIBRARY PLAN ERROR]:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar plano de armazenamento." }, { status: 500 });
  }
}
