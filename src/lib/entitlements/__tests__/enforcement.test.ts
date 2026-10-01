import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkLimit, hasFeature, getSellerEntitlement } from "../entitlement-service";

// Mock DB and seed function for pure unit test assertion on resolution logic
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
      },
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
    },
  };
});

vi.mock("@/db/ensure-entitlements", () => ({
  ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/db";

describe("Entitlement Enforcement Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Precedence Logic", () => {
    it("1. Super Admin / Admin receives ADMIN_EXEMPT and unlimited access", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "admin-1",
        role: "SUPER_ADMIN",
      } as any);

      const res = await getSellerEntitlement("admin-1", "max_products");
      expect(res.source).toBe("ADMIN_EXEMPT");
      expect(res.isUnlimited).toBe(true);
      expect(res.value).toBe(-1);

      const limitCheck = await checkLimit("admin-1", "max_products", 9999);
      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.isUnlimited).toBe(true);
    });

    it("2. Active Override overrides plan entitlement", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-1",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-prod",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: 10 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-1",
        sellerId: "seller-1",
        featureId: "feat-max-prod",
        overrideValue: { value: 100 },
        expiresAt: new Date(Date.now() + 86400000), // active
      } as any);

      const res = await getSellerEntitlement("seller-1", "max_products");
      expect(res.source).toBe("OVERRIDE");
      expect(res.value).toBe(100);

      const checkAllowed = await checkLimit("seller-1", "max_products", 50);
      expect(checkAllowed.allowed).toBe(true);
      expect(checkAllowed.limit).toBe(100);

      const checkExceeded = await checkLimit("seller-1", "max_products", 100);
      expect(checkExceeded.allowed).toBe(false);
    });

    it("3. Expired Override falls back to Plan feature value", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-2",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-prod",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: 10 },
        isActive: true,
      } as any);

      // Expired override
      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-2",
        sellerId: "seller-2",
        featureId: "feat-max-prod",
        overrideValue: { value: 500 },
        expiresAt: new Date(Date.now() - 86400000), // expired 1 day ago
      } as any);

      // Active subscription
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-2",
        sellerId: "seller-2",
        planId: "plan-webgran",
        status: "active",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-2",
        planId: "plan-webgran",
        featureId: "feat-max-prod",
        value: { value: 25 },
        isEnabled: true,
      } as any);

      const res = await getSellerEntitlement("seller-2", "max_products");
      expect(res.source).toBe("PLAN");
      expect(res.value).toBe(25);
    });

    it("4. Limit check handles -1 (unlimited)", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-3",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-prod",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);

      const limitCheck = await checkLimit("seller-3", "max_products", 5000);
      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.isUnlimited).toBe(true);
      expect(limitCheck.limit).toBeNull();
    });

    it("5. Boolean feature check (hasFeature)", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-4",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-coupons",
        key: "coupons_enabled",
        type: "BOOLEAN",
        defaultValue: { value: false },
        isActive: true,
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);

      const allowed = await hasFeature("seller-4", "coupons_enabled");
      expect(allowed).toBe(false);
    });
  });
});
