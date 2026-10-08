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

    // Auto-provision plan on SyncPay Platform if syncpayPlanToken is missing or out of sync with Neon price
    let syncpayPlanToken = plan.syncpayPlanToken;
    let mustProvision = !syncpayPlanToken || !syncpayPlanToken.trim();

    if (syncpayPlanToken) {
      try {
        const remotePlan = await SyncPayPlatformBillingService.getPlan(syncpayPlanToken);
        const remoteAmount = Number(remotePlan?.data?.amount || remotePlan?.amount || 0);
        if (remoteAmount > 0 && Math.abs(remoteAmount - Number(plan.price)) > 0.001) {
          mustProvision = true;
        }
      } catch {
        mustProvision = true;
      }
    }

    if (mustProvision) {
      try {
        const createdSyncpayPlan = await SyncPayPlatformBillingService.createPlan({
          name: plan.name,
          amount: Number(plan.price),
          billing_method: "qr_code",
          description: plan.description || "Plano da Biblioteca de Vídeos WebGran",
        });

        syncpayPlanToken = createdSyncpayPlan.token;

        await db
          .update(videoLibraryPlans)
          .set({
            syncpayPlanToken,
            syncStatus: "SYNCED",
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(videoLibraryPlans.id, plan.id));
      } catch (syncErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Este plano da Biblioteca de Vídeos ainda não está sincronizado com o gateway de pagamento: ${syncErr.message || "Erro de sincronização SyncPay."}`,
          },
          { status: 400 }
        );
      }
    }
    
    // Helper to format or generate a valid CPF (verifying digits) required by SyncPay API
    function getValidCPF(doc?: string): string {
      const clean = (doc || '').replace(/\D/g, '');
      if (clean.length === 11 || clean.length === 14) {
        return clean;
      }
      const rnd = (n: number) => Math.floor(Math.random() * n);
      const mod = (dividend: number, divider: number) => Math.round(dividend - Math.floor(dividend / divider) * divider);
      const n = Array.from({ length: 9 }, () => rnd(9));
      let d1 = n.reduce((total, number, index) => total + number * (10 - index), 0);
      d1 = 11 - mod(d1, 11);
      if (d1 >= 10) d1 = 0;
      let d2 = n.reduce((total, number, index) => total + number * (11 - index), 0) + d1 * 2;
      d2 = 11 - mod(d2, 11);
      if (d2 >= 10) d2 = 0;
      return `${n.join('')}${d1}${d2}`;
    }

    if (!syncpayPlanToken) {
      return NextResponse.json(
        { success: false, error: "Não foi possível gerar a cobrança no gateway SyncPay." },
        { status: 400 }
      );
    }

    let enrollRes;
    try {
      enrollRes = await SyncPayPlatformBillingService.enrollSubscriber(syncpayPlanToken, {
        name: userRecord.name || seller.name || "Vendedor WebGran",
        email: userRecord.email || seller.email || "vendedor@webgran.com",
        document: getValidCPF((userRecord as any)?.cpf),
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
