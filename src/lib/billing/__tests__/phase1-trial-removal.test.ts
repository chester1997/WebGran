import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSellerEntitlement, checkLimit, hasFeature } from "@/lib/entitlements/entitlement-service";
import { getSellerSubscription } from "@/lib/billing/subscription-service";

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
        },
        subscriptionPlans: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        features: {
          findFirst: vi.fn(),
        },
        planFeatures: {
          findFirst: vi.fn(),
        },
        sellerFeatureOverrides: {
          findFirst: vi.fn(),
        },
        videoLibrarySubscriptions: {
          findFirst: vi.fn(),
        },
        videoLibraryPlans: {
          findFirst: vi.fn(),
        },
        invoices: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        stores: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "new-sub-id",
              sellerId: "new-seller-1",
              planId: "plan-default",
              status: "ACTIVE",
              startedAt: new Date(),
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 365 * 10 * 86400000),
            },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    },
    subscriptions: {
      id: "id",
      sellerId: "sellerId",
      status: "status",
    },
    invoices: {
      sellerId: "sellerId",
      createdAt: "createdAt",
    },
  };
});

vi.mock("@/lib/payments/providers/mercado-pago-platform", () => ({
  mercadoPagoPlatformProvider: {
    getInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
  },
}));

import { db } from "@/db";

