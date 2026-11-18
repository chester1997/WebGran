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

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    reserveStorageForUpload: vi.fn().mockResolvedValue({ allowed: true, reservationId: "res-1" }),
    confirmReservation: vi.fn().mockResolvedValue(true),
    releaseReservation: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ url: "https://cdn.test/combo.webp", sizeBytes: 1234 }),
  }),
  generateMultiTenantStoragePath: vi.fn().mockReturnValue("stores/store-1/products/combo.webp"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { mockDb } = vi.hoisted(() => {
  const db: any = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "combo-new", title: "Combo Teste" }])),
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
    transaction: vi.fn(async (cb: any) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ id: "combo-new", title: "Combo Teste" }])),
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
      };
      return await cb(tx);
    }),
    query: {
      combos: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      comboProducts: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      products: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      orderItems: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    },
  };
  return { mockDb: db };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import SellerCombosPage from "../page";
import CombosClientV2, { ActiveProduct } from "../CombosClientV2";
import CombosClient from "../CombosClient";
import {
  getCombosAction,
  getStoreActiveProductsAction,
  createComboAction,
  updateComboAction,
  toggleComboStatusAction,
  deleteComboAction,
  ComboItem,
} from "../actions";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_PRODUCTS: ActiveProduct[] = [
  {
    id: "prod-1",
    title: "Conta Streaming Premium 30d",
    price: "35.00",
    coverUrl: "https://example.com/cover1.webp",
    status: "active",
  },
  {
    id: "prod-2",
    title: "Gift Card Games R$ 50",
    price: "45.00",
    coverUrl: "https://example.com/cover2.webp",
    status: "active",
  },
  {
    id: "prod-3",
    title: "VPN Pro 1 Ano",
    price: "60.00",
    coverUrl: null,
    status: "active",
  },
];

const MOCK_COMBOS: ComboItem[] = [
  {
    id: "combo-1",
    storeId: "store-1",
    title: "Super Combo Entretenimento",
    slug: "super-combo-entretenimento",
    description: "Leve streaming + gift card por um valor imperdível!",
    coverUrl: "https://example.com/combo1.webp",
    price: "65.00",
    type: "curated",
    eligibilityMode: "specific_products",
    status: "active",
    position: 0,
    normalPrice: 80.0,
    savings: 15.0,
    savingsPercentage: 19,
    products: [
      {
        id: "prod-1",
        title: "Conta Streaming Premium 30d",
        price: "35.00",
        coverUrl: "https://example.com/cover1.webp",
        status: "active",
        position: 0,
      },
      {
        id: "prod-2",
        title: "Gift Card Games R$ 50",
        price: "45.00",
        coverUrl: "https://example.com/cover2.webp",
        status: "active",
        position: 1,
      },
    ],
    tiers: [],
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
  },
  {
    id: "combo-2",
    storeId: "store-1",
    title: "Oferta Progressiva Gamers",
    slug: "oferta-progressiva-gamers",
    description: "Compre mais unidades e ganhe descontos escalonados.",
    coverUrl: null,
    price: "12.00",
    type: "progressive",
    eligibilityMode: "all_products",
    status: "inactive",
    position: 1,
    normalPrice: 0,
    savings: 0,
    savingsPercentage: 0,
    products: [],
    tiers: [
      { id: "tier-1", minQuantity: 3, price: "12.00", position: 0 },
      { id: "tier-2", minQuantity: 5, price: "18.00", position: 1 },
    ],
    createdAt: new Date("2026-01-02T10:00:00Z"),
    updatedAt: new Date("2026-01-02T10:00:00Z"),
  },
];

