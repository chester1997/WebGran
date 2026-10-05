import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoLibraryPlans, videoLibrarySubscriptions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSeller } from "@/lib/auth";
import { SyncPayPlatformBillingService } from "@/lib/billing/syncpay-platform-billing-service";

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const body = await req.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ success: false, error: "Plano de armazenamento é obrigatório." }, { status: 400 });
    }

    const plan = await db.query.videoLibraryPlans.findFirst({
      where: and(eq(videoLibraryPlans.id, planId), eq(videoLibraryPlans.active, true)),
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Plano de armazenamento não encontrado ou inativo." }, { status: 404 });
    }

    // Get seller user record
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    if (!userRecord) {
      return NextResponse.json({ success: false, error: "Vendedor não encontrado." }, { status: 404 });
    }

    // Enroll subscriber on SyncPay Platform
    const syncpayPlanToken = (plan as any).syncpayPlanToken || plan.slug;
    
    let enrollRes;
    try {
      enrollRes = await SyncPayPlatformBillingService.enrollSubscriber(syncpayPlanToken, {
        name: userRecord.name || seller.name || "Vendedor WebGran",
        email: userRecord.email || seller.email || "vendedor@webgran.com",
        document: "00000000000",
      });
    } catch (enrollErr: any) {
      console.error("[VideoSubEnroll] SyncPay enroll error:", enrollErr);
      return NextResponse.json(
        {
          success: false,
          error: `Não foi possível gerar a cobrança Pix no gateway de pagamento: ${enrollErr.message || "Credenciais SyncPay da plataforma não configuradas ou plano inválido."}`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check if seller already has a video library subscription
    const existingSub = await db.query.videoLibrarySubscriptions.findFirst({
      where: eq(videoLibrarySubscriptions.sellerId, seller.id),
    });

    let subRecord;
    if (existingSub) {
      const [updated] = await db
        .update(videoLibrarySubscriptions)
        .set({
          planId: plan.id,
          status: "PENDING",
          syncpaySubscriptionToken: enrollRes.subscriptionToken,
          updatedAt: now,
        })
        .where(eq(videoLibrarySubscriptions.id, existingSub.id))
        .returning();
      subRecord = updated;
    } else {
      const [created] = await db
        .insert(videoLibrarySubscriptions)
        .values({
          sellerId: seller.id,
          planId: plan.id,
          status: "PENDING",
          syncpaySubscriptionToken: enrollRes.subscriptionToken,
        })
        .returning();
      subRecord = created;
    }

    return NextResponse.json({
      success: true,
      subscription: subRecord,
      invoice: {
        amount: Number(plan.price || 0).toFixed(2),
        qrCodeText: enrollRes.pixCode,
        qrCode: enrollRes.qrCode,
        subscriptionToken: enrollRes.subscriptionToken,
        status: "PENDING",
      },
    });
  } catch (error: any) {
    console.error("[POST VIDEO SUBSCRIPTION ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao assinar plano da biblioteca." }, { status: 500 });
  }
}
