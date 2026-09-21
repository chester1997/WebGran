import { db } from '@/db';
import { subscriptionPlans, subscriptions, invoices, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mercadoPagoPlatformProvider } from '@/lib/payments/providers/mercado-pago-platform';

export const WEBGRAN_PLAN_SLUG = 'webgran';
export const WEBGRAN_PLAN_PRICE = 89.90;

let schemaEnsured = false;
export async function ensureInvoiceSchema() {
  if (schemaEnsured) return;
  try {
    await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;`);
    schemaEnsured = true;
  } catch (err) {
    console.error('Error ensuring expires_at column:', err);
  }
}

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
  await ensureInvoiceSchema();

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
    // Default 7-day initial trial/grace period
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 7);

    const created = await db
      .insert(subscriptions)
      .values({
        sellerId,
        planId: plan.id,
        status: 'ACTIVE',
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
 * Generate a new Mercado Pago PIX Invoice for Subscription (30 MINUTES EXPIRATION)
 */
export async function createPlatformBillingInvoice(sellerId: string, forceNew = false) {
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

  // Calculate EXACT 30 MINUTES EXPIRATION server-side
  const amount = Number(plan.price);
  const dueDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 min due date
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // EXACT 30 MINUTES EXPIRATION

  // Create REAL PIX Payment on Mercado Pago API (Platform Owner Account)
  const mpRes = await mercadoPagoPlatformProvider.createInvoice({
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
      provider: 'mercado_pago',
      externalId: mpRes.id,
      amount: amount.toFixed(2),
      status: 'PENDING',
      dueDate,
      expiresAt,
      qrCode: mpRes.qrCode || null,
      qrCodeText: mpRes.qrCodeText || null,
    })
    .returning();

  return {
    invoiceId: insertedInvoice[0].id,
    externalId: mpRes.id,
    amount: amount,
    status: 'PENDING',
    qrCode: mpRes.qrCode,
    qrCodeText: mpRes.qrCodeText,
    dueDate: dueDate.toISOString(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// Alias for backwards compatibility
export const createCoraBillingInvoice = createPlatformBillingInvoice;

/**
 * Confirm / verify subscription invoice payment with REAL Mercado Pago API call
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
