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
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, sellerId),
  });

  const isExempt = Boolean(
    userRecord && (userRecord.role === "admin" || userRecord.role === "super_admin")
  );

  if (isExempt) {
    return {
      isExempt: true,
      subscription: {
        id: "exempt-owner-subscription",
        sellerId,
        planId: "exempt-plan",
        status: "EXEMPT",
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

  const now = new Date();
  let status = sub.status;
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < now && status === 'ACTIVE') {
    status = 'PAST_DUE';
  }

  const invoiceHistory = await db.query.invoices.findMany({
    where: eq(invoices.sellerId, sellerId),
    orderBy: [desc(invoices.createdAt)],
  });

  // Check and process expiration for any PENDING invoice
  let latestPending = invoiceHistory.find((i) => i.status === 'PENDING');

  if (latestPending) {
    const isExpired = latestPending.expiresAt && new Date(latestPending.expiresAt) <= now;
    if (isExpired) {
      try {
        // Query real Cora API status
        if (latestPending.externalId) {
          const coraCheck = await coraProvider.getInvoice(latestPending.externalId);
          if (coraCheck.status === 'PAID') {
            await confirmInvoicePayment(latestPending.id, sellerId);
            latestPending = undefined;
          } else {
            // Cancel on Cora & mark EXPIRED
            await coraProvider.cancelInvoice(latestPending.externalId);
            await db
              .update(invoices)
              .set({ status: 'EXPIRED', updatedAt: now })
              .where(eq(invoices.id, latestPending.id));
            latestPending = undefined;
          }
        }
      } catch (err) {
        console.error('Error auto-checking invoice expiration:', err);
      }
    }
  }

  return {
    isExempt: false,
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
 * Generate a new Cora PIX Invoice for Subscription (10 min expiration)
 */
export async function createCoraBillingInvoice(sellerId: string, forceNew = false) {
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, sellerId),
  });

  if (userRecord && (userRecord.role === "admin" || userRecord.role === "super_admin")) {
    throw new Error("Contas do proprietário da plataforma são isentas de assinatura e não geram cobranças.");
  }

  const plan = await getDefaultPlan();
  const subData = await getSellerSubscription(sellerId);
  const subscription = subData.subscription;
  const now = new Date();

  // If forceNew is false, check if an unexpired PENDING invoice exists
  if (!forceNew && subData.latestInvoice && subData.latestInvoice.status === 'PENDING') {
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

  // Calculate 10 MINUTES EXPIRATION server-side
  const amount = Number(plan.price);
  const dueDate = new Date(now.getTime() + 3 * 86400000); // 3 days due date in Cora
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // EXACT 10 MINUTES EXPIRATION

  // Create Invoice on Cora Bank API (REAL mTLS CALL, NO MOCK)
  const coraRes = await coraProvider.createInvoice({
    sellerId,
    subscriptionId: subscription.id,
    amount,
    dueDate,
    customerName: userRecord?.name || 'Vendedor WebGran',
    customerEmail: userRecord?.email || 'vendedor@webgran.online',
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
      expiresAt,
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
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Confirm / verify subscription invoice payment with REAL Cora API call
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

  // Check if invoice has expired (10 minutes rule)
  if (inv.expiresAt && new Date(inv.expiresAt) <= now) {
    // Check if Cora API shows it was actually paid before expiring
    if (inv.externalId) {
      try {
        const coraCheck = await coraProvider.getInvoice(inv.externalId);
        if (coraCheck.status === 'PAID') {
          // Process payment
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
          // Cancel on Cora & mark EXPIRED
          await coraProvider.cancelInvoice(inv.externalId);
          await db
            .update(invoices)
            .set({ status: 'EXPIRED', updatedAt: now })
            .where(eq(invoices.id, inv.id));
        }
      } catch {}
    }
    throw new Error('O prazo de 10 minutos deste PIX expirou. Por favor, gere um novo PIX.');
  }

  // Query REAL Cora API status
  if (inv.externalId) {
    try {
      const coraCheck = await coraProvider.getInvoice(inv.externalId);

      if (coraCheck.status === 'PAID') {
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

        // Activate Subscription
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
      } else if (coraCheck.status === 'CANCELLED' || coraCheck.status === 'EXPIRED') {
        await db
          .update(invoices)
          .set({ status: 'EXPIRED', updatedAt: now })
          .where(eq(invoices.id, inv.id));
        throw new Error('Esta cobrança foi cancelada ou expirou no banco Cora. Por favor, gere um novo PIX.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('expirou')) {
        throw err;
      }
      console.error('Error verifying invoice with Cora API:', err);
      throw new Error('O pagamento ainda não foi identificado no Banco Cora. Se você já pagou, aguarde alguns segundos e tente novamente.');
    }
  }

  throw new Error('O pagamento ainda não foi identificado no Banco Cora. Por favor, aguarde alguns instantes.');
}
