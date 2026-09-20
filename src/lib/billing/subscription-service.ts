import { db } from '@/db';
import { subscriptionPlans, subscriptions, invoices, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { coraProvider } from '@/lib/payments/providers/cora';

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
    // Default 7-day trial or pending status on initial signup
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 7);

    const created = await db
      .insert(subscriptions)
      .values({
        sellerId,
        planId: plan.id,
        status: 'ACTIVE', // Initial access active
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

  // Check if current period has expired
  const now = new Date();
  let status = sub.status;
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < now && status === 'ACTIVE') {
    status = 'PAST_DUE';
  }

  const invoiceHistory = await db.query.invoices.findMany({
    where: eq(invoices.sellerId, sellerId),
    orderBy: [desc(invoices.createdAt)],
  });

  const latestPendingInvoice = invoiceHistory.find((i) => i.status === 'PENDING');

  return {
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
    latestInvoice: latestPendingInvoice || null,
    invoiceHistory: invoiceHistory.map((inv) => ({
      id: inv.id,
      externalId: inv.externalId,
      amount: Number(inv.amount),
      status: inv.status,
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
      paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
      qrCode: inv.qrCode,
      qrCodeText: inv.qrCodeText,
    })),
  };
}

export async function createCoraBillingInvoice(sellerId: string) {
  const plan = await getDefaultPlan();
  const subData = await getSellerSubscription(sellerId);
  const subscription = subData.subscription;

  // Amount is dynamically fetched from active DB plan
  const amount = Number(plan.price);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const coraRes = await coraProvider.createInvoice({
    sellerId,
    subscriptionId: subscription.id,
    amount,
    dueDate,
  });

  const insertedInvoice = await db
    .insert(invoices)
    .values({
      sellerId,
      subscriptionId: subscription.id,
      provider: 'cora',
      externalId: coraRes.id,
      amount: amount.toFixed(2),
      status: 'PENDING',
      dueDate,
      qrCode: coraRes.qrCode || null,
      qrCodeText: coraRes.qrCodeText || null,
    })
    .returning();

  return {
    invoiceId: insertedInvoice[0].id,
    externalId: coraRes.id,
    amount: amount,
    status: 'PENDING',
    qrCode: coraRes.qrCode,
    qrCodeText: coraRes.qrCodeText,
    dueDate: dueDate.toISOString(),
  };
}

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

  // Validate expected amount R$ 89,90
  if (Number(inv.amount) !== WEBGRAN_PLAN_PRICE) {
    console.warn(`[AUDIT WARNING] Invoice ${inv.id} amount mismatch: expected ${WEBGRAN_PLAN_PRICE}, got ${inv.amount}`);
  }

  const now = new Date();
  const nextPeriodEnd = new Date(now);
  nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

  // Update Invoice Status -> PAID
  await db
    .update(invoices)
    .set({
      status: 'PAID',
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(invoices.id, inv.id));

  // Update Subscription Status -> ACTIVE & Extend Current Period
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
    paidAt: now.toISOString(),
    nextPeriodEnd: nextPeriodEnd.toISOString(),
  };
}