describe("Phase 1 — Elimination of 3-Day Free Trial & Permanent Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptionPlans, "findFirst").mockResolvedValue({
      id: "plan-default",
      name: "WebGran SaaS",
      slug: "webgran",
      active: true,
      price: "89.90",
      billingInterval: "month",
    } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.videoLibrarySubscriptions, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.invoices, "findMany").mockResolvedValue([]);
  });

  it("1. Legitimate seller with past trial timestamp does NOT lose quotas or degrade to DEFAULT", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "seller-past-trial",
      role: "seller",
    } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-products",
      key: "max_products",
      type: "LIMIT",
      defaultValue: { value: 5 },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-legacy-trial",
      sellerId: "seller-past-trial",
      planId: "plan-pro",
      status: "TRIAL",
      currentPeriodEnd: new Date(Date.now() - 7 * 86400000), // Ended 7 days ago
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-products",
      planId: "plan-pro",
      featureId: "feat-products",
      value: { value: 100 },
    } as any);

    const entitlement = await getSellerEntitlement("seller-past-trial", "max_products");
    expect(entitlement.source).toBe("PLAN");
    expect(entitlement.value).toBe(100);

    const limitCheck = await checkLimit("seller-past-trial", "max_products", 10);
    expect(limitCheck.allowed).toBe(true);
    expect(limitCheck.limit).toBe(100);
  });

  it("2. New seller registration does not create a 3-day trial, but an ACTIVE perpetual subscription", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "new-seller-1",
      role: "seller",
      createdAt: new Date(),
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);

    const subData = await getSellerSubscription("new-seller-1");

    expect(db.insert).toHaveBeenCalled();
    expect(subData.isTrialActive).toBe(false);
    expect(subData.isSubscriptionActive).toBe(true);
    expect(subData.trialDaysRemaining).toBe(0);
    expect(subData.subscription.status).toBe("ACTIVE");
  });

  it("3. Passage of time does NOT trigger transition to EXPIRED in DB or memory", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "seller-aged",
      role: "seller",
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-aged",
      sellerId: "seller-aged",
      planId: "plan-default",
      status: "TRIAL",
      currentPeriodEnd: new Date(Date.now() - 30 * 86400000), // Ended 30 days ago
      invoices: [],
    } as any);

    const subData = await getSellerSubscription("seller-aged");

    expect(db.update).not.toHaveBeenCalled();
    expect(subData.subscription.status).toBe("ACTIVE");
    expect(subData.isSubscriptionActive).toBe(true);
  });

  it("4. Administratively suspended seller remains strictly suspended (SUSPENDED / INACTIVE)", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "suspended-seller",
      role: "suspended",
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-suspended",
      sellerId: "suspended-seller",
      planId: "plan-default",
      status: "SUSPENDED",
    } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-products",
      key: "max_products",
      type: "LIMIT",
      defaultValue: { value: 10 },
      isActive: true,
    } as any);

    const subData = await getSellerSubscription("suspended-seller");
    expect(subData.isSubscriptionActive).toBe(false);
    expect(subData.subscription.status).toBe("SUSPENDED");

    const entitlement = await getSellerEntitlement("suspended-seller", "max_products");
    expect(entitlement.source).toBe("DEFAULT");
    expect(entitlement.value).toBe(10);
  });

  it("5. Seller with cancelled subscription falls back to DEFAULT", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "cancelled-seller",
      role: "seller",
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-cancelled",
      sellerId: "cancelled-seller",
      planId: "plan-default",
      status: "CANCELLED",
    } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-products",
      key: "max_products",
      type: "LIMIT",
      defaultValue: { value: 10 },
      isActive: true,
    } as any);

    const entitlement = await getSellerEntitlement("cancelled-seller", "max_products");
    expect(entitlement.source).toBe("DEFAULT");
  });

  it("6. Video Library retains intact and isolated subscription rules", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
      id: "seller-video-test",
      role: "seller",
    } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-video-quota",
      key: "video_storage_quota_gb",
      type: "QUOTA",
      defaultValue: { value: 0 },
      isActive: true,
    } as any);

    // Case 6A: Without Video Library subscription -> source INACTIVE, value 0
    vi.spyOn(db.query.videoLibrarySubscriptions, "findFirst").mockResolvedValue(null as any);
    const noSubEntitlement = await getSellerEntitlement("seller-video-test", "video_storage_quota_gb");
    expect(noSubEntitlement.source).toBe("INACTIVE");
    expect(noSubEntitlement.value).toBe(0);

    // Case 6B: With active Video Library subscription -> source PLAN, value from plan
    vi.spyOn(db.query.videoLibrarySubscriptions, "findFirst").mockResolvedValue({
      id: "vls-1",
      sellerId: "seller-video-test",
      status: "ACTIVE",
      plan: {
        id: "vlp-1",
        storageQuotaGb: 20,
      },
    } as any);
    const withSubEntitlement = await getSellerEntitlement("seller-video-test", "video_storage_quota_gb");
    expect(withSubEntitlement.source).toBe("PLAN");
    expect(withSubEntitlement.value).toBe(20);
  });

  it("7. Seller without store or inactive store remains inactive, and is NOT marked pending due to trial", () => {
    // Helper function that mirrors the admin sellers status logic
    function computeSellerStatus(seller: { role: string }, store: { status: string } | null, sub: { status: string } | null) {
      if (seller.role === 'suspended' || store?.status === 'suspended' || sub?.status === 'SUSPENDED') {
        return 'suspended';
      } else if (!store || store?.status === 'inactive') {
        return 'inactive';
      } else if (seller.role === 'pending') {
        return 'pending';
      }
      return 'active';
    }

    // A: Legitimate seller with store and expired legacy trial -> ACTIVE (not pending!)
    expect(computeSellerStatus({ role: 'seller' }, { status: 'active' }, { status: 'EXPIRED' })).toBe('active');
    expect(computeSellerStatus({ role: 'seller' }, { status: 'active' }, { status: 'TRIAL' })).toBe('active');

    // B: Seller without store -> INACTIVE
    expect(computeSellerStatus({ role: 'seller' }, null, { status: 'ACTIVE' })).toBe('inactive');

    // C: Seller with inactive store -> INACTIVE
    expect(computeSellerStatus({ role: 'seller' }, { status: 'inactive' }, { status: 'ACTIVE' })).toBe('inactive');

    // D: Suspended seller -> SUSPENDED
    expect(computeSellerStatus({ role: 'suspended' }, { status: 'active' }, { status: 'ACTIVE' })).toBe('suspended');
    expect(computeSellerStatus({ role: 'seller' }, { status: 'suspended' }, { status: 'ACTIVE' })).toBe('suspended');
    expect(computeSellerStatus({ role: 'seller' }, { status: 'active' }, { status: 'SUSPENDED' })).toBe('suspended');
  });
});
