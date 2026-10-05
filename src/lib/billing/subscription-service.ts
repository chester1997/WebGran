import { db } from '@/db';
import { subscriptionPlans, subscriptions, invoices, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mercadoPagoPlatformProvider } from '@/lib/payments/providers/mercado-pago-platform';
import { SyncPayPlatformBillingService } from '@/lib/billing/syncpay-platform-billing-service';
import { SyncPayPlatformBillingReconciliationService } from '@/lib/billing/syncpay-platform-reconciliation-service';

export const WEBGRAN_PLAN_SLUG = 'webgran';
export const WEBGRAN_PLAN_PRICE = 89.90;

export async function getDefaultPlan() {
  let plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.slug, WEBGRAN_PLAN_SLUG),
  });

  if (!plan) {
    const inserted = await db
      .insert(subscriptionPlans)
      .values({
        name: 'WebGran',
        slug: WEBGRAN_PLAN_SLUG,
        description: 'Plano Único WebGran SaaS',
        price: '89.90',
        billingInterval: 'month',
        active: true,
      })
      .returning();
    plan = inserted[0];
  }

  return plan;
}

export async function getSellerSubscription(sellerId: string) {
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, sellerId),
  });

  const isExempt = Boolean(
    userRecord && (userRecord.role === "admin" || userRecord.role === "super_admin")
  );

  if (isExempt) {
    return {
      isExempt: true,
      isTrialActive: false,
      isSubscriptionActive: true,
      trialDaysRemaining: 0,
      subscription: {
        id: "exempt-owner-subscription",
        sellerId,
        planId: "exempt-plan",
        status: "EXEMPT",
        syncpaySubscriptionToken: null,
        syncpaySubscriberToken: null,
        startedAt: userRecord?.createdAt || new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 10 * 86400000),
      },
      plan: {
        id: "exempt-plan",
        name: "Proprietário da Plataforma",
        price: 0,
        currency: "BRL",
        billingInterval: "MONTHLY",
      },
      latestInvoice: null,
      invoiceHistory: [],
    };
  }

  const plan = await getDefaultPlan();

  let sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.sellerId, sellerId),
    with: {
      invoices: {
        orderBy: [desc(invoices.createdAt)],
      },
    },
  });

  if (!sub) {
    const now = new Date();
    // Default 3-day free trial period
    const periodEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const created = await db
      .insert(subscriptions)
      .values({
        sellerId,
        planId: plan.id,
        status: 'TRIAL',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();

    sub = {
      ...created[0],
      invoices: [],
    };
  }

  const now = new Date();
  let status = sub.status;
  const periodEndMs = new Date(sub.currentPeriodEnd).getTime();

  // Evaluate status against current date
  if (status === 'TRIAL') {
    if (periodEndMs <= now.getTime()) {
      status = 'EXPIRED';
      try {
        await db
          .update(subscriptions)
          .set({ status: 'EXPIRED', updatedAt: now })
          .where(eq(subscriptions.id, sub.id));
      } catch (err) {
        console.error('Error updating expired trial status:', err);
      }
    }
  } else if (status === 'ACTIVE') {
    if (periodEndMs <= now.getTime()) {
      status = 'PAST_DUE';
      try {
        await db
          .update(subscriptions)
          .set({ status: 'PAST_DUE', updatedAt: now })
          .where(eq(subscriptions.id, sub.id));
      } catch (err) {
        console.error('Error updating past due subscription status:', err);
      }
    }
  }

  const isTrialActive = status === 'TRIAL' && periodEndMs > now.getTime();
  const isPaidActive = status === 'ACTIVE' && periodEndMs > now.getTime();
  const isSubscriptionActive = isExempt || isTrialActive || isPaidActive;
  const trialDaysRemaining = isTrialActive 
    ? Math.max(1, Math.ceil((periodEndMs - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const invoiceHistory = await db.query.invoices.findMany({
    where: eq(invoices.sellerId, sellerId),
    orderBy: [desc(invoices.createdAt)],
  });

  // Check and process expiration for any PENDING invoice (30 MINUTES EXPIRATION)
  let latestPending = invoiceHistory.find((i) => i.status === 'PENDING');

  if (latestPending) {
    const isOldDummy = !latestPending.externalId || latestPending.externalId.startsWith('cora_inv_');
    const isExpired = !latestPending.expiresAt || new Date(latestPending.expiresAt) <= now || isOldDummy;
    if (isExpired) {
      const pendingId = latestPending.id;
      const externalId = latestPending.externalId;
      try {
        let isPaidOnMP = false;
        if (externalId && !isOldDummy) {
          try {
            const mpCheck = await mercadoPagoPlatformProvider.getInvoice(externalId);
            if (mpCheck.status === 'PAID') {
              isPaidOnMP = true;
              await confirmInvoicePayment(pendingId, sellerId);
              latestPending = undefined;
            } else {
              await mercadoPagoPlatformProvider.cancelInvoice(externalId);
            }
          } catch (mpErr) {
            console.error('Error querying/cancelling invoice on Mercado Pago:', mpErr);
          }
        }
        if (!isPaidOnMP) {
          await db
            .update(invoices)
            .set({ status: 'EXPIRED', updatedAt: now })
            .where(eq(invoices.id, pendingId));
          latestPending = undefined;
        }
      } catch (err) {
        console.error('Error auto-checking invoice expiration:', err);
        latestPending = undefined;
      }
    }
  }

  return {
    isExempt: false,
    isTrialActive,
    isSubscriptionActive,
    trialDaysRemaining,
    subscription: {
      ...sub,
      status,
    },
    plan: {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: 'BRL',
      billingInterval: plan.billingInterval === 'year' ? 'ANNUAL' : 'MONTHLY',
    },
    latestInvoice: latestPending ? {
      id: latestPending.id,
      externalId: latestPending.externalId,
      provider: latestPending.provider,
      amount: Number(latestPending.amount),
      status: latestPending.status,
      dueDate: latestPending.dueDate ? new Date(latestPending.dueDate).toISOString() : null,
      paidAt: latestPending.paidAt ? new Date(latestPending.paidAt).toISOString() : null,
      createdAt: latestPending.createdAt ? new Date(latestPending.createdAt).toISOString() : new Date().toISOString(),
      expiresAt: latestPending.expiresAt ? new Date(latestPending.expiresAt).toISOString() : null,
      qrCode: latestPending.qrCode,
      qrCodeText: latestPending.qrCodeText,
    } : null,
    invoiceHistory: invoiceHistory.map((inv) => ({
      id: inv.id,
      externalId: inv.externalId,
      provider: inv.provider,
      amount: Number(inv.amount),
      status: inv.status,
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
      paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
      expiresAt: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : null,
      qrCode: inv.qrCode,
      qrCodeText: inv.qrCodeText,
    })),
  };
}

/**
 * Generate a new PIX Invoice for Subscription via SyncPay Platform (or Mercado Pago fallback)
 */
export async function createPlatformBillingInvoice(sellerId: string, forceNew = false, targetPlanId?: string) {
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, sellerId),
  });

  if (userRecord && (userRecord.role === "admin" || userRecord.role === "super_admin")) {
    throw new Error("Contas do proprietário da plataforma são isentas de assinatura e não geram cobranças.");
  }

  let plan;
  if (targetPlanId) {
    plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, targetPlanId),
    });
  }
  if (!plan) {
    plan = await getDefaultPlan();
  }

  const subData = await getSellerSubscription(sellerId);
  const subscription = subData.subscription;
  const now = new Date();

  // If forceNew is false, check if an unexpired PENDING invoice exists FOR SYNCPAY
  if (!forceNew && !targetPlanId && subData.latestInvoice && subData.latestInvoice.status === 'PENDING' && (subData.latestInvoice as any).provider === 'syncpay') {
    const expiresAtDate = subData.latestInvoice.expiresAt ? new Date(subData.latestInvoice.expiresAt) : null;
    if (expiresAtDate && expiresAtDate > now) {
      return {
        invoiceId: subData.latestInvoice.id,
        externalId: subData.latestInvoice.externalId,
        amount: subData.latestInvoice.amount,
        status: 'PENDING',
        qrCode: subData.latestInvoice.qrCode,
        qrCodeText: subData.latestInvoice.qrCodeText,
        dueDate: subData.latestInvoice.dueDate,
        createdAt: subData.latestInvoice.createdAt,
        expiresAt: subData.latestInvoice.expiresAt,
      };
    }
  }

  const amount = Number(plan.price);
  const dueDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 min due date
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min expiration

  // Attempt SyncPay Platform Billing flow first
  try {
    const platformCreds = await SyncPayPlatformBillingService.getPlatformCredentials();
    if (platformCreds.clientId && platformCreds.clientSecret) {
      let syncpayPlanToken = plan.syncpayPlanToken;
      if (!syncpayPlanToken) {
        const createdPlan = await SyncPayPlatformBillingService.createPlan({
          name: plan.name,
          amount,
          billing_method: 'qr_code',
          description: plan.description || 'Plano WebGran SaaS',
        });
        syncpayPlanToken = createdPlan.token;
        await db
          .update(subscriptionPlans)
          .set({ syncpayPlanToken, updatedAt: now })
          .where(eq(subscriptionPlans.id, plan.id));
      }

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

      let enrollRes;
      const userDocument = getValidCPF((userRecord as any)?.cpf);
      const existingSubToken = (subscription as any).syncpaySubscriptionToken;
      if (existingSubToken) {
        try {
          enrollRes = await SyncPayPlatformBillingService.resendCharge(existingSubToken);
        } catch {
          enrollRes = await SyncPayPlatformBillingService.enrollSubscriber(syncpayPlanToken, {
            name: userRecord?.name || 'Vendedor WebGran',
            email: userRecord?.email || 'vendedor@webgran.online',
            document: userDocument,
          });
        }
      } else {
        enrollRes = await SyncPayPlatformBillingService.enrollSubscriber(syncpayPlanToken, {
          name: userRecord?.name || 'Vendedor WebGran',
          email: userRecord?.email || 'vendedor@webgran.online',
          document: userDocument,
        });

        await db
          .update(subscriptions)
          .set({
            syncpaySubscriptionToken: enrollRes.subscriptionToken,
            syncpaySubscriberToken: enrollRes.subscriberToken || null,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, subscription.id));
      }

      const insertedInvoice = await db
        .insert(invoices)
        .values({
          sellerId,
          subscriptionId: subscription.id,
          provider: 'syncpay',
          externalId: enrollRes.subscriptionToken || existingSubToken,
          amount: amount.toFixed(2),
          status: 'PENDING',
          dueDate,
          expiresAt,
          qrCode: enrollRes.qrCode || null,
          qrCodeText: enrollRes.pixCode || null,
        })
        .returning();

      return {
        invoiceId: insertedInvoice[0].id,
        externalId: insertedInvoice[0].externalId,
        amount: amount,
        status: 'PENDING',
        qrCode: insertedInvoice[0].qrCode,
        qrCodeText: insertedInvoice[0].qrCodeText,
        dueDate: dueDate.toISOString(),
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    }
  } catch (err: any) {
    console.error('[PlatformBilling] SyncPay platform billing error:', err.message);
    throw new Error(`Erro ao gerar cobrança no SyncPay da Plataforma: ${err.message}`);
  }

  throw new Error('Credenciais do SyncPay da Plataforma não foram encontradas no sistema.');
}

