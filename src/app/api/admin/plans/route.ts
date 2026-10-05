import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, planFeatures, subscriptions } from "@/db/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const plans = await db.query.subscriptionPlans.findMany({
      orderBy: [desc(subscriptionPlans.createdAt)],
    });

    const formattedPlans = await Promise.all(
      plans.map(async (p) => {
        const featCount = await db
          .select({ count: count() })
          .from(planFeatures)
          .where(eq(planFeatures.planId, p.id));

        const subCount = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.planId, p.id));

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: Number(p.price),
          billingInterval: p.billingInterval,
          active: p.active,
          syncpayPlanTokenMasked: p.syncpayPlanToken ? `${p.syncpayPlanToken.slice(0, 6)}...` : null,
          isSyncPayIntegrated: Boolean(p.syncpayPlanToken),
          configuredFeaturesCount: featCount[0]?.count || 0,
          activeSubscriptionsCount: subCount[0]?.count || 0,
          maxProducts: p.maxProducts,
          maxBots: p.maxBots,
          maxCustomers: p.maxCustomers,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({ plans: formattedPlans });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN GET PLANS ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao buscar planos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requirePlatformAdmin();
    const body = await req.json();
    const { id, name, slug, price, description, billingInterval, active, featureValues } = body;

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

    const now = new Date();
    let targetPlanId = id;
    let returnedPlan: any = null;

    if (id) {
      // Check slug collision
      const existingSlug = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.slug, cleanSlug),
      });

      if (existingSlug && existingSlug.id !== id) {
        return NextResponse.json({ error: "Este slug já está em uso por outro plano." }, { status: 400 });
      }

      const updated = await db
        .update(subscriptionPlans)
        .set({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          description: description ? description.trim() : null,
          billingInterval: billingInterval || 'month',
          active: active !== undefined ? Boolean(active) : true,
          updatedAt: now,
        })
        .where(eq(subscriptionPlans.id, id))
        .returning();

      returnedPlan = updated[0];
    } else {
      // Create new plan
      const existingSlug = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.slug, cleanSlug),
      });

      if (existingSlug) {
        return NextResponse.json({ error: "Já existe um plano cadastrado com este slug." }, { status: 400 });
      }

      const created = await db
        .insert(subscriptionPlans)
        .values({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          description: description ? description.trim() : null,
          billingInterval: billingInterval || 'month',
          active: active !== undefined ? Boolean(active) : true,
        })
        .returning();

      returnedPlan = created[0];
      targetPlanId = returnedPlan.id;
    }

    // Save feature values if provided
    if (Array.isArray(featureValues) && targetPlanId) {
      for (const item of featureValues) {
        if (!item.featureId) continue;

        const formattedVal = typeof item.value === "object" && item.value !== null && "value" in item.value
          ? item.value
          : { value: item.value };

        const existingFeature = await db.query.planFeatures.findFirst({
          where: and(
            eq(planFeatures.planId, targetPlanId),
            eq(planFeatures.featureId, item.featureId)
          ),
        });

        if (existingFeature) {
          await db
            .update(planFeatures)
            .set({
              value: formattedVal,
              updatedAt: now,
            })
            .where(eq(planFeatures.id, existingFeature.id));
        } else {
          await db.insert(planFeatures).values({
            planId: targetPlanId,
            featureId: item.featureId,
            value: formattedVal,
          });
        }
      }
    }

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: id ? "UPDATE_PLAN" : "CREATE_PLAN",
      planId: targetPlanId,
      featuresUpdated: Array.isArray(featureValues) ? featureValues.length : 0,
      timestamp: now.toISOString(),
    }));

    return NextResponse.json({ success: true, plan: returnedPlan });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN POST PLAN ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar plano." }, { status: 500 });
  }
}
