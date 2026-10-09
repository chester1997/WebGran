import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks for DB and Payment Providers
vi.mock('@/db', () => {
  return {
    db: {
      query: {
        subscriptionPlans: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
        },
        invoices: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        users: {
          findFirst: vi.fn(),
        },
        systemSettings: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'new-invoice-id', amount: '149.90', status: 'PENDING' }]),
        })),
      })),
    },
    subscriptionPlans: {
      id: 'id',
      slug: 'slug',
      active: 'active',
      price: 'price',
      updatedAt: 'updatedAt',
    },
    subscriptions: {
      id: 'id',
      sellerId: 'seller_id',
      status: 'status',
    },
    invoices: {
      id: 'id',
      sellerId: 'seller_id',
      subscriptionId: 'subscription_id',
      status: 'status',
    },
    users: {
      id: 'id',
      role: 'role',
    },
    systemSettings: {
      key: 'key',
    },
  };
});

vi.mock('@/lib/payments/providers/mercado-pago-platform', () => ({
  mercadoPagoPlatformProvider: {
    getInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
  },
}));

vi.mock('@/lib/billing/syncpay-platform-billing-service', () => ({
  SyncPayPlatformBillingService: {
    getPlatformCredentials: vi.fn().mockResolvedValue({ clientId: 'test_client', clientSecret: 'test_secret' }),
    getPlan: vi.fn().mockResolvedValue({ amount: 149.90 }),
    createPlan: vi.fn().mockResolvedValue({ token: 'syncpay_plan_token_149' }),
    enrollSubscriber: vi.fn().mockResolvedValue({
      subscriptionToken: 'sub_tok_123',
      subscriberToken: 'subscr_tok_123',
      qrCode: 'https://qr.test/pix',
      pixCode: '00020126580014BR.GOV.BCB.PIX...',
    }),
  },
}));

vi.mock('@/lib/billing/syncpay-platform-reconciliation-service', () => ({
  SyncPayPlatformBillingReconciliationService: {
    reconcileByToken: vi.fn(),
  },
}));

import { db } from '@/db';
import { 
  getDefaultPlan, 
  getSellerSubscription, 
  createPlatformBillingInvoice, 
  confirmInvoicePayment 
} from '../subscription-service';
import { SyncPayPlatformBillingReconciliationService } from '../syncpay-platform-reconciliation-service';

describe('Subscription Price Synchronization & Validation Suite', () => {
  const sellerId = 'seller-test-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Refills Admin price change dynamically without relying on hardcoded 89.90', async () => {
    // Admin updated plan price in DB to 149.90
    (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({
      id: 'plan-webgran-id',
      name: 'WebGran',
      slug: 'webgran',
      price: '149.90',
      billingInterval: 'month',
      active: true,
    });

    const plan = await getDefaultPlan();
    expect(plan.price).toBe('149.90');
    expect(Number(plan.price)).toBe(149.90);
  });

  it('2. Seller subscription endpoint reflects updated Admin plan price', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: sellerId,
      role: 'seller',
    });

    (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({
      id: 'plan-webgran-id',
      name: 'WebGran',
      slug: 'webgran',
      price: '149.90',
      billingInterval: 'month',
      active: true,
    });

    (db.query.subscriptions.findFirst as any).mockResolvedValueOnce({
      id: 'sub-seller-1',
      sellerId,
      planId: 'plan-webgran-id',
      status: 'TRIAL',
      startedAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 3),
      invoices: [],
    });

    (db.query.invoices.findMany as any).mockResolvedValueOnce([]);

    const subData = await getSellerSubscription(sellerId);
    expect(subData.plan.price).toBe(149.90);
  });

  it('3. Checkout validates price on server and rejects browser manipulation', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: sellerId,
      name: 'Vendedor Teste',
      email: 'vendedor@teste.com',
      role: 'seller',
    });

    // DB plan has price 149.90
    (db.query.subscriptionPlans.findFirst as any).mockResolvedValue({
      id: 'plan-webgran-id',
      name: 'WebGran',
      slug: 'webgran',
      price: '149.90',
      syncpayPlanToken: 'syncpay_plan_token_149',
      active: true,
    });

    (db.query.subscriptions.findFirst as any).mockResolvedValueOnce({
      id: 'sub-seller-1',
      sellerId,
      status: 'EXPIRED',
      currentPeriodEnd: new Date(Date.now() - 1000),
    });

    (db.query.invoices.findMany as any).mockResolvedValueOnce([]);

    // Even if client tried to manipulate price parameter (not even accepted by function),
    // server calculates amount from DB plan.price = 149.90
    const invoice = await createPlatformBillingInvoice(sellerId, true);
    expect(invoice.amount).toBe(149.90);
  });

  it('4. Throws controlled error when no active plan exists instead of falling back to 89.90', async () => {
    (db.query.subscriptionPlans.findFirst as any).mockResolvedValue(null);

    await expect(getDefaultPlan()).rejects.toThrow(
      'Nenhum plano de assinatura ativo foi encontrado no sistema.'
    );
  });

  it('5. Throws controlled error when plan price is invalid (<= 0)', async () => {
    (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({
      id: 'invalid-plan',
      name: 'WebGran Invalido',
      slug: 'webgran',
      price: '0.00',
      active: true,
    });

    await expect(getDefaultPlan()).rejects.toThrow(
      'O preço do plano de assinatura "WebGran Invalido" é inválido.'
    );
  });

  it('6. Subscription is activated ONLY after valid payment confirmation', async () => {
    const invId = 'inv-syncpay-999';

    (db.query.invoices.findFirst as any).mockResolvedValueOnce({
      id: invId,
      sellerId,
      provider: 'syncpay',
      externalId: 'token_sub_test',
      amount: '149.90',
      status: 'PENDING',
    });

    // 6a. Reconciliation returns still pending -> should throw error and not activate
    (SyncPayPlatformBillingReconciliationService.reconcileByToken as any).mockResolvedValueOnce({
      newStatus: 'PENDING',
    });

    await expect(confirmInvoicePayment(invId, sellerId)).rejects.toThrow(
      'O pagamento ainda não foi identificado na SyncPay.'
    );

    // 6b. Reconciliation returns ACTIVE -> activates successfully
    (db.query.invoices.findFirst as any).mockResolvedValueOnce({
      id: invId,
      sellerId,
      provider: 'syncpay',
      externalId: 'token_sub_test',
      amount: '149.90',
      status: 'PENDING',
    });

    (SyncPayPlatformBillingReconciliationService.reconcileByToken as any).mockResolvedValueOnce({
      newStatus: 'ACTIVE',
    });

    const confirmRes = await confirmInvoicePayment(invId, sellerId);
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.message).toContain('Pagamento confirmado e assinatura ativada com sucesso');
  });
});
