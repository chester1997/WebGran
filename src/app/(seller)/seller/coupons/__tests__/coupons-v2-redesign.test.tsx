import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock das dependências de Next e DB
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockDb: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };
  return { db: mockDb };
});

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 10 }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { hasFeature, checkLimit } from "@/lib/entitlements/entitlement-service";
import { db } from "@/db";
import SellerCouponsPage from "../page";
import CouponsClientV2, { CouponItem } from "../CouponsClientV2";
import CouponsClient from "../CouponsClient";
import {
  getCouponsAction,
  createCouponAction,
  toggleCouponStatusAction,
  deleteCouponAction,
} from "../actions";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_COUPONS: CouponItem[] = [
  {
    id: "coupon-1",
    storeId: "store-1",
    code: "PROMO10",
    discountType: "percentage",
    discountValue: "10.00",
    minOrderValue: "50.00",
    maxUses: 100,
    usedCount: 25,
    expiresAt: "2026-12-31T23:59:59.000Z",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "coupon-2",
    storeId: "store-1",
    code: "FIXO20",
    discountType: "fixed",
    discountValue: "20.00",
    minOrderValue: null,
    maxUses: null,
    usedCount: 5,
    expiresAt: null,
    status: "inactive",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "coupon-3",
    storeId: "store-1",
    code: "EXPIRED30",
    discountType: "percentage",
    discountValue: "30.00",
    minOrderValue: "100.00",
    maxUses: 10,
    usedCount: 10,
    expiresAt: "2025-01-01T00:00:00.000Z",
    status: "active",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

describe("ETAPA 4.2 — REDESIGN V2 DA PÁGINA DE CUPONS (/seller/coupons)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-1",
      name: "Loja Teste Cupons",
    });

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(MOCK_COUPONS),
        }),
      }),
    });
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar CouponsClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await SellerCouponsPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Cupons de desconto");
      expect(html).toContain("Total de Cupons");
      expect(html).toContain("Total de Resgates");
      expect(html).toContain("Criar cupom");
    });

    it("deve renderizar CouponsClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await SellerCouponsPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Cupons de desconto");
      expect(html).toContain("Total de Cupons");
    });

    it("NÃO deve renderizar CouponsClientV2 para outro admin com e-mail diferente", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await SellerCouponsPage();
      const html = renderToStaticMarkup(jsx);

      // Deve renderizar versão clássica
      expect(html).not.toContain("Buscar por código em 3 cupons...");
      expect(html).not.toContain("Cupons cadastrados");
      expect(html).toContain("Código do Cupom");
      expect(html).toContain('title="Excluir Cupom"');
    });

    it("NÃO deve renderizar CouponsClientV2 para vendedor comum", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await SellerCouponsPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("Buscar por código em 3 cupons...");
      expect(html).not.toContain("Cupons cadastrados");
      expect(html).toContain("Código do Cupom");
      expect(html).toContain('title="Excluir Cupom"');
    });
  });

  describe("2. Renderização do Design System V2 em CouponsClientV2", () => {
    it("renderiza PageHeader com título, contadores e botão 'Criar cupom'", () => {
      const html = renderToStaticMarkup(
        <CouponsClientV2 initialCoupons={MOCK_COUPONS} />
      );

      expect(html).toContain("Cupons de desconto");
      expect(html).toContain("3 cupons");
      expect(html).toContain("Criar cupom");
      expect(html).toContain("Crie e gerencie códigos promocionais");
    });

    it("renderiza os 4 StatCards com valores e cálculos corretos", () => {
      const html = renderToStaticMarkup(
        <CouponsClientV2 initialCoupons={MOCK_COUPONS} />
      );

      // Total de Cupons: 3
      expect(html).toContain("Total de Cupons");
      expect(html).toContain("3");

      // Cupons Ativos: 2 (coupon-1 e coupon-3)
      expect(html).toContain("Cupons Ativos");
      expect(html).toContain("2");

      // Cupons Inativos: 1 (coupon-2)
      expect(html).toContain("Cupons Inativos");
      expect(html).toContain("1");

      // Total de Resgates: 25 + 5 + 10 = 40
      expect(html).toContain("Total de Resgates");
      expect(html).toContain("40");
    });

    it("renderiza Toolbar com campo de busca por código e filtros de status e tipo", () => {
      const html = renderToStaticMarkup(
        <CouponsClientV2 initialCoupons={MOCK_COUPONS} />
      );

      expect(html).toContain('placeholder="Buscar por código em 3 cupons..."');
      expect(html).toContain("Todos os Status");
      expect(html).toContain("Todos os Tipos");
      expect(html).toContain("Porcentagem (%)");
      expect(html).toContain("Valor Fixo (R$)");
    });

    it("renderiza os cupons com códigos, descontos e detalhes corretos", () => {
      const html = renderToStaticMarkup(
        <CouponsClientV2 initialCoupons={MOCK_COUPONS} />
      );

      // Códigos
      expect(html).toContain("PROMO10");
      expect(html).toContain("FIXO20");
      expect(html).toContain("EXPIRED30");

      // Descontos
      expect(html).toContain("10% OFF");
      expect(html).toContain("R$ 20,00 OFF");
      expect(html).toContain("30% OFF");

      // Pedido mínimo
      expect(html).toContain("Mínimo de R$ 50,00");
      expect(html).toContain("Sem mínimo");

      // Utilizações
      expect(html).toContain("25");
      expect(html).toContain("/ 100");
      expect(html).toContain("5");
      expect(html).toContain("(Sem limite)");
    });

    it("renderiza EmptyState quando não há cupons cadastrados", () => {
      const html = renderToStaticMarkup(
        <CouponsClientV2 initialCoupons={[]} />
      );

      expect(html).toContain("Nenhum cupom cadastrado");
      expect(html).toContain("Crie seu primeiro cupom de desconto");
      expect(html).toContain("Criar cupom");
    });
  });

  describe("3. Regras Comerciais, Entitlements e Limites nas Server Actions", () => {
    it("bloqueia criação de cupom quando coupons_enabled não estiver disponível no plano", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (hasFeature as any).mockResolvedValue(false);

      await expect(
        createCouponAction({
          code: "TESTE",
          discountType: "percentage",
          discountValue: 10,
        })
      ).rejects.toThrow("A criação de cupons não está disponível no seu plano");
    });

    it("bloqueia criação de cupom quando o limite max_coupons for atingido", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (hasFeature as any).mockResolvedValue(true);
      (checkLimit as any).mockResolvedValue({ allowed: false, limit: 5 });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}, {}, {}, {}, {}]),
        }),
      });

      await expect(
        createCouponAction({
          code: "TESTE",
          discountType: "percentage",
          discountValue: 10,
        })
      ).rejects.toThrow("Limite de cupons ativos atingido (5)");
    });

    it("valida obrigatoriedade do código e valor maior que zero", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (hasFeature as any).mockResolvedValue(true);
      (checkLimit as any).mockResolvedValue({ allowed: true });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        createCouponAction({
          code: "   ",
          discountType: "percentage",
          discountValue: 10,
        })
      ).rejects.toThrow("O código do cupom é obrigatório");

      await expect(
        createCouponAction({
          code: "PROMO",
          discountType: "percentage",
          discountValue: 0,
        })
      ).rejects.toThrow("O valor do desconto deve ser maior que zero");

      await expect(
        createCouponAction({
          code: "PROMO",
          discountType: "percentage",
          discountValue: 150,
        })
      ).rejects.toThrow("Desconto percentual não pode exceder 100%");
    });

    it("executa toggleCouponStatusAction invertendo de active para inactive", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      const res = await toggleCouponStatusAction("coupon-1", "active");
      expect(res).toEqual({ success: true });
      expect(db.update).toHaveBeenCalled();
    });

    it("executa deleteCouponAction com segurança por loja", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      const res = await deleteCouponAction("coupon-1");
      expect(res).toEqual({ success: true });
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
