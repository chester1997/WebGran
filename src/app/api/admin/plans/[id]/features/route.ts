import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, features, planFeatures } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();
    const { id: planId } = await params;

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    const allFeatures = await db.query.features.findMany();
    const existingPlanFeatures = await db.query.planFeatures.findMany({
      where: eq(planFeatures.planId, planId),
    });

    const planFeatureMap = new Map<string, any>();
    for (const pf of existingPlanFeatures) {
      planFeatureMap.set(pf.featureId, pf.value);
    }

    const mergedFeatures = allFeatures.map((f) => {
      const planVal = planFeatureMap.has(f.id) ? planFeatureMap.get(f.id) : f.defaultValue;
      const parsedVal = typeof planVal === "object" && planVal !== null && "value" in planVal ? planVal.value : planVal;

      return {
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        type: f.type,
        category: f.category,
        defaultValue: typeof f.defaultValue === "object" && f.defaultValue !== null && "value" in f.defaultValue ? f.defaultValue.value : f.defaultValue,
        isActive: f.isActive,
        isConfigured: planFeatureMap.has(f.id),
        configuredValue: parsedVal,
      };
    });

    return NextResponse.json({ plan, features: mergedFeatures });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao buscar recursos do plano." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();
    const { id: planId } = await params;
    const body = await req.json();
    const { featureValues } = body; // Array of { featureId: string, value: any }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    if (!Array.isArray(featureValues)) {
      return NextResponse.json({ error: "Formato de dados inválido." }, { status: 400 });
    }

    const now = new Date();

    for (const item of featureValues) {
      if (!item.featureId) continue;

      const formattedVal = typeof item.value === "object" && item.value !== null && "value" in item.value
        ? item.value
        : { value: item.value };

      const existing = await db.query.planFeatures.findFirst({
        where: and(
          eq(planFeatures.planId, planId),
          eq(planFeatures.featureId, item.featureId)
        ),
      });

      if (existing) {
        await db
          .update(planFeatures)
          .set({
            value: formattedVal,
            updatedAt: now,
          })
          .where(eq(planFeatures.id, existing.id));
      } else {
        await db.insert(planFeatures).values({
          planId,
          featureId: item.featureId,
          value: formattedVal,
        });
      }
    }

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "UPDATE_PLAN_FEATURES",
      planId,
      updatedCount: featureValues.length,
      timestamp: now.toISOString(),
    }));

    return NextResponse.json({ success: true, message: "Recursos do plano atualizados com sucesso!" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao salvar recursos do plano." }, { status: 500 });
  }
}
