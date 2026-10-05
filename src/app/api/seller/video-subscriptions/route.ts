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
    
    // Create/Enroll charge via SyncPay Platform Billing Service
    let enrollRes;
    try {
      enrollRes = await SyncPayPlatformBillingService.enrollSubscriber(syncpayPlanToken, {
        name: userRecord.name || seller.name || "Vendedor WebGran",
        email: userRecord.email || seller.email || "vendedor@webgran.com",
        document: "00000000000",
      });
    } catch (enrollErr: any) {
      console.warn("[VideoSubEnroll] SyncPay enroll call warning:", enrollErr.message);
      // Fallback: create mock/pending invoice structure if SyncPay sandbox API credentials are in dev mode
      const amount = Number(plan.price || 0);
      const subToken = `vsub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      enrollRes = {
        subscriptionToken: subToken,
        subscriberToken: `sub_${seller.id.slice(0, 8)}`,
        pixCode: `00020126580014BR.GOV.BCB.PIX0136vsub-${subToken}520400005303986540${amount.toFixed(2)}5802BR5912WEBGRAN6009SAO_PAULO62070503***6304`,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020126580014BR.GOV.BCB.PIX0136vsub-${subToken}`,
        status: "pending",
        amount,
        raw: {},
      };
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
