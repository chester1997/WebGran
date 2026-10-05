import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoLibraryPlans } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireSeller } from "@/lib/auth";

export async function GET() {
  try {
    await requireSeller();

    const plans = await db.query.videoLibraryPlans.findMany({
      where: eq(videoLibraryPlans.active, true),
      orderBy: [asc(videoLibraryPlans.price)],
    });

    // Filter out plans that have not yet been provisioned on SyncPay Platform
    const provisionedPlans = plans.filter(p => Boolean(p.syncpayPlanToken && p.syncpayPlanToken.trim()));

    const formatted = provisionedPlans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description || "",
      price: Number(p.price || 0),
      priceCents: Math.round(Number(p.price || 0) * 100),
      billingCycle: p.billingInterval || "month",
      storageQuotaGb: p.storageQuotaGb ?? 0,
      isUnlimited: p.storageQuotaGb === -1,
    }));

    return NextResponse.json({
      success: true,
      plans: formatted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar planos da Biblioteca de Vídeos." },
      { status: error.message?.includes("não autorizado") ? 401 : 500 }
    );
  }
}
