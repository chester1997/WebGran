import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoLibrarySubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSeller } from "@/lib/auth";
import { SyncPayPlatformBillingReconciliationService } from "@/lib/billing/syncpay-platform-reconciliation-service";

export async function POST() {
  try {
    const seller = await requireSeller();

    const videoSub = await db.query.videoLibrarySubscriptions.findFirst({
      where: eq(videoLibrarySubscriptions.sellerId, seller.id),
      with: { plan: true },
    });

    if (!videoSub) {
      return NextResponse.json({ success: false, error: "Nenhuma assinatura de vídeo encontrada." }, { status: 404 });
    }

    if (videoSub.status === "ACTIVE") {
      return NextResponse.json({
        success: true,
        status: "ACTIVE",
        subscription: videoSub,
      });
    }

    if (videoSub.syncpaySubscriptionToken) {
      const recResult = await SyncPayPlatformBillingReconciliationService.reconcileByToken(videoSub.syncpaySubscriptionToken);
      
      const refreshedSub = await db.query.videoLibrarySubscriptions.findFirst({
        where: eq(videoLibrarySubscriptions.id, videoSub.id),
        with: { plan: true },
      });

      if (refreshedSub?.status === "ACTIVE") {
        return NextResponse.json({
          success: true,
          status: "ACTIVE",
          subscription: refreshedSub,
        });
      }
    }

    return NextResponse.json({
      success: false,
      status: videoSub.status,
      message: "Pagamento ainda pendente de confirmação.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Erro ao verificar pagamento." }, { status: 500 });
  }
}