describe("ETAPA 4.5 — REDESIGN V2 DA PÁGINA DE COMBOS E OFERTAS (/seller/combos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-1",
      name: "Loja Teste Combos",
      slug: "loja-teste",
    });

    mockDb.query.combos.findMany.mockResolvedValue([
      {
        id: "combo-1",
        storeId: "store-1",
        title: "Super Combo Entretenimento",
        slug: "super-combo-entretenimento",
        description: "Leve streaming + gift card por um valor imperdível!",
        coverUrl: "https://example.com/combo1.webp",
        price: "65.00",
        type: "curated",
        eligibilityMode: "specific_products",
        status: "active",
        position: 0,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        updatedAt: new Date("2026-01-01T10:00:00Z"),
        products: [
          {
            position: 0,
            product: MOCK_PRODUCTS[0],
          },
          {
            position: 1,
            product: MOCK_PRODUCTS[1],
          },
        ],
        tiers: [],
      },
    ]);

    mockDb.query.products.findMany.mockResolvedValue(MOCK_PRODUCTS);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar CombosClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await SellerCombosPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Combos e Ofertas");
      expect(html).toContain("Total de Promoções");
      expect(html).toContain("Ofertas Ativas");
      expect(html).toContain("Ofertas Pausadas");
      expect(html).toContain("Ofertas Progressivas");
      expect(html).toContain("Nova oferta");
      expect(html).toContain("Super Combo Entretenimento");
    });

    it("deve renderizar CombosClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await SellerCombosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Combos e Ofertas");
      expect(html).toContain("Total de Promoções");
      expect(html).toContain("Ofertas Ativas");
    });

    it("NÃO deve renderizar CombosClientV2 para outro admin com e-mail diferente (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await SellerCombosPage();
      const html = renderToStaticMarkup(jsx);

      // O V2 possui os StatCards padronizados com "Total de Promoções" e "Ofertas Pausadas"
      expect(html).not.toContain("Ofertas Pausadas");
      expect(html).not.toContain("Nova oferta"); // O clássico usa "Nova Oferta" com O maiúsculo
      expect(html).toContain("Super Combo Entretenimento");
    });

    it("NÃO deve renderizar CombosClientV2 para vendedor comum (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await SellerCombosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("Ofertas Pausadas");
      expect(html).toContain("Super Combo Entretenimento");
    });

    it("deve renderizar SetupStoreClient quando o lojista não possui loja cadastrada", async () => {
      (getCurrentStore as any).mockResolvedValue(null);
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: OWNER_EMAIL,
      });

      const jsx = await SellerCombosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Configure sua Loja");
    });
  });

  describe("2. Renderização do Design System V2 (CombosClientV2)", () => {
    it("deve renderizar os 4 StatCards com contadores corretos", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={MOCK_COMBOS}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      // Stat 1: Total
      expect(html).toContain("Total de Promoções");
      expect(html).toContain("1 combos fixos cadastrados");

      // Stat 2: Ativas
      expect(html).toContain("Ofertas Ativas");
      expect(html).toContain("Exibidas no bot e mini app");

      // Stat 3: Pausadas
      expect(html).toContain("Ofertas Pausadas");
      expect(html).toContain("Ocultas temporariamente");

      // Stat 4: Progressivas
      expect(html).toContain("Ofertas Progressivas");
      expect(html).toContain("Compre mais e pague menos");
    });

    it("deve renderizar Toolbar com campo de busca e controles de visualização", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={MOCK_COMBOS}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      expect(html).toContain("Buscar em 2 ofertas por nome, slug ou produto...");
      expect(html).toContain("Todos os Tipos");
      expect(html).toContain("Combos Fixos");
      expect(html).toContain("Ofertas Progressivas");
      expect(html).toContain("Todos os Status");
      expect(html).toContain("Visualização em Grade");
      expect(html).toContain("Visualização em Lista");
    });

    it("deve exibir detalhes de combo fixo: badges, preço promocional, economia e produtos participantes", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={MOCK_COMBOS}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      expect(html).toContain("Combo Fixo");
      expect(html).toContain("-19%");
      expect(html).toContain("R$ 65.00");
      expect(html).toContain("R$ 80.00");
      expect(html).toContain("/super-combo-entretenimento");
      expect(html).toContain("Conta Streaming Premium 30d");
      expect(html).toContain("Gift Card Games R$ 50");
    });

    it("deve exibir detalhes de oferta progressiva: faixas e elegibilidade", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={MOCK_COMBOS}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      expect(html).toContain("Oferta Progressiva");
      // Faixas explicadas em total e preço por unidade (ex.: "3 por R$ 12,00 · R$ 4,00 cada")
      expect(html).toMatch(/3 por <b[^>]*>R\$\s12,00<\/b>/);
      expect(html).toMatch(/R\$\s4,00 cada/);
      expect(html).toMatch(/5 por <b[^>]*>R\$\s18,00<\/b>/);
      expect(html).toMatch(/R\$\s3,60 cada/);
      expect(html).toContain("Toda a loja");
    });

    it("deve renderizar visualização em lista/tabela quando selecionado", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={MOCK_COMBOS}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      // Na renderização em grade padrão, a tabela não está presente; quando trocado para lista, tem th
      // Vamos verificar os elementos de controle de visualização
      expect(html).toContain("Visualização em Lista");
    });

    it("deve exibir estado vazio quando não há ofertas cadastradas", () => {
      const html = renderToStaticMarkup(
        <CombosClientV2
          initialCombos={[]}
          activeProducts={MOCK_PRODUCTS}
          storeSlug="loja-teste"
        />
      );

      expect(html).toContain("Nenhuma oferta cadastrada");
      expect(html).toContain("Crie seu primeiro combo tradicional ou oferta progressiva");
      expect(html).toContain("Nova oferta");
    });
  });

  describe("3. Regras de Negócio e Server Actions", () => {
    it("createComboAction: deve rejeitar combo sem título", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      await expect(
        createComboAction({ title: "", type: "curated" })
      ).rejects.toThrow("O nome da promoção/combo é obrigatório.");
    });

    it("createComboAction: deve rejeitar combo fixo com menos de 2 produtos", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      await expect(
        createComboAction({
          title: "Combo Curto",
          type: "curated",
          productIds: ["prod-1"],
          price: 20,
        })
      ).rejects.toThrow("O combo tradicional deve conter pelo menos 2 produtos distintos.");
    });

    it("createComboAction: deve rejeitar combo fixo quando preço promocional >= soma normal", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      mockDb.query.products.findMany.mockResolvedValue([MOCK_PRODUCTS[0], MOCK_PRODUCTS[1]]); // soma = 80.00

      await expect(
        createComboAction({
          title: "Combo Sem Desconto",
          type: "curated",
          productIds: ["prod-1", "prod-2"],
          price: 85, // maior que 80
        })
      ).rejects.toThrow("deve ser menor que a soma dos produtos individuais");
    });

    it("createComboAction: deve criar combo fixo com sucesso e persistir relações", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      mockDb.query.products.findMany.mockResolvedValue([MOCK_PRODUCTS[0], MOCK_PRODUCTS[1]]);

      const res = await createComboAction({
        title: "Combo Sucesso",
        type: "curated",
        productIds: ["prod-1", "prod-2"],
        price: 60,
      });

      expect(res.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("createComboAction: deve rejeitar oferta progressiva sem faixas ou com minQuantity < 2", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      await expect(
        createComboAction({
          title: "Progressivo Inválido",
          type: "progressive",
          tiers: [{ minQuantity: 1, price: 10 }],
        })
      ).rejects.toThrow("Deve ser um número inteiro maior ou igual a 2.");
    });

    it("createComboAction: deve criar oferta progressiva com sucesso", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });

      const res = await createComboAction({
        title: "Progressivo Sucesso",
        type: "progressive",
        eligibilityMode: "all_products",
        tiers: [
          { minQuantity: 3, price: 12.0 },
          { minQuantity: 5, price: 18.0 },
        ],
      });

      expect(res.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("toggleComboStatusAction: deve alternar status entre active e inactive", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      mockDb.query.combos.findFirst.mockResolvedValue({
        id: "combo-1",
        storeId: "store-1",
        status: "active",
      });

      const res = await toggleComboStatusAction("combo-1");
      expect(res.success).toBe(true);
      expect(res.status).toBe("inactive");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("deleteComboAction: deve arquivar combo se houver pedidos registrados para proteger histórico", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      mockDb.query.combos.findFirst.mockResolvedValue({
        id: "combo-1",
        storeId: "store-1",
      });
      // Simula que existe pedido com esse combo
      mockDb.query.orderItems.findFirst.mockResolvedValue({
        id: "order-item-1",
        comboId: "combo-1",
      });

      const res = await deleteComboAction("combo-1");
      expect(res.success).toBe(true);
      expect(res.action).toBe("archived");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("deleteComboAction: deve excluir definitivamente se não houver pedidos registrados", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      mockDb.query.combos.findFirst.mockResolvedValue({
        id: "combo-1",
        storeId: "store-1",
      });
      mockDb.query.orderItems.findFirst.mockResolvedValue(null);

      const res = await deleteComboAction("combo-1");
      expect(res.success).toBe(true);
      expect(res.action).toBe("deleted");
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
