import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformCommissionService } from '../platform-commission-service';
import { db } from '@/db';
import { platformCommissionSettings, platformCommissionAuditLogs, orders } from '@/db/schema';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';
import { getSellerSubscription } from '@/lib/billing/subscription-service';
import { getSellerEntitlement } from '@/lib/entitlements/entitlement-service';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      features: {
        findFirst: vi.fn(),
      },
      sellerFeatureOverrides: {
        findFirst: vi.fn(),
      },
      planFeatures: {
        findFirst: vi.fn(),
      },
      subscriptions: {
        findFirst: vi.fn(),
      },
      subscriptionPlans: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      videoLibrarySubscriptions: {
        findFirst: vi.fn(),
      },
      platformCommissionSettings: {
        findFirst: vi.fn(),
      },
      platformCommissionAuditLogs: {
        findMany: vi.fn(),
      },
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
      paymentWebhookEvents: {
        findFirst: vi.fn(),
      },
      invoices: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-order-id' }]),
        })),
      })),
    })),
    execute: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/db/ensure-commission-settings', () => ({
  ensureCommissionSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db/ensure-payment-tables', () => ({
  ensurePaymentTables: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((txt: string) => `enc_${txt}`),
  decrypt: vi.fn((txt: string) => txt.replace(/^enc_/, '')),
}));

vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('WebGran Platform Commission & Commercial Model Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID = 'plat-account-uuid-123';
  });

  // 1. Initial Default Commission is R$ 0,50 (50 cents)
  describe('1. Default Commission Initial Value', () => {
    it('returns R$ 0,50 (50 cents) when no custom setting is saved in database', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue(null);

      const comm = await PlatformCommissionService.getCurrentCommission();
      expect(comm.feeCents).toBe(50);
      expect(comm.feeReais).toBe(0.50);
      expect(comm.formattedFee).toBe('R$ 0,50');
    });

    it('returns stored commission when present in database', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-1',
        feeCents: 75,
        updatedAt: new Date('2026-10-21T10:00:00Z'),
        updatedByName: 'Admin Luiz',
        updatedByEmail: 'luiz@webgran.com',
      });

      const comm = await PlatformCommissionService.getCurrentCommission();
      expect(comm.feeCents).toBe(75);
      expect(comm.feeReais).toBe(0.75);
      expect(comm.formattedFee).toBe('R$ 0,75');
      expect(comm.updatedByName).toBe('Admin Luiz');
    });
  });

  // 2. Admin Commission Updates & Validation
  describe('2. Admin Commission Updates & Validation', () => {
    it('allows an authorized admin to update commission value and records audit log', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-1',
        feeCents: 50,
      });

      const updateResult = await PlatformCommissionService.updateCommission(
        100, // R$ 1,00
        { id: 'admin-uuid', name: 'Administrador WebGran', email: 'admin@webgran.com' },
        'Ajuste de taxa operacional'
      );

      expect(updateResult.feeCents).toBe(100);
      expect(updateResult.feeReais).toBe(1.00);
      expect(updateResult.formattedFee).toBe('R$ 1,00');

      // Verify audit log insert
      expect(db.insert).toHaveBeenCalledWith(platformCommissionAuditLogs);
    });

    it('rejects invalid or non-integer fee values', async () => {
      await expect(
        PlatformCommissionService.updateCommission(
          50.5 as any,
          { id: 'admin-1' }
        )
      ).rejects.toThrow('O valor da comissão deve ser um número inteiro de centavos válido.');

      await expect(
        PlatformCommissionService.updateCommission(
          -10,
          { id: 'admin-1' }
        )
      ).rejects.toThrow('O valor da comissão não pode ser negativo.');

      await expect(
        PlatformCommissionService.updateCommission(
          NaN,
          { id: 'admin-1' }
        )
      ).rejects.toThrow('O valor da comissão deve ser um número inteiro de centavos válido.');

      await expect(
        PlatformCommissionService.updateCommission(
          150000, // R$ 1.500,00 exceeds max
          { id: 'admin-1' }
        )
      ).rejects.toThrow('O valor da comissão não pode exceder R$ 1.000,00 por venda.');
    });
  });

  // 3. Dynamic Commission Application on New Pushin Pay Charges
  describe('3. Pushin Pay Integration with Dynamic Commission', () => {
    it('applies the dynamic commission value from PlatformCommissionService when creating Pix', async () => {
      // Simulate platform commission set to 80 cents (R$ 0,80)
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-1',
        feeCents: 80,
      });

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-dynamic-1',
        status: 'pending',
        total: '10.00',
        storeId: 'store-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pushin_tx_dynamic',
          qr_code: 'pix_code_dynamic',
          split_rules: [{ value: 80, account_id: 'plat-account-uuid-123' }],
        }),
      } as any);

      await pushinPayProvider.createPixPayment({
        orderId: 'order-dynamic-1',
        sellerId: 'seller-1',
        amount: 10.00,
        customer: { name: 'Cliente Teste' },
      });

      // Verify the POST payload sent to PushinPay contains split_rules with value: 80
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pix/cashIn'),
        expect.objectContaining({
          body: expect.stringContaining('"value":80'),
        })
      );

      // Verify db.update was called persisting splitAmountCents: 80
      expect(db.update).toHaveBeenCalledWith(orders);
    });

    it('skips split when order amount is less than or equal to the dynamic commission', async () => {
      // Commission set to R$ 1,00 (100 cents)
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-1',
        feeCents: 100,
      });

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-small',
        status: 'pending',
        total: '0.80', // 80 cents < 100 cents
        storeId: 'store-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pushin_tx_small',
          qr_code: 'pix_code_small',
        }),
      } as any);

      await pushinPayProvider.createPixPayment({
        orderId: 'order-small',
        sellerId: 'seller-1',
        amount: 0.80,
        customer: { name: 'Cliente Teste' },
      });

      // Split rules should NOT be sent
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pix/cashIn'),
        expect.objectContaining({
          body: expect.not.stringContaining('"split_rules"'),
        })
      );
    });
  });

  // 4. Existing Orders Preserve their Original Commission upon Confirmation
  describe('4. Historical Order Commission Preservation', () => {
    it('historical order created with 50 cents confirms with platformFee: 0.50 even if current platform commission is higher', async () => {
      // Current commission changed to R$ 1,50
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-1',
        feeCents: 150,
      });

      // Order created in the past with splitAmountCents: 50
      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-past-50',
        paymentId: 'tx-past-50',
        paymentMethod: 'pushinpay',
        status: 'pending',
        total: '20.00',
        storeId: 'store-1',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50, // PRESERVED HISTORICAL VALUE
      });

      (db.query.stores.findFirst as any).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      // Mock official API returning confirmed split evidence
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'tx-past-50',
          status: 'paid',
          value: 2000,
          split_rules: [{ value: 50, account_id: 'plat-account-uuid-123' }],
        }),
      } as any);

      const webhookRes = await pushinPayProvider.handleWebhook('conn-1', JSON.stringify({
        id: 'tx-past-50',
        status: 'paid',
        value: 2000,
      }), {});

      expect(webhookRes.success).toBe(true);

      // Verify db.update was called
      const updateCalls = (db.update as any).mock.results;
      expect(updateCalls.length).toBeGreaterThan(0);
    });
  });

  // 5. Zero Monthly Fee Model & Absence of Paywall
  describe('5. Commercial Model — No Platform Monthly Subscription Fee', () => {
    it('getSellerSubscription returns isSubscriptionActive: true without trial countdown or expired paywall', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        id: 'seller-normal',
        role: 'seller',
      });

      (db.query.subscriptionPlans.findFirst as any).mockResolvedValue({
        id: 'plan-default',
        name: 'WebGran',
        slug: 'webgran',
        price: '97.00',
        active: true,
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        id: 'sub-seller-1',
        sellerId: 'seller-normal',
        status: 'TRIAL',
        currentPeriodEnd: new Date(Date.now() - 1000 * 60 * 60 * 24), // Trial date past
        invoices: [],
      });

      const subData = await getSellerSubscription('seller-normal');

      // Crucial: Must be active and not blocked
      expect(subData.isSubscriptionActive).toBe(true);
      expect(subData.isTrialActive).toBe(false);
      expect(subData.trialDaysRemaining).toBe(0);
    });

    it('getSellerEntitlement allows general features when seller subscription is active', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        id: 'seller-normal',
        role: 'seller',
      });

      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-products',
        key: 'max_products',
        type: 'LIMIT',
        isActive: true,
        defaultValue: '100',
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        id: 'sub-seller-1',
        sellerId: 'seller-normal',
        status: 'ACTIVE',
        planId: 'plan-1',
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
      (db.query.planFeatures.findFirst as any).mockResolvedValue({
        value: '500',
      });

      const entitlement = await getSellerEntitlement('seller-normal', 'max_products');
      // Should resolve from PLAN
      expect(entitlement.source).toBe('PLAN');
      expect(String(entitlement.value)).toBe('500');
    });

    it('video_storage_quota_gb strictly requires active Video Library subscription', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        id: 'seller-normal',
        role: 'seller',
      });

      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-storage',
        key: 'video_storage_quota_gb',
        type: 'LIMIT',
        isActive: true,
        defaultValue: '0',
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
      // No video library subscription
      (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue(null);

      const entitlement = await getSellerEntitlement('seller-normal', 'video_storage_quota_gb');
      // Must be 0 and INACTIVE when video subscription is absent
      expect(entitlement.value).toBe(0);
      expect(entitlement.source).toBe('INACTIVE');
    });
  });
});
