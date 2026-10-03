import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSellerEntitlement, 
  hasFeature, 
  getSellerLimit, 
  getSellerQuota, 
  checkLimit, 
  setSellerOverride, 
  removeSellerOverride 
} from '../entitlement-service';

// Mock DB module
vi.mock('@/db', () => {
  return {
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        features: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        sellerFeatureOverrides: {
          findFirst: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
        },
        planFeatures: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'new-id' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
      execute: vi.fn(() => Promise.resolve()),
    },
  };
});

// Mock ensureEntitlementTablesAndSeed
vi.mock('@/db/ensure-entitlements', () => ({
  ensureEntitlementTablesAndSeed: vi.fn(() => Promise.resolve()),
  INITIAL_FEATURES: [
    { key: 'max_products', name: 'Limite de Produtos', type: 'LIMIT', category: 'catalog', defaultValue: { value: -1 } },
    { key: 'clips_enabled', name: 'Módulo de Clips', type: 'BOOLEAN', category: 'media', defaultValue: { value: true } },
    { key: 'storage_quota_gb', name: 'Cota de Armazenamento GB', type: 'QUOTA', category: 'media', defaultValue: { value: 100 } },
    { key: 'video_bandwidth_quota_gb', name: 'Cota de Tráfego GB', type: 'QUOTA', category: 'media', defaultValue: { value: 1000 } },
  ],
}));

import { db } from '@/db';
import * as ensureModule from '@/db/ensure-entitlements';

