import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => {
  return {
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        features: {
          findFirst: vi.fn(),
        },
        sellerFeatureOverrides: {
          findFirst: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
        },
        videoLibrarySubscriptions: {
          findFirst: vi.fn(),
        },
        planFeatures: {
          findFirst: vi.fn(),
        },
        productVideos: {
          findMany: vi.fn(),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ total: 0 }])),
        })),
      })),
      execute: vi.fn(() => Promise.resolve()),
    },
  };
});

import { db } from '@/db';
import { getSellerEntitlement, hasFeature } from '@/lib/entitlements/entitlement-service';
import { ProductVideoService } from '@/lib/videos/product-video-service';
import { StorageUsageService } from '@/lib/storage/storage-usage-service';

describe('Owner & Super Admin Video Library Access Bypass Suite', () => {
  const ownerId = 'owner-id-123';
  const superAdminId = 'super-admin-id-456';
  const sellerIdNoPlan = 'seller-no-plan-789';
  const sellerStarterId = 'seller-starter-101';
  const sellerProId = 'seller-pro-102';
  const sellerBusinessId = 'seller-business-103';
  const sellerIlimitadoId = 'seller-ilimitado-104';

  beforeEach(() => {
    vi.clearAllMocks();
    (db.query.productVideos.findMany as any).mockResolvedValue([]);
  });

  it('1. OWNER user (role: "owner") receives ADMIN_EXEMPT and unlimited Video Library access', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: ownerId, role: 'owner' });

    const entitlement = await getSellerEntitlement(ownerId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('ADMIN_EXEMPT');
    expect(entitlement.isUnlimited).toBe(true);
    expect(entitlement.value).toBe(-1);

    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: ownerId, role: 'owner' });
    const isVideoEnabled = await hasFeature(ownerId, 'product_videos_enabled');
    expect(isVideoEnabled).toBe(true);
  });

  it('2. SUPER_ADMIN user (role: "super_admin") receives ADMIN_EXEMPT and unlimited Video Library access', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: superAdminId, role: 'super_admin' });

    const entitlement = await getSellerEntitlement(superAdminId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('ADMIN_EXEMPT');
    expect(entitlement.isUnlimited).toBe(true);
    expect(entitlement.value).toBe(-1);
  });

  it('3. Storage metrics for OWNER return hasVideoSubscription=true, isUnlimited=true, and planName="PROPRIETÁRIO / ILIMITADO"', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: ownerId, role: 'admin' });

    const usage = await ProductVideoService.getSellerVideoStorageUsage(ownerId, 'store-123');
    expect(usage.isUnlimited).toBe(true);
    expect(usage.hasVideoSubscription).toBe(true);
    expect(usage.planName).toBe('PROPRIETÁRIO / ILIMITADO');
  });

  it('4. Storage reservation for OWNER bypasses capacity limits without error', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: ownerId, role: 'admin' });

    const quotaInfo = await StorageUsageService.getVideoQuotaBytes(ownerId);
    expect(quotaInfo.isUnlimited).toBe(true);
    expect(quotaInfo.quotaBytes).toBeNull();
    expect(quotaInfo.source).toBe('ADMIN_EXEMPT');
  });

  it('5. CLIENTE SEM PLANO: entitlement returns INACTIVE with value=0, locking video onboarding', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: sellerIdNoPlan, role: 'seller' });
    (db.query.features.findFirst as any).mockResolvedValue({ id: 'feat-quota', key: 'video_storage_quota_gb', type: 'QUOTA', isActive: true });
    (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue(null);

    const entitlement = await getSellerEntitlement(sellerIdNoPlan, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('INACTIVE');
    expect(entitlement.value).toBe(0);
    expect(entitlement.isUnlimited).toBe(false);

    const usage = await ProductVideoService.getSellerVideoStorageUsage(sellerIdNoPlan, 'store-123');
    expect(usage.hasVideoSubscription).toBe(false);
    expect(usage.isUnlimited).toBe(false);
  });

  it('6. CLIENTE STARTER (20 GB): entitlement resolves to 20 GB quota', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: sellerStarterId, role: 'seller' });
    (db.query.features.findFirst as any).mockResolvedValue({ id: 'feat-quota', key: 'video_storage_quota_gb', type: 'QUOTA', isActive: true });
    (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      plan: { name: 'STARTER VÍDEO', storageQuotaGb: 20, price: '39.90' },
    });

    const entitlement = await getSellerEntitlement(sellerStarterId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('PLAN');
    expect(entitlement.value).toBe(20);

    const usage = await ProductVideoService.getSellerVideoStorageUsage(sellerStarterId, 'store-123');
    expect(usage.hasVideoSubscription).toBe(true);
    expect(usage.quotaGb).toBe(20);
    expect(usage.planName).toBe('STARTER VÍDEO');
  });

  it('7. CLIENTE PRO (100 GB): entitlement resolves to 100 GB quota', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: sellerProId, role: 'seller' });
    (db.query.features.findFirst as any).mockResolvedValue({ id: 'feat-quota', key: 'video_storage_quota_gb', type: 'QUOTA', isActive: true });
    (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      plan: { name: 'PRO VÍDEO', storageQuotaGb: 100, price: '99.99' },
    });

    const entitlement = await getSellerEntitlement(sellerProId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('PLAN');
    expect(entitlement.value).toBe(100);
  });

  it('8. CLIENTE BUSINESS (500 GB): entitlement resolves to 500 GB quota', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: sellerBusinessId, role: 'seller' });
    (db.query.features.findFirst as any).mockResolvedValue({ id: 'feat-quota', key: 'video_storage_quota_gb', type: 'QUOTA', isActive: true });
    (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      plan: { name: 'BUSINESS VÍDEO', storageQuotaGb: 500, price: '209.90' },
    });

    const entitlement = await getSellerEntitlement(sellerBusinessId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('PLAN');
    expect(entitlement.value).toBe(500);
  });

  it('9. CLIENTE ILIMITADO: entitlement resolves to unlimited commercial plan', async () => {
    (db.query.users.findFirst as any).mockResolvedValue({ id: sellerIlimitadoId, role: 'seller' });
    (db.query.features.findFirst as any).mockResolvedValue({ id: 'feat-quota', key: 'video_storage_quota_gb', type: 'QUOTA', isActive: true });
    (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
    (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      plan: { name: 'ILIMITADO VÍDEO', storageQuotaGb: -1, price: '599.90' },
    });

    const entitlement = await getSellerEntitlement(sellerIlimitadoId, 'video_storage_quota_gb');
    expect(entitlement.source).toBe('PLAN');
    expect(entitlement.isUnlimited).toBe(true);
  });
});
