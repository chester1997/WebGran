import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoLibraryPlans, videoLibrarySubscriptions } from "@/db/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";

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

    const quotaNumber = storageQuotaGb === -1 || storageQuotaGb === "-1" ? -1 : Number(storageQuotaGb) || 20;

    const now = new Date();
    let planRecord;

    if (id) {
      const updated = await db
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

      planRecord = updated[0];
    } else {
      const created = await db
        .insert(videoLibraryPlans)
        .values({
          name: name.trim(),
          slug: cleanSlug,
          price: numericPrice.toFixed(2),
          storageQuotaGb: quotaNumber,
          description: description ? description.trim() : null,
          billingInterval: billingInterval || "month",
          active: active !== undefined ? Boolean(active) : true,
        })
        .returning();

      planRecord = created[0];
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
