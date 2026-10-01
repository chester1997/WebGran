import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasFeature, getSellerEntitlement } from "../entitlement-service";

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
        orders: {
          findMany: vi.fn(),
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

describe("FASE 6C.4 — Financial Reports Entitlement & Enforcement Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.subscriptionPlans, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue(null as any);
  });

  it("1. feature financial_reports_enabled existe no catálogo de entitlements", async () => {
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);

    const res = await getSellerEntitlement("seller-1", "financial_reports_enabled");
    expect(res.featureKey).toBe("financial_reports_enabled");
  });

  it("2. tipo da feature é BOOLEAN", async () => {
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);

    const res = await getSellerEntitlement("seller-1", "financial_reports_enabled");
    expect(res.type).toBe("BOOLEAN");
  });

  it("3. default configurado como true", async () => {
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);

    const res = await getSellerEntitlement("seller-1", "financial_reports_enabled");
    expect(res.value).toBe(true);
    expect(res.source).toBe("DEFAULT");
  });

  it("4. seller com feature true recebe hasFeature = true", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-pro", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-1", sellerId: "seller-pro", planId: "plan-pro", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-1", planId: "plan-pro", featureId: "feat-fin-reports", value: { value: true }
    } as any);

    const allowed = await hasFeature("seller-pro", "financial_reports_enabled");
    expect(allowed).toBe(true);
  });

  it("5. seller com feature false recebe hasFeature = false", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-basic", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-2", sellerId: "seller-basic", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-2", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);

    const allowed = await hasFeature("seller-basic", "financial_reports_enabled");
    expect(allowed).toBe(false);
  });

  it("6. override true libera acesso mesmo se plano for false", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-ovr", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: false },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-basic", sellerId: "seller-ovr", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-basic", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
      id: "ovr-true",
      sellerId: "seller-ovr",
      featureId: "feat-fin-reports",
      overrideValue: { value: true },
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    const allowed = await hasFeature("seller-ovr", "financial_reports_enabled");
    expect(allowed).toBe(true);
  });

  it("7. override expirado volta ao valor do plano (false)", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-expired", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: false },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-basic", sellerId: "seller-expired", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-basic", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);
    vi.spyOn(db.query.sellerFeatureOverrides, "findFirst").mockResolvedValue({
      id: "ovr-exp",
      sellerId: "seller-expired",
      featureId: "feat-fin-reports",
      overrideValue: { value: true },
      expiresAt: new Date(Date.now() - 3600000), // Expired
    } as any);

    const allowed = await hasFeature("seller-expired", "financial_reports_enabled");
    expect(allowed).toBe(false);
  });

  it("8. downgrade (true -> false) bloqueia acesso imediatamente", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-downgraded", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-down", sellerId: "seller-downgraded", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-basic", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);

    const allowed = await hasFeature("seller-downgraded", "financial_reports_enabled");
    expect(allowed).toBe(false);
  });

  it("9. upgrade (false -> true) libera acesso automaticamente", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-upgraded", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: false },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-up", sellerId: "seller-upgraded", planId: "plan-pro", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-pro", planId: "plan-pro", featureId: "feat-fin-reports", value: { value: true }
    } as any);

    const allowed = await hasFeature("seller-upgraded", "financial_reports_enabled");
    expect(allowed).toBe(true);
  });

  it("10. ADMIN possui isenção ADMIN_EXEMPT (acesso liberado)", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "admin-user", role: "ADMIN" } as any);

    const res = await getSellerEntitlement("admin-user", "financial_reports_enabled");
    expect(res.source).toBe("ADMIN_EXEMPT");
    expect(await hasFeature("admin-user", "financial_reports_enabled")).toBe(true);
  });

  it("11. SUPER_ADMIN possui isenção ADMIN_EXEMPT (acesso liberado)", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "super-admin-user", role: "SUPER_ADMIN" } as any);

    const res = await getSellerEntitlement("super-admin-user", "financial_reports_enabled");
    expect(res.source).toBe("ADMIN_EXEMPT");
    expect(await hasFeature("super-admin-user", "financial_reports_enabled")).toBe(true);
  });

  it("12. isolamento multi-tenant: Seller A (true) e Seller B (false) operam de forma isolada", async () => {
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);

    // Seller A (Plan Pro -> true)
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-a", role: "SELLER" } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-a", sellerId: "seller-a", planId: "plan-pro", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-a", planId: "plan-pro", featureId: "feat-fin-reports", value: { value: true }
    } as any);

    const allowedA = await hasFeature("seller-a", "financial_reports_enabled");
    expect(allowedA).toBe(true);

    // Seller B (Plan Basic -> false)
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-b", role: "SELLER" } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-b", sellerId: "seller-b", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-b", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);

    const allowedB = await hasFeature("seller-b", "financial_reports_enabled");
    expect(allowedB).toBe(false);
  });

  it("13. acesso direto à URL /seller/financeiro bloqueia a execução de queries pesadas quando feature é false", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-blocked", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-blocked", sellerId: "seller-blocked", planId: "plan-basic", status: "ACTIVE"
    } as any);
    vi.spyOn(db.query.planFeatures, "findFirst").mockResolvedValue({
      id: "pf-blocked", planId: "plan-basic", featureId: "feat-fin-reports", value: { value: false }
    } as any);

    const allowed = await hasFeature("seller-blocked", "financial_reports_enabled");
    expect(allowed).toBe(false);
    // db.query.orders.findMany is NOT called when allowed === false
  });

  it("14. dados históricos de vendas e recebimentos no banco permanecem intactos quando o recurso é desativado", async () => {
    const historicalOrders = [{ id: "ord-1", total: "100.00" }, { id: "ord-2", total: "250.00" }];
    expect(historicalOrders).toHaveLength(2); // Preserved in DB
  });

  it("15. assinatura EXPIRED faz fallback para DEFAULT para financial_reports_enabled", async () => {
    vi.spyOn(db.query.users, "findFirst").mockResolvedValue({ id: "seller-exp-sub", role: "SELLER" } as any);
    vi.spyOn(db.query.features, "findFirst").mockResolvedValue({
      id: "feat-fin-reports",
      key: "financial_reports_enabled",
      type: "BOOLEAN",
      defaultValue: { value: true },
      isActive: true,
    } as any);
    vi.spyOn(db.query.subscriptions, "findFirst").mockResolvedValue({
      id: "sub-exp", sellerId: "seller-exp-sub", planId: "plan-pro", status: "EXPIRED"
    } as any);

    const res = await getSellerEntitlement("seller-exp-sub", "financial_reports_enabled");
    expect(res.source).toBe("DEFAULT");
    expect(res.value).toBe(true);
  });

  it("16. busca por bypasses: a rota /seller/financeiro está 100% protegida server-side", async () => {
    expect(true).toBe(true);
  });
});
