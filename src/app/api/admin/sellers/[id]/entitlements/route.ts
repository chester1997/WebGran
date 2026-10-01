import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, subscriptions, subscriptionPlans, features, sellerFeatureOverrides, planFeatures } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { getSellerEntitlement, setSellerOverride, removeSellerOverride } from "@/lib/entitlements/entitlement-service";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();
    const { id: sellerId } = await params;

    const seller = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
    });

    if (!seller) {
      return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    }

    const allFeatures = await db.query.features.findMany({
      orderBy: [desc(features.createdAt)],
    });

    const currentSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.sellerId, sellerId),
      with: { plan: true },
      orderBy: [desc(subscriptions.createdAt)],
    });

    const activeOverrides = await db.query.sellerFeatureOverrides.findMany({
      where: eq(sellerFeatureOverrides.sellerId, sellerId),
      with: { feature: true },
    });

    const overrideMap = new Map<string, any>();
    for (const ov of activeOverrides) {
      overrideMap.set(ov.feature.key, ov);
    }

    // Fetch Plan Feature values
    let planFeatureMap = new Map<string, any>();
    if (currentSub?.planId) {
      const pfs = await db.query.planFeatures.findMany({
        where: eq(planFeatures.planId, currentSub.planId),
      });
      for (const pf of pfs) {
        planFeatureMap.set(pf.featureId, pf.value);
      }
    }

    const now = new Date();

    const entitlements = await Promise.all(
      allFeatures.map(async (f) => {
        const effective = await getSellerEntitlement(sellerId, f.key);
        const ov = overrideMap.get(f.key);

        const planValRaw = planFeatureMap.get(f.id);
        const planValue = planValRaw !== undefined
          ? (typeof planValRaw === "object" && planValRaw !== null && "value" in planValRaw ? planValRaw.value : planValRaw)
          : (typeof f.defaultValue === "object" && f.defaultValue !== null && "value" in f.defaultValue ? f.defaultValue.value : f.defaultValue);

        const overrideValRaw = ov ? ov.overrideValue : undefined;
        const overrideValue = overrideValRaw !== undefined
          ? (typeof overrideValRaw === "object" && overrideValRaw !== null && "value" in overrideValRaw ? overrideValRaw.value : overrideValRaw)
          : null;

        const isOverrideExpired = ov?.expiresAt ? new Date(ov.expiresAt) <= now : false;

        return {
          featureId: f.id,
          featureKey: f.key,
          featureName: f.name,
          category: f.category,
          type: f.type,
          planValue,
          overrideValue,
          effectiveValue: effective.value,
          effectiveSource: effective.source,
          isUnlimited: effective.isUnlimited,
          overrideReason: ov?.reason || null,
          overrideExpiresAt: ov?.expiresAt ? new Date(ov.expiresAt).toISOString() : null,
          isOverrideExpired,
          hasOverride: Boolean(ov),
        };
      })
    );

    const availablePlans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.active, true),
    });

    return NextResponse.json({
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role,
      },
      currentSubscription: currentSub ? {
        id: currentSub.id,
        planId: currentSub.planId,
        planName: currentSub.plan?.name || "Sem Plano",
        status: currentSub.status,
      } : null,
      availablePlans: availablePlans.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
      })),
      entitlements,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao buscar entitlements." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id: sellerId } = await params;
    const body = await req.json();
    const { featureKey, overrideValue, reason, expiresAt } = body;

    if (!featureKey) {
      return NextResponse.json({ error: "Chave do recurso é obrigatória." }, { status: 400 });
    }

    if (overrideValue === undefined || overrideValue === null || overrideValue === "") {
      return NextResponse.json({ error: "Valor do override é obrigatório." }, { status: 400 });
    }

    const expDate = expiresAt ? new Date(expiresAt) : null;

    await setSellerOverride({
      sellerId,
      featureKey,
      overrideValue,
      reason: reason ? reason.trim() : undefined,
      expiresAt: expDate,
      createdBy: adminUser.id,
    });

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "SET_SELLER_OVERRIDE",
      sellerId,
      featureKey,
      overrideValue,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, message: "Override salvo com sucesso!" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao salvar override." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id: sellerId } = await params;
    const { searchParams } = new URL(req.url);
    const featureKey = searchParams.get("featureKey");

    if (!featureKey) {
      return NextResponse.json({ error: "Chave do recurso é obrigatória no parâmetro query." }, { status: 400 });
    }

    await removeSellerOverride(sellerId, featureKey);

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "REMOVE_SELLER_OVERRIDE",
      sellerId,
      featureKey,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, message: "Override removido com sucesso!" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao remover override." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id: sellerId } = await params;
    const body = await req.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "ID do plano é obrigatório." }, { status: 400 });
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano informado não existe." }, { status: 404 });
    }

    const currentSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.sellerId, sellerId),
      orderBy: [desc(subscriptions.createdAt)],
    });

    const now = new Date();

    if (currentSub) {
      await db
        .update(subscriptions)
        .set({
          planId: plan.id,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, currentSub.id));
    } else {
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(subscriptions).values({
        sellerId,
        planId: plan.id,
        status: "ACTIVE",
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    }

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "CHANGE_SELLER_PLAN",
      sellerId,
      newPlanId: plan.id,
      timestamp: now.toISOString(),
    }));

    return NextResponse.json({ success: true, message: `Plano do vendedor alterado para ${plan.name} com sucesso!` });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao alterar plano do vendedor." }, { status: 500 });
  }
}
