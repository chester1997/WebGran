import { describe, it, expect, beforeEach, vi } from "vitest";
import { INITIAL_FEATURES } from "@/db/ensure-entitlements";
import { getSellerEntitlement, checkLimit, hasFeature } from "../entitlement-service";

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
        stores: {
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

vi.mock("@/db/ensure-entitlements", async () => {
  const actual = await vi.importActual("@/db/ensure-entitlements");
  return {
    ...actual,
    ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
  };
});

import { db } from "@/db";

describe("FASE 6D — Entitlement System Closing Integrity Audit Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptionPlans, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
  });

  describe("1. Catalog Integrity & Schema Consistency", () => {
    it("1.1. All 21 expected features exist in INITIAL_FEATURES", () => {
      const expectedKeys = [
        "max_products",
        "max_categories",
        "max_product_carousels",
        "max_stores",
        "max_orders_per_month",
        "financial_reports_enabled",
        "telegram_bot",
        "welcome_bot_message_enabled",
        "max_telegram_bot_chats",
        "clips_enabled",
        "max_clips",
        "max_video_size_mb",
        "max_banners",
        "coupons_enabled",
        "max_coupons",
        "floating_notifications_enabled",
        "custom_theme_enabled",
        "payment_gateways_enabled",
        "analytics_reports_enabled",
        "storage_quota_gb",
        "video_bandwidth_quota_gb",
        "product_videos_enabled",
        "max_product_videos",
        "video_storage_quota_gb",
      ];

      const catalogKeys = INITIAL_FEATURES.map((f) => f.key);
      expect(catalogKeys).toHaveLength(24);
      for (const key of expectedKeys) {
        expect(catalogKeys).toContain(key);
      }
    });

    it("1.2. No duplicate feature keys exist in INITIAL_FEATURES", () => {
      const catalogKeys = INITIAL_FEATURES.map((f) => f.key);
      const uniqueKeys = new Set(catalogKeys);
      expect(uniqueKeys.size).toBe(catalogKeys.length);
    });

    it("1.3. All features have valid types (BOOLEAN, LIMIT, QUOTA)", () => {
      const validTypes = ["BOOLEAN", "LIMIT", "QUOTA"];
      for (const feat of INITIAL_FEATURES) {
        expect(validTypes).toContain(feat.type);
      }
    });

    it("1.4. All features belong to valid catalog categories", () => {
      const validCategories = [
        "catalog",
        "management",
        "integrations",
        "media",
        "marketing",
        "customization",
        "payments",
        "analytics",
      ];
      for (const feat of INITIAL_FEATURES) {
        expect(validCategories).toContain(feat.category);
      }
    });

    it("1.5. BOOLEAN features have boolean default values", () => {
      const booleans = INITIAL_FEATURES.filter((f) => f.type === "BOOLEAN");
      for (const feat of booleans) {
        expect(typeof feat.defaultValue.value).toBe("boolean");
        expect(typeof feat.planValue.value).toBe("boolean");
      }
    });

    it("1.6. LIMIT features have numeric default values", () => {
      const limits = INITIAL_FEATURES.filter((f) => f.type === "LIMIT");
      for (const feat of limits) {
        expect(typeof feat.defaultValue.value).toBe("number");
        expect(typeof feat.planValue.value).toBe("number");
      }
    });

    it("1.7. QUOTA features have numeric default values", () => {
      const quotas = INITIAL_FEATURES.filter((f) => f.type === "QUOTA");
      for (const feat of quotas) {
        expect(typeof feat.defaultValue.value).toBe("number");
        expect(typeof feat.planValue.value).toBe("number");
      }
    });
  });

  describe("2. Precedence, Subscriptions & Admin Exemption", () => {
    it("2.1. ADMIN role receives ADMIN_EXEMPT and unlimited access across all features", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "admin-1", role: "ADMIN" } as any);

      for (const feat of INITIAL_FEATURES) {
        const res = await getSellerEntitlement("admin-1", feat.key);
        expect(res.source).toBe("ADMIN_EXEMPT");
        expect(res.isUnlimited).toBe(true);
      }
    });

    it("2.2. SUPER_ADMIN role receives ADMIN_EXEMPT and unlimited access across all features", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "sadmin-1", role: "SUPER_ADMIN" } as any);

      for (const feat of INITIAL_FEATURES) {
        const res = await getSellerEntitlement("sadmin-1", feat.key);
        expect(res.source).toBe("ADMIN_EXEMPT");
        expect(res.isUnlimited).toBe(true);
      }
    });

    it("2.3. Active override takes precedence over plan feature value", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-1", role: "SELLER" } as any);
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-products",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: 10 },
        isActive: true,
      } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-1", sellerId: "seller-1", planId: "plan-pro", status: "ACTIVE"
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-1", planId: "plan-pro", featureId: "feat-products", value: { value: 100 }
      } as any);
      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-1",
        sellerId: "seller-1",
        featureId: "feat-products",
        overrideValue: { value: 500 },
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const res = await getSellerEntitlement("seller-1", "max_products");
      expect(res.source).toBe("OVERRIDE");
      expect(res.value).toBe(500);
    });

    it("2.4. Expired override falls back to plan feature value", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-2", role: "SELLER" } as any);
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-products",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: 10 },
        isActive: true,
      } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-2", sellerId: "seller-2", planId: "plan-pro", status: "ACTIVE"
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-2", planId: "plan-pro", featureId: "feat-products", value: { value: 100 }
      } as any);
      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-2",
        sellerId: "seller-2",
        featureId: "feat-products",
        overrideValue: { value: 500 },
        expiresAt: new Date(Date.now() - 3600000), // Expired 1h ago
      } as any);

      const res = await getSellerEntitlement("seller-2", "max_products");
      expect(res.source).toBe("PLAN");
      expect(res.value).toBe(100);
    });

    it("2.5. Inactive subscription statuses (PAST_DUE, EXPIRED, CANCELLED, SUSPENDED) fall back to DEFAULT", async () => {
      const inactiveStatuses = ["PAST_DUE", "EXPIRED", "CANCELLED", "SUSPENDED"];

      for (const status of inactiveStatuses) {
        vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-inact", role: "SELLER" } as any);
        vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
          id: "feat-products",
          key: "max_products",
          type: "LIMIT",
          defaultValue: { value: 10 },
          isActive: true,
        } as any);
        vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
          id: "sub-inact", sellerId: "seller-inact", planId: "plan-pro", status
        } as any);

        const res = await getSellerEntitlement("seller-inact", "max_products");
        expect(res.source).toBe("DEFAULT");
        expect(res.value).toBe(10);
      }
    });

    it("2.6. Dynamically expired TRIAL status triggers fallback to DEFAULT", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-trial-exp", role: "SELLER" } as any);
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-products",
        key: "max_products",
        type: "LIMIT",
        defaultValue: { value: 10 },
        isActive: true,
      } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-trial",
        sellerId: "seller-trial-exp",
        planId: "plan-pro",
        status: "TRIAL",
        currentPeriodEnd: new Date(Date.now() - 3600000), // trial ended 1h ago
      } as any);

      const res = await getSellerEntitlement("seller-trial-exp", "max_products");
      expect(res.source).toBe("DEFAULT");
    });
  });

  describe("3. Multi-Tenant Security & Isolation", () => {
    it("3.1. Seller A's limit/usage checks do not leak or affect Seller B", async () => {
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-stores",
        key: "max_stores",
        type: "LIMIT",
        defaultValue: { value: 1 },
        isActive: true,
      } as any);

      // Seller A (Plan starter: 1 store)
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-a", role: "SELLER" } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-a", sellerId: "seller-a", planId: "plan-starter", status: "ACTIVE"
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-a", planId: "plan-starter", featureId: "feat-stores", value: { value: 1 }
      } as any);

      const checkA = await checkLimit("seller-a", "max_stores", 1);
      expect(checkA.allowed).toBe(false);

      // Seller B (Plan enterprise: unlimited stores)
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-b", role: "SELLER" } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-b", sellerId: "seller-b", planId: "plan-enterprise", status: "ACTIVE"
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-b", planId: "plan-enterprise", featureId: "feat-stores", value: { value: -1 }
      } as any);

      const checkB = await checkLimit("seller-b", "max_stores", 1);
      expect(checkB.allowed).toBe(true);
      expect(checkB.isUnlimited).toBe(true);
    });
  });

  describe("4. Status of Inert/Future Feature video_bandwidth_quota_gb", () => {
    it("4.1. video_bandwidth_quota_gb exists, type is QUOTA, category is media, defaultValue is 1000", () => {
      const feat = INITIAL_FEATURES.find((f) => f.key === "video_bandwidth_quota_gb");
      expect(feat).toBeDefined();
      expect(feat?.type).toBe("QUOTA");
      expect(feat?.category).toBe("media");
      expect(feat?.defaultValue.value).toBe(1000);
      expect(feat?.planValue.value).toBe(1000);
    });
  });
});
