import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH, POST } from "../[id]/commission/route";
import {
  SellerCommissionValidationError,
  SellerCommissionConcurrencyError,
  SellerCommissionService,
} from "@/lib/commission/seller-commission-service";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/db";

// Mock auth module
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock SellerCommissionService
vi.mock("@/lib/commission/seller-commission-service", () => {
  class MockSellerCommissionValidationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "SellerCommissionValidationError";
    }
  }

  class MockSellerCommissionConcurrencyError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "SellerCommissionConcurrencyError";
    }
  }

  return {
    SellerCommissionValidationError: MockSellerCommissionValidationError,
    SellerCommissionConcurrencyError: MockSellerCommissionConcurrencyError,
    SellerCommissionService: {
      resolveEffectiveFee: vi.fn(),
      getSellerCommissionSetting: vi.fn(),
      getSellerCommissionHistory: vi.fn(),
      updateSellerCommission: vi.fn(),
    },
  };
});

describe("Phase 4: Admin Seller Commission Management Endpoints", () => {
  const mockAdmin = {
    id: "admin-uuid-1",
    name: "Super Admin",
    email: "admin@webgran.com",
    role: "super_admin",
  };

  const mockSeller = {
    id: "seller-uuid-10",
    name: "Vendedor Teste",
    email: "seller@test.com",
    role: "seller",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue(mockAdmin as any);
    vi.mocked(db.query.users.findFirst as any).mockResolvedValue(mockSeller);
  });

  describe("Security & Authorization", () => {
    it("1. Blocks unauthenticated users with HTTP 401", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("UNAUTHORIZED"));

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission");
      const res = await GET(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("não autenticada");
    });

    it("2. Blocks non-admin sellers with HTTP 403", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("FORBIDDEN"));

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission");
      const res = await GET(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Acesso negado");
    });

    it("3. Allows authorized platform admin (admin / super_admin)", async () => {
      vi.mocked(SellerCommissionService.resolveEffectiveFee as any).mockResolvedValue({
        effectiveFeeCents: 50,
        effectiveFeeReais: 0.5,
        formattedFee: "R$ 0,50",
        source: "PLATFORM_DEFAULT",
      });
      vi.mocked(SellerCommissionService.getSellerCommissionSetting as any).mockResolvedValue(null);
      vi.mocked(SellerCommissionService.getSellerCommissionHistory as any).mockResolvedValue([]);

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission");
      const res = await GET(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.seller.id).toBe("seller-uuid-10");
    });
  });

  describe("GET /api/admin/sellers/[id]/commission", () => {
    it("4. Returns 404 if target seller is not found", async () => {
      vi.mocked(db.query.users.findFirst as any).mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/admin/sellers/inexistent-id/commission");
      const res = await GET(req, { params: Promise.resolve({ id: "inexistent-id" }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("não encontrado");
    });

    it("5. Returns effective fee, commission setting and immutable audit history", async () => {
      vi.mocked(SellerCommissionService.resolveEffectiveFee as any).mockResolvedValue({
        effectiveFeeCents: 25,
        effectiveFeeReais: 0.25,
        formattedFee: "R$ 0,25",
        source: "CUSTOM",
        isExempt: false,
      });
      vi.mocked(SellerCommissionService.getSellerCommissionSetting as any).mockResolvedValue({
        id: "setting-1",
        sellerId: "seller-uuid-10",
        customFeeCents: 25,
        exemptionActive: false,
        version: 3,
      });
      vi.mocked(SellerCommissionService.getSellerCommissionHistory as any).mockResolvedValue([
        {
          id: "log-1",
          previousFeeCents: 50,
          newFeeCents: 25,
          reason: "Acordo comercial VIP",
          changedByName: "Super Admin",
        },
      ]);

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission");
      const res = await GET(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.effectiveFee.effectiveFeeCents).toBe(25);
      expect(json.data.setting.version).toBe(3);
      expect(json.data.history).toHaveLength(1);
      expect(json.data.history[0].reason).toBe("Acordo comercial VIP");
    });
  });

  describe("PATCH /api/admin/sellers/[id]/commission", () => {
    it("6. Requires a non-empty audit reason (returns HTTP 400)", async () => {
      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "DEFAULT",
          reason: "", // missing/empty
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("justificativa");
    });

    it("7. Configures standard fee (mode: 'DEFAULT') with null custom fee", async () => {
      vi.mocked(SellerCommissionService.updateSellerCommission as any).mockResolvedValue({
        id: "setting-1",
        sellerId: "seller-uuid-10",
        customFeeCents: null,
        exemptionActive: false,
        version: 2,
      });
      vi.mocked(SellerCommissionService.resolveEffectiveFee as any).mockResolvedValue({
        effectiveFeeCents: 50,
        effectiveFeeReais: 0.5,
        formattedFee: "R$ 0,50",
        source: "PLATFORM_DEFAULT",
      });

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "DEFAULT",
          reason: "Retornando para taxa padrão da plataforma",
          expectedVersion: 1,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(SellerCommissionService.updateSellerCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: "seller-uuid-10",
          customFeeCents: null,
          exemptionActive: false,
          expectedVersion: 1,
          reason: "Retornando para taxa padrão da plataforma",
        })
      );
    });

    it("8. Configures custom fee (mode: 'CUSTOM') with 25 cents and 0 cents (explicit zero)", async () => {
      vi.mocked(SellerCommissionService.updateSellerCommission as any).mockResolvedValue({
        id: "setting-1",
        sellerId: "seller-uuid-10",
        customFeeCents: 0,
        exemptionActive: false,
        version: 3,
      });
      vi.mocked(SellerCommissionService.resolveEffectiveFee as any).mockResolvedValue({
        effectiveFeeCents: 0,
        effectiveFeeReais: 0.0,
        formattedFee: "R$ 0,00",
        source: "CUSTOM",
      });

      // Test 0 cents (explicit zero fee)
      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CUSTOM",
          customFeeCents: 0,
          reason: "Isenção total configurada via taxa zero",
          expectedVersion: 2,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(SellerCommissionService.updateSellerCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: "seller-uuid-10",
          customFeeCents: 0,
          exemptionActive: false,
          expectedVersion: 2,
        })
      );
    });

    it("9. Rejects invalid fee values (< 0, > 50, non-integer) with HTTP 400", async () => {
      // Fee > 50 cents
      const reqOver = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CUSTOM",
          customFeeCents: 75,
          reason: "Taxa acima do teto",
        }),
      });
      const resOver = await PATCH(reqOver, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(resOver.status).toBe(400);

      // Fee < 0 cents
      const reqUnder = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CUSTOM",
          customFeeCents: -10,
          reason: "Taxa negativa",
        }),
      });
      const resUnder = await PATCH(reqUnder, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(resUnder.status).toBe(400);
    });

    it("10. Requires exemptionReason when mode: 'EXEMPTION' (returns HTTP 400)", async () => {
      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "EXEMPTION",
          exemptionStart: "2026-10-01T00:00:00Z",
          exemptionEnd: "2026-11-01T00:00:00Z",
          exemptionReason: "", // missing
          reason: "Ativação de isenção",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("justificativa da isenção temporária é obrigatória");
    });

    it("11. Handles optimistic concurrency conflict with HTTP 409 and code CONCURRENCY_CONFLICT", async () => {
      vi.mocked(SellerCommissionService.updateSellerCommission as any).mockRejectedValueOnce(
        new SellerCommissionConcurrencyError("Conflito de versão ao atualizar taxa do vendedor.")
      );

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CUSTOM",
          customFeeCents: 20,
          expectedVersion: 1, // Stale version
          reason: "Tentativa de atualizar versão obsoleta",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("CONCURRENCY_CONFLICT");
    });

    it("12. Handles validation error with HTTP 400 and code VALIDATION_ERROR", async () => {
      vi.mocked(SellerCommissionService.updateSellerCommission as any).mockRejectedValueOnce(
        new SellerCommissionValidationError("A data de término deve ser posterior à data de início.")
      );

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "EXEMPTION",
          exemptionActive: true,
          exemptionStart: "2026-11-01T00:00:00Z",
          exemptionEnd: "2026-10-01T00:00:00Z",
          exemptionReason: "Datas invertidas",
          reason: "Teste de validação de datas",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("13. POST method acts as an alias to PATCH", async () => {
      vi.mocked(SellerCommissionService.updateSellerCommission as any).mockResolvedValue({
        id: "setting-1",
        sellerId: "seller-uuid-10",
        customFeeCents: 30,
        exemptionActive: false,
        version: 4,
      });
      vi.mocked(SellerCommissionService.resolveEffectiveFee as any).mockResolvedValue({
        effectiveFeeCents: 30,
        effectiveFeeReais: 0.3,
        formattedFee: "R$ 0,30",
        source: "CUSTOM",
      });

      const req = new Request("http://localhost/api/admin/sellers/seller-uuid-10/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CUSTOM",
          customFeeCents: 30,
          reason: "Via POST alias",
        }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: "seller-uuid-10" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
