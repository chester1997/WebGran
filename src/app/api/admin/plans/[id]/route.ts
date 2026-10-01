import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, subscriptions, planFeatures } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, id),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    const subCount = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.planId, id));

    return NextResponse.json({
      plan: {
        ...plan,
        price: Number(plan.price),
        activeSubscriptionsCount: subCount[0]?.count || 0,
      }
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao buscar plano." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id } = await params;
    const body = await req.json();

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, id),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    const { name, slug, price, description, billingInterval, active } = body;
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (slug !== undefined) updateData.slug = slug.toLowerCase().trim();
    if (price !== undefined) updateData.price = parseFloat(price).toFixed(2);
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (billingInterval !== undefined) updateData.billingInterval = billingInterval;
    if (active !== undefined) updateData.active = Boolean(active);

    const updated = await db
      .update(subscriptionPlans)
      .set(updateData)
      .where(eq(subscriptionPlans.id, id))
      .returning();

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "PATCH_PLAN",
      planId: id,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, plan: updated[0] });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao atualizar plano." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id } = await params;

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, id),
    });

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    // Check if any subscriptions reference this plan
    const subCount = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.planId, id));

    if (subCount[0]?.count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir este plano pois existem ${subCount[0].count} vendedores vinculados a ele.` },
        { status: 400 }
      );
    }

    // Safe deletion: remove associated plan_features then delete plan
    await db.delete(planFeatures).where(eq(planFeatures.planId, id));
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "DELETE_PLAN",
      planId: id,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, message: "Plano excluído com sucesso." });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao excluir plano." }, { status: 500 });
  }
}