describe('Entitlements & Features Domain Unit Test Suite', () => {
  const sellerId = 'seller-123';
  const adminId = 'admin-999';
  const superAdminId = 'superadmin-888';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup: regular seller user
    (db.query.users.findFirst as any).mockImplementation(async () => {
      return { id: sellerId, role: 'seller' };
    });
  });

  describe('1. Precedence Rule 1: ADMIN & SUPER_ADMIN Exemption', () => {
    it('grants ADMIN unlimited access and ADMIN_EXEMPT source', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: adminId, role: 'admin' });
      const res = await getSellerEntitlement(adminId, 'max_products');
      expect(res.source).toBe('ADMIN_EXEMPT');
      expect(res.isUnlimited).toBe(true);

      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: adminId, role: 'admin' });
      const check = await checkLimit(adminId, 'max_products', 50000);
      expect(check.allowed).toBe(true);
      expect(check.isUnlimited).toBe(true);
      expect(check.remaining).toBeNull();
    });

    it('grants SUPER_ADMIN unlimited access for any feature', async () => {
      (db.query.users.findFirst as any).mockResolvedValueOnce({ id: superAdminId, role: 'super_admin' });
      const res = await hasFeature(superAdminId, 'clips_enabled');
      expect(res).toBe(true);
    });
  });

  describe('2. Precedence Rule 2: Active Seller Overrides', () => {
    beforeEach(() => {
      // Mock feature exists
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-products-id',
        key: 'max_products',
        type: 'LIMIT',
        isActive: true,
        defaultValue: { value: -1 },
      });
    });

    it('uses active override over plan and default settings', async () => {
      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        id: 'override-1',
        sellerId,
        featureId: 'feat-products-id',
        overrideValue: { value: 10 },
        reason: 'Upgrade promocional',
        expiresAt: null,
      });

      const res = await getSellerEntitlement(sellerId, 'max_products');
      expect(res.source).toBe('OVERRIDE');
      expect(res.value).toBe(10);
      expect(res.overrideReason).toBe('Upgrade promocional');

      const checkAllowed = await checkLimit(sellerId, 'max_products', 5);
      expect(checkAllowed.allowed).toBe(true);
      expect(checkAllowed.remaining).toBe(5);

      const checkBlocked = await checkLimit(sellerId, 'max_products', 10);
      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.remaining).toBe(0);
    });

    it('ignores EXPIRED override and falls back to next precedence layer', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        id: 'override-expired',
        sellerId,
        featureId: 'feat-products-id',
        overrideValue: { value: 5 },
        expiresAt: pastDate,
      });

      // Mock subscription plan fallback
      (db.query.subscriptions.findFirst as any).mockResolvedValue({ planId: 'plan-pro' });
      (db.query.planFeatures.findFirst as any).mockResolvedValue({ value: { value: 100 } });

      const res = await getSellerEntitlement(sellerId, 'max_products');
      expect(res.source).toBe('PLAN');
      expect(res.value).toBe(100);
    });

    it('supports override disabling a BOOLEAN feature (override value = false)', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-clips-id',
        key: 'clips_enabled',
        type: 'BOOLEAN',
        isActive: true,
        defaultValue: { value: true },
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        id: 'override-block',
        sellerId,
        featureId: 'feat-clips-id',
        overrideValue: { value: false },
        reason: 'Bloqueio administrativo',
        expiresAt: null,
      });

      const enabled = await hasFeature(sellerId, 'clips_enabled');
      expect(enabled).toBe(false);
    });
  });

  describe('3. Precedence Rule 3 & 4: Plan Features and Global Defaults', () => {
    beforeEach(() => {
      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    });

    it('uses plan feature value when configured on seller plan', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-banners-id',
        key: 'max_banners',
        type: 'LIMIT',
        isActive: true,
        defaultValue: { value: 5 },
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue({ planId: 'plan-pro' });
      (db.query.planFeatures.findFirst as any).mockResolvedValue({ value: { value: 20 } });

      const res = await getSellerEntitlement(sellerId, 'max_banners');
      expect(res.source).toBe('PLAN');
      expect(res.value).toBe(20);
    });

    it('falls back to global default when seller has no subscription plan feature', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-banners-id',
        key: 'max_banners',
        type: 'LIMIT',
        isActive: true,
        defaultValue: { value: 5 },
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const res = await getSellerEntitlement(sellerId, 'max_banners');
      expect(res.source).toBe('DEFAULT');
      expect(res.value).toBe(5);
    });
  });

  describe('4. Missing or Inactive Features', () => {
    it('handles NOT_FOUND feature safely', async () => {
      (db.query.features.findFirst as any).mockResolvedValue(null);

      const res = await getSellerEntitlement(sellerId, 'non_existent_key');
      expect(res.source).toBe('NOT_FOUND');
      expect(res.value).toBe(false);

      const enabled = await hasFeature(sellerId, 'non_existent_key');
      expect(enabled).toBe(false);

      const check = await checkLimit(sellerId, 'non_existent_key', 0);
      expect(check.allowed).toBe(false);
    });

    it('handles INACTIVE feature safely', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-disabled-id',
        key: 'deprecated_feature',
        type: 'BOOLEAN',
        isActive: false,
        defaultValue: { value: true },
      });

      const res = await getSellerEntitlement(sellerId, 'deprecated_feature');
      expect(res.source).toBe('INACTIVE');
      expect(res.value).toBe(false);

      const enabled = await hasFeature(sellerId, 'deprecated_feature');
      expect(enabled).toBe(false);
    });
  });

  describe('5. Quotas & Limit Helpers', () => {
    it('returns null for unlimited numerical limits (-1)', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-unlimited',
        key: 'max_products',
        type: 'LIMIT',
        isActive: true,
        defaultValue: { value: -1 },
      });

      const limitVal = await getSellerLimit(sellerId, 'max_products');
      expect(limitVal).toBeNull();
    });

    it('resolves QUOTA values correctly via getSellerQuota', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-storage',
        key: 'storage_quota_gb',
        type: 'QUOTA',
        isActive: true,
        defaultValue: { value: 100 },
      });

      const quotaVal = await getSellerQuota(sellerId, 'storage_quota_gb');
      expect(quotaVal).toBe(100);
    });
  });

  describe('6. Admin Override Utilities', () => {
    it('calls db.insert or db.update correctly in setSellerOverride', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-1',
        key: 'max_banners',
      });
      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);

      await setSellerOverride({
        sellerId,
        featureKey: 'max_banners',
        overrideValue: 15,
        reason: 'Teste admin',
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('calls db.delete correctly in removeSellerOverride', async () => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-1',
        key: 'max_banners',
      });

      await removeSellerOverride(sellerId, 'max_banners');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('7. Subscription Status Validation Suite (Fase 6A)', () => {
    beforeEach(() => {
      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-bot-id',
        key: 'telegram_bot',
        type: 'BOOLEAN',
        isActive: true,
        defaultValue: { value: false },
      });

      (db.query.planFeatures.findFirst as any).mockResolvedValue({
        id: 'pf-bot-id',
        planId: 'plan-pro',
        featureId: 'feat-bot-id',
        value: { value: true },
      });
    });

    it('A) status TRIAL ativo -> libera feature do plano', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-trial',
        planId: 'plan-pro',
        status: 'TRIAL',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });

      const res = await getSellerEntitlement('seller-trial', 'telegram_bot');
      expect(res.source).toBe('PLAN');
      expect(res.value).toBe(true);

      const hasBot = await hasFeature('seller-trial', 'telegram_bot');
      expect(hasBot).toBe(true);
    });

    it('B) status ACTIVE ativo -> libera feature do plano', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-active',
        planId: 'plan-pro',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });

      const res = await getSellerEntitlement('seller-active', 'telegram_bot');
      expect(res.source).toBe('PLAN');
      expect(res.value).toBe(true);

      const hasBot = await hasFeature('seller-active', 'telegram_bot');
      expect(hasBot).toBe(true);
    });

    it('C) status PAST_DUE -> NÃO libera feature do plano e faz fallback para DEFAULT', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-pastdue',
        planId: 'plan-pro',
        status: 'PAST_DUE',
        currentPeriodEnd: new Date(Date.now() - 86400000),
      });

      const res = await getSellerEntitlement('seller-pastdue', 'telegram_bot');
      expect(res.source).toBe('DEFAULT');
      expect(res.value).toBe(false);

      const hasBot = await hasFeature('seller-pastdue', 'telegram_bot');
      expect(hasBot).toBe(false);
    });

    it('D) status EXPIRED -> NÃO libera feature do plano', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-expired',
        planId: 'plan-pro',
        status: 'EXPIRED',
        currentPeriodEnd: new Date(Date.now() - 86400000),
      });

      const res = await getSellerEntitlement('seller-expired', 'telegram_bot');
      expect(res.source).toBe('DEFAULT');
      expect(res.value).toBe(false);

      const checkProd = await checkLimit('seller-expired', 'max_products', 1);
      expect(checkProd.source).toBe('DEFAULT');
    });

    it('E) status CANCELLED -> NÃO libera feature do plano', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-cancelled',
        planId: 'plan-pro',
        status: 'CANCELLED',
      });

      const res = await getSellerEntitlement('seller-cancelled', 'telegram_bot');
      expect(res.source).toBe('DEFAULT');
      expect(res.value).toBe(false);
    });

    it('F) status SUSPENDED -> NÃO libera feature do plano', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-suspended',
        planId: 'plan-pro',
        status: 'SUSPENDED',
      });

      const res = await getSellerEntitlement('seller-suspended', 'telegram_bot');
      expect(res.source).toBe('DEFAULT');
      expect(res.value).toBe(false);
    });

    it('G) Override + ACTIVE -> override funciona normalmente', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-active-ovr',
        planId: 'plan-pro',
        status: 'ACTIVE',
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        sellerId: 'seller-active-ovr',
        overrideValue: { value: 50 },
        expiresAt: null,
      });

      const res = await getSellerEntitlement('seller-active-ovr', 'max_products');
      expect(res.source).toBe('OVERRIDE');
      expect(res.value).toBe(50);
    });

    it('H) Override + EXPIRED -> override NÃO reativa a assinatura e cai para DEFAULT', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-expired-ovr',
        planId: 'plan-pro',
        status: 'EXPIRED',
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        sellerId: 'seller-expired-ovr',
        overrideValue: { value: 100 },
        expiresAt: null,
      });

      const res = await getSellerEntitlement('seller-expired-ovr', 'max_products');
      expect(res.source).toBe('DEFAULT');
      expect(res.source).not.toBe('OVERRIDE');
      expect(res.source).not.toBe('PLAN');
    });

    it('I) Override + PAST_DUE -> override NÃO reativa a assinatura', async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        sellerId: 'seller-pastdue-ovr',
        planId: 'plan-pro',
        status: 'PAST_DUE',
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue({
        sellerId: 'seller-pastdue-ovr',
        overrideValue: { value: 200 },
        expiresAt: null,
      });

      const res = await getSellerEntitlement('seller-pastdue-ovr', 'max_products');
      expect(res.source).toBe('DEFAULT');
    });

    it('J) ADMIN -> ADMIN_EXEMPT continua ilimitado independente de status de subscription', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({ id: 'admin-id', role: 'admin' });

      const res = await getSellerEntitlement('admin-id', 'telegram_bot');
      expect(res.source).toBe('ADMIN_EXEMPT');
      expect(res.isUnlimited).toBe(true);
    });

    it('K) SUPER_ADMIN -> ADMIN_EXEMPT continua ilimitado', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({ id: 'super-admin-id', role: 'super_admin' });

      const res = await getSellerEntitlement('super-admin-id', 'storage_quota_gb');
      expect(res.source).toBe('ADMIN_EXEMPT');
      expect(res.isUnlimited).toBe(true);
    });

    it('L) Multi-tenant -> status de subscription de Seller A não afeta Seller B', async () => {
      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
      (db.query.subscriptions.findFirst as any).mockImplementation(async ({ where }: any) => {
        return { sellerId: 'seller-A', planId: 'plan-pro', status: 'ACTIVE' };
      });

      const resA = await getSellerEntitlement('seller-A', 'telegram_bot');
      expect(resA.source).toBe('PLAN');

      (db.query.subscriptions.findFirst as any).mockImplementation(async ({ where }: any) => {
        return { sellerId: 'seller-B', planId: 'plan-pro', status: 'EXPIRED' };
      });

      const resB = await getSellerEntitlement('seller-B', 'telegram_bot');
      expect(resB.source).toBe('DEFAULT');
    });

    it('M) getSellerEntitlement e hasFeature NUNCA chamam ensureEntitlementTablesAndSeed em runtime', async () => {
      const ensureSpy = vi.spyOn(ensureModule, 'ensureEntitlementTablesAndSeed');
      ensureSpy.mockClear();

      (db.query.users.findFirst as any).mockResolvedValue({ id: 'seller-test', role: 'seller' });
      (db.query.features.findFirst as any).mockResolvedValue({ id: 'f-1', key: 'product_videos_enabled', type: 'BOOLEAN', isActive: true, defaultValue: { value: true } });
      (db.query.subscriptions.findFirst as any).mockResolvedValue({ status: 'ACTIVE' });

      await getSellerEntitlement('seller-test', 'product_videos_enabled');
      await hasFeature('seller-test', 'product_videos_enabled');

      expect(ensureSpy).not.toHaveBeenCalled();
    });
  });
});
