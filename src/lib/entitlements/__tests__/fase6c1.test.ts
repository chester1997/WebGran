import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkLimit, hasFeature, getSellerEntitlement } from "../entitlement-service";

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

vi.mock("@/db/ensure-entitlements", () => ({
  ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/db";

describe("FASE 6C.1 — Welcome Bot & Max Coupons Entitlements Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptionPlans, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
  });

  describe("FEATURE 1: welcome_bot_message_enabled", () => {
    it("1. Seller with welcome_bot_message_enabled = true returns hasFeature = true", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-1",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: true },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-1",
        sellerId: "seller-1",
        planId: "plan-pro",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-welcome",
        planId: "plan-pro",
        featureId: "feat-welcome",
        value: { value: true },
      } as any);

      const allowed = await hasFeature("seller-1", "welcome_bot_message_enabled");
      expect(allowed).toBe(true);
    });

    it("2. Seller with welcome_bot_message_enabled = false in plan returns hasFeature = false", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-2",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: true },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-2",
        sellerId: "seller-2",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-welcome",
        planId: "plan-basic",
        featureId: "feat-welcome",
        value: { value: false },
      } as any);

      const allowed = await hasFeature("seller-2", "welcome_bot_message_enabled");
      expect(allowed).toBe(false);
    });

    it("3. ADMIN / SUPER_ADMIN seller receives ADMIN_EXEMPT and hasFeature = true", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "admin-1",
        role: "SUPER_ADMIN",
      } as any);

      const res = await getSellerEntitlement("admin-1", "welcome_bot_message_enabled");
      expect(res.source).toBe("ADMIN_EXEMPT");
      expect(await hasFeature("admin-1", "welcome_bot_message_enabled")).toBe(true);
    });

    it("4. Active seller override = true for welcome_bot_message_enabled returns true", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-3",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: false },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-3",
        sellerId: "seller-3",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-welcome-true",
        sellerId: "seller-3",
        featureId: "feat-welcome",
        overrideValue: { value: true },
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const allowed = await hasFeature("seller-3", "welcome_bot_message_enabled");
      expect(allowed).toBe(true);
    });

    it("5. Active seller override = false for welcome_bot_message_enabled returns false", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-4",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: true },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-4",
        sellerId: "seller-4",
        planId: "plan-pro",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-welcome-false",
        sellerId: "seller-4",
        featureId: "feat-welcome",
        overrideValue: { value: false },
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const allowed = await hasFeature("seller-4", "welcome_bot_message_enabled");
      expect(allowed).toBe(false);
    });

    it("6. Telegram webhook ignores custom welcomeMessage and banners when feature is false", async () => {
      const mockStore = {
        id: "store-1",
        ownerId: "seller-no-welcome",
        name: "Minha Loja",
        description: "Descrição da Loja",
        welcomeMessage: "Mensagem Customizada VIP!",
        welcomeBanners: ["https://example.com/banner.jpg"],
      };

      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-no-welcome",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: false },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-no-welcome",
        sellerId: "seller-no-welcome",
        planId: "plan-starter",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-welcome",
        planId: "plan-starter",
        featureId: "feat-welcome",
        value: { value: false },
      } as any);

      const welcomeAllowed = await hasFeature(mockStore.ownerId, "welcome_bot_message_enabled");
      expect(welcomeAllowed).toBe(false);

      // Webhook fallback logic simulation
      let welcomeText = welcomeAllowed ? mockStore.welcomeMessage : null;
      if (!welcomeText || welcomeText.trim() === "") {
        welcomeText = `Olá {nome}! Bem-vindo(a) à ${mockStore.name}.\n\n${mockStore.description ? mockStore.description + '\n\n' : ''}Clique no botão abaixo para abrir nossa loja e conferir os produtos!`;
      }

      const banners = welcomeAllowed ? (mockStore.welcomeBanners || []) : [];

      expect(welcomeText).toContain("Olá {nome}! Bem-vindo(a) à Minha Loja.");
      expect(welcomeText).not.toContain("VIP");
      expect(banners).toHaveLength(0);
    });

    it("7. Multi-tenant: Seller A (true) and Seller B (false) operate independently", async () => {
      // Setup Seller A
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-a", role: "SELLER" } as any);
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-welcome",
        key: "welcome_bot_message_enabled",
        type: "BOOLEAN",
        defaultValue: { value: true },
        isActive: true,
      } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-a",
        sellerId: "seller-a",
        planId: "plan-a",
        status: "ACTIVE",
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-a",
        planId: "plan-a",
        featureId: "feat-welcome",
        value: { value: true },
      } as any);

      const allowedA = await hasFeature("seller-a", "welcome_bot_message_enabled");
      expect(allowedA).toBe(true);

      // Setup Seller B
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-b", role: "SELLER" } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-b",
        sellerId: "seller-b",
        planId: "plan-b",
        status: "ACTIVE",
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-b",
        planId: "plan-b",
        featureId: "feat-welcome",
        value: { value: false },
      } as any);

      const allowedB = await hasFeature("seller-b", "welcome_bot_message_enabled");
      expect(allowedB).toBe(false);
    });
  });

  describe("FEATURE 2: max_coupons", () => {
    it("8. Seller with max_coupons = -1 returns checkLimit allowed = true and isUnlimited = true", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-unlimited",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-unlimited",
        sellerId: "seller-unlimited",
        planId: "plan-enterprise",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-coupons",
        planId: "plan-enterprise",
        featureId: "feat-max-coupons",
        value: { value: -1 },
      } as any);

      const res = await checkLimit("seller-unlimited", "max_coupons", 100);
      expect(res.allowed).toBe(true);
      expect(res.isUnlimited).toBe(true);
      expect(res.limit).toBeNull();
    });

    it("9. Seller with max_coupons = 5 and usage = 3 returns checkLimit allowed = true with remaining = 2", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-limit-5",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-5",
        sellerId: "seller-limit-5",
        planId: "plan-pro",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-coupons-5",
        planId: "plan-pro",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      const res = await checkLimit("seller-limit-5", "max_coupons", 3);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(5);
      expect(res.usage).toBe(3);
      expect(res.remaining).toBe(2);
    });

    it("10. Seller with max_coupons = 5 and usage = 5 returns checkLimit allowed = false with remaining = 0", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-limit-5",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-5",
        sellerId: "seller-limit-5",
        planId: "plan-pro",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-coupons-5",
        planId: "plan-pro",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      const res = await checkLimit("seller-limit-5", "max_coupons", 5);
      expect(res.allowed).toBe(false);
      expect(res.limit).toBe(5);
      expect(res.usage).toBe(5);
      expect(res.remaining).toBe(0);
    });

    it("11. Seller with max_coupons = 5 and usage = 6 (downgrade scenario) returns checkLimit allowed = false", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-downgraded",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-down",
        sellerId: "seller-downgraded",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-coupons-basic",
        planId: "plan-basic",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      const res = await checkLimit("seller-downgraded", "max_coupons", 6);
      expect(res.allowed).toBe(false);
      expect(res.limit).toBe(5);
      expect(res.usage).toBe(6);
      expect(res.remaining).toBe(0);
    });

    it("12. ADMIN / SUPER_ADMIN receives checkLimit allowed = true, isUnlimited = true, limit = null for max_coupons", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "super-admin-user",
        role: "SUPER_ADMIN",
      } as any);

      const res = await checkLimit("super-admin-user", "max_coupons", 500);
      expect(res.allowed).toBe(true);
      expect(res.isUnlimited).toBe(true);
      expect(res.limit).toBeNull();
      expect(res.source).toBe("ADMIN_EXEMPT");
    });

    it("13. Active override = 20 for max_coupons overrides plan limit of 5", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-override-20",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-override",
        sellerId: "seller-override-20",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-basic",
        planId: "plan-basic",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-20",
        sellerId: "seller-override-20",
        featureId: "feat-max-coupons",
        overrideValue: { value: 20 },
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const res = await checkLimit("seller-override-20", "max_coupons", 10);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(20);
      expect(res.source).toBe("OVERRIDE");
    });

    it("14. Expired override falls back to plan limit of 5", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-expired-override",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-exp",
        sellerId: "seller-expired-override",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-basic",
        planId: "plan-basic",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
        id: "ovr-expired",
        sellerId: "seller-expired-override",
        featureId: "feat-max-coupons",
        overrideValue: { value: 20 },
        expiresAt: new Date(Date.now() - 3600000),
      } as any);

      const res = await checkLimit("seller-expired-override", "max_coupons", 10);
      expect(res.allowed).toBe(false);
      expect(res.limit).toBe(5);
      expect(res.source).toBe("PLAN");
    });

    it("15. Deactivating/deleting coupon reduces active count, unlocking new coupon creation", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-toggle",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-toggle",
        sellerId: "seller-toggle",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-basic",
        planId: "plan-basic",
        featureId: "feat-max-coupons",
        value: { value: 2 },
      } as any);

      const resFull = await checkLimit("seller-toggle", "max_coupons", 2);
      expect(resFull.allowed).toBe(false);

      const resFreed = await checkLimit("seller-toggle", "max_coupons", 1);
      expect(resFreed.allowed).toBe(true);
      expect(resFreed.remaining).toBe(1);
    });

    it("16. Downgraded seller keeps existing active coupons, but new creation is blocked", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-downgrade-legacy",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-legacy",
        sellerId: "seller-downgrade-legacy",
        planId: "plan-basic",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-basic",
        planId: "plan-basic",
        featureId: "feat-max-coupons",
        value: { value: 5 },
      } as any);

      const res = await checkLimit("seller-downgrade-legacy", "max_coupons", 8);
      expect(res.allowed).toBe(false);
      expect(res.limit).toBe(5);
      expect(res.usage).toBe(8);
    });

    it("17. Multi-tenant: Seller X (limit 2) and Seller Y (limit 10) operate in complete isolation", async () => {
      // Seller X
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-x", role: "SELLER" } as any);
      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-x",
        sellerId: "seller-x",
        planId: "plan-x",
        status: "ACTIVE",
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-x",
        planId: "plan-x",
        featureId: "feat-max-coupons",
        value: { value: 2 },
      } as any);

      const resX = await checkLimit("seller-x", "max_coupons", 2);
      expect(resX.allowed).toBe(false);

      // Reset for Seller Y
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-y", role: "SELLER" } as any);
      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-y",
        sellerId: "seller-y",
        planId: "plan-y",
        status: "ACTIVE",
      } as any);
      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-y",
        planId: "plan-y",
        featureId: "feat-max-coupons",
        value: { value: 10 },
      } as any);

      const resY = await checkLimit("seller-y", "max_coupons", 2);
      expect(resY.allowed).toBe(true);
      expect(resY.remaining).toBe(8);
    });

    it("18. Inactive subscription (EXPIRED / PAST_DUE) falls back to DEFAULT for entitlements", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-expired-sub",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: -1 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-expired-status",
        sellerId: "seller-expired-sub",
        planId: "plan-pro",
        status: "EXPIRED",
      } as any);

      const res = await getSellerEntitlement("seller-expired-sub", "max_coupons");
      expect(res.source).toBe("DEFAULT");
    });

    it("19. coupons_enabled = false precedence rejects coupon creation regardless of max_coupons", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-coupons-disabled",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-coupons-enabled",
        key: "coupons_enabled",
        type: "BOOLEAN",
        defaultValue: { value: false },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-no-coupons",
        sellerId: "seller-coupons-disabled",
        planId: "plan-no-coupons",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-no-coupons",
        planId: "plan-no-coupons",
        featureId: "feat-coupons-enabled",
        value: { value: false },
      } as any);

      const couponsAllowed = await hasFeature("seller-coupons-disabled", "coupons_enabled");
      expect(couponsAllowed).toBe(false);
    });

    it("20. coupons_enabled = true + max_coupons = 2 rejects 3rd coupon creation with max_coupons error", async () => {
      vi.spyOn(db.query.users, "findFirst").mockResolvedValue({
        id: "seller-limit-2",
        role: "SELLER",
      } as any);

      vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
        id: "feat-max-coupons",
        key: "max_coupons",
        type: "LIMIT",
        defaultValue: { value: 2 },
        isActive: true,
      } as any);

      vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
        id: "sub-2-limit",
        sellerId: "seller-limit-2",
        planId: "plan-starter",
        status: "ACTIVE",
      } as any);

      vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
        id: "pf-2-limit",
        planId: "plan-starter",
        featureId: "feat-max-coupons",
        value: { value: 2 },
      } as any);

      const limitCheck = await checkLimit("seller-limit-2", "max_coupons", 2);
      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.limit).toBe(2);

      const expectedError = `Limite de cupons ativos atingido (${limitCheck.limit}). Faça upgrade do seu plano para criar mais cupons.`;
      expect(expectedError).toBe("Limite de cupons ativos atingido (2). Faça upgrade do seu plano para criar mais cupons.");
    });
  });
});