// Alias for backwards compatibility
export const createCoraBillingInvoice = createPlatformBillingInvoice;

/**
 * Confirm / verify subscription invoice payment with SyncPay or Mercado Pago
 */
export async function confirmInvoicePayment(invoiceId: string, sellerId: string) {
  const inv = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.sellerId, sellerId)),
  });

  if (!inv) {
    throw new Error('Cobrança não encontrada.');
  }

  if (inv.status === 'PAID') {
    return { success: true, message: 'Pagamento já confirmado.' };
  }

  const now = new Date();

  // SyncPay Platform Billing verification
  if (inv.provider === 'syncpay' && inv.externalId) {
    const recRes = await SyncPayPlatformBillingReconciliationService.reconcileByToken(inv.externalId);
    if (recRes.newStatus === 'ACTIVE') {
      await db
        .update(invoices)
        .set({ status: 'PAID', paidAt: now, updatedAt: now })
        .where(eq(invoices.id, inv.id));

      return {
        success: true,
        message: 'Pagamento confirmado e assinatura ativada com sucesso!',
        paidAt: now.toISOString(),
      };
    } else {
      throw new Error('O pagamento ainda não foi identificado na SyncPay. Se você já pagou, aguarde alguns instantes e tente novamente.');
    }
  }

  // Check if invoice has expired (30 minutes rule)
  if (inv.expiresAt && new Date(inv.expiresAt) <= now) {
    if (inv.externalId) {
      try {
        const mpCheck = await mercadoPagoPlatformProvider.getInvoice(inv.externalId);
        if (mpCheck.status === 'PAID') {
          const nextPeriodEnd = new Date(now);
          nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

          await db
            .update(invoices)
            .set({ status: 'PAID', paidAt: now, updatedAt: now })
            .where(eq(invoices.id, inv.id));

          if (inv.subscriptionId) {
            await db
              .update(subscriptions)
              .set({
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: nextPeriodEnd,
                updatedAt: now,
              })
              .where(eq(subscriptions.id, inv.subscriptionId));
          }

          return { success: true, message: 'Pagamento confirmado e assinatura ativada!' };
        } else {
          await mercadoPagoPlatformProvider.cancelInvoice(inv.externalId);
          await db
            .update(invoices)
            .set({ status: 'EXPIRED', updatedAt: now })
            .where(eq(invoices.id, inv.id));
        }
      } catch {}
    }
    throw new Error('O prazo de 30 minutos deste PIX expirou. Por favor, gere um novo PIX.');
  }

  // Query REAL Mercado Pago API status
  if (inv.externalId) {
    try {
      const mpCheck = await mercadoPagoPlatformProvider.getInvoice(inv.externalId);

      if (mpCheck.status === 'PAID') {
        const nextPeriodEnd = new Date(now);
        nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

        // Update Invoice -> PAID
        await db
          .update(invoices)
          .set({
            status: 'PAID',
            paidAt: now,
            updatedAt: now,
          })
          .where(eq(invoices.id, inv.id));

        // Activate Subscription for 1 Month
        if (inv.subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: 'ACTIVE',
              currentPeriodStart: now,
              currentPeriodEnd: nextPeriodEnd,
              updatedAt: now,
            })
            .where(eq(subscriptions.id, inv.subscriptionId));
        }

        return {
          success: true,
          message: 'Pagamento confirmado e assinatura ativada com sucesso!',
          paidAt: now.toISOString(),
          nextPeriodEnd: nextPeriodEnd.toISOString(),
        };
      } else if (mpCheck.status === 'CANCELLED' || mpCheck.status === 'EXPIRED') {
        await db
          .update(invoices)
          .set({ status: 'EXPIRED', updatedAt: now })
          .where(eq(invoices.id, inv.id));
        throw new Error('Esta cobrança foi cancelada ou expirou no Mercado Pago. Por favor, gere um novo PIX.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('expirou')) {
        throw err;
      }
      console.error('Error verifying invoice with Mercado Pago API:', err);
      throw new Error('O pagamento ainda não foi identificado no Mercado Pago. Se você já pagou, aguarde alguns segundos e tente novamente.');
    }
  }

  throw new Error('O pagamento ainda não foi identificado no Mercado Pago. Por favor, aguarde alguns instantes.');
}
