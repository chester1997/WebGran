import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoLibraryPlans, videoLibrarySubscriptions } from "@/db/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";
import { SyncPayPlatformBillingService } from "@/lib/billing/syncpay-platform-billing-service";

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();

    const plans = await db.query.videoLibraryPlans.findMany({
      orderBy: [desc(videoLibraryPlans.createdAt)],
    });

    const formattedPlans = await Promise.all(
      plans.map(async (p) => {
        const subCount = await db
          .select({ count: count() })
          .from(videoLibrarySubscriptions)
          .where(and(eq(videoLibrarySubscriptions.planId, p.id), eq(videoLibrarySubscriptions.status, 'ACTIVE')));

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          price: Number(p.price || 0),
          priceCents: Math.round(Number(p.price || 0) * 100),
          billingInterval: p.billingInterval || "month",
          active: p.active,
          storageQuotaGb: p.storageQuotaGb ?? 0,
          syncpayPlanToken: p.syncpayPlanToken || null,
          syncStatus: p.syncStatus || (p.syncpayPlanToken ? "SYNCED" : "SYNC_PENDING"),
          syncError: p.syncError || null,
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
    const { id, name, slug, price, description, billingInterval, storageQuotaGb, active, action } = body;

    // Manual Re-sync Action for existing plan
    if (action === "sync" && id) {
      const existingPlan = await db.query.videoLibraryPlans.findFirst({
        where: eq(videoLibraryPlans.id, id),
      });

      if (!existingPlan) {
        return NextResponse.json({ error: "Plano não encontrado para sincronização." }, { status: 404 });
      }

      if (existingPlan.syncpayPlanToken && existingPlan.syncStatus === "SYNCED") {
        return NextResponse.json({
          success: true,
          message: "Plano já está sincronizado com a SyncPay.",
          plan: existingPlan,
        });
      }

      try {
        const createdPlan = await SyncPayPlatformBillingService.createPlan({
          name: existingPlan.name,
          amount: Number(existingPlan.price),
          billing_method: "qr_code",
          description: existingPlan.description || "Plano da Biblioteca de Vídeos WebGran",
        });

        const [syncedPlan] = await db
          .update(videoLibraryPlans)
          .set({
            syncpayPlanToken: createdPlan.token,
            syncStatus: "SYNCED",
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(videoLibraryPlans.id, existingPlan.id))
          .returning();

        return NextResponse.json({ success: true, plan: syncedPlan });
      } catch (syncErr: any) {
        console.error("[SyncPayPlanSyncError]:", syncErr.message);
        const [errorPlan] = await db
          .update(videoLibraryPlans)
          .set({
            syncStatus: "SYNC_ERROR",
            syncError: syncErr.message || "Falha ao sincronizar com SyncPay",
            updatedAt: new Date(),
          })
          .where(eq(videoLibraryPlans.id, existingPlan.id))
          .returning();

        return NextResponse.json(
          {
            success: false,
            error: `Não foi possível sincronizar este plano com a SyncPay: ${syncErr.message}`,
            plan: errorPlan,
          },
          { status: 400 }
        );
      }
    }

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

    const quotaNumber = storageQuotaGb === -1 || storageQuotaGb === "-1" ? -1 : Number(storageQuotaGb) || 20;

    const now = new Date();
    let planRecord;

    if (id) {
      const existingPlan = await db.query.videoLibraryPlans.findFirst({
        where: eq(videoLibraryPlans.id, id),
      });

      const [updated] = await db
        .update(videoLibraryPlans)
        .set({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          storageQuotaGb: quotaNumber,
          description: description ? description.trim() : null,
          billingInterval: billingInterval || "month",
          active: active !== undefined ? Boolean(active) : true,
          updatedAt: now,
        })
        .where(eq(videoLibraryPlans.id, id))
        .returning();

      planRecord = updated;
    } else {
      const [created] = await db
        .insert(videoLibraryPlans)
        .values({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          storageQuotaGb: quotaNumber,
          description: description ? description.trim() : null,
          billingInterval: billingInterval || "month",
          active: active !== undefined ? Boolean(active) : true,
          syncStatus: "SYNC_PENDING",
        })
        .returning();

      planRecord = created;
    }

    // Provision on SyncPay Platform if not already provisioned
    if (!planRecord.syncpayPlanToken) {
      try {
        const createdSyncpayPlan = await SyncPayPlatformBillingService.createPlan({
          name: planRecord.name,
          amount: Number(planRecord.price),
          billing_method: "qr_code",
          description: planRecord.description || "Plano da Biblioteca de Vídeos WebGran",
        });

        const [synced] = await db
          .update(videoLibraryPlans)
          .set({
            syncpayPlanToken: createdSyncpayPlan.token,
            syncStatus: "SYNCED",
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(videoLibraryPlans.id, planRecord.id))
          .returning();

        planRecord = synced;
      } catch (syncErr: any) {
        console.error("[SyncPayPlanCreateError]:", syncErr.message);
        const [errorState] = await db
          .update(videoLibraryPlans)
          .set({
            syncStatus: "SYNC_ERROR",
            syncError: syncErr.message || "Falha ao provisionar na SyncPay",
            updatedAt: new Date(),
          })
          .where(eq(videoLibraryPlans.id, planRecord.id))
          .returning();

        planRecord = errorState;
      }
    }

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "SAVE_VIDEO_LIBRARY_PLAN",
      planId: planRecord.id,
      quotaGb: quotaNumber,
      syncStatus: planRecord.syncStatus,
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
