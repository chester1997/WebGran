import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake database tables
interface FakeStore {
  id: string;
  slug: string;
  name: string;
}

interface FakeProduct {
  id: string;
  storeId: string;
  title: string;
  price: string;
  status: string;
  slug: string;
  coverUrl: string | null;
}

interface FakeCombo {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  price: string;
  type: "curated" | "progressive";
  eligibilityMode: "all_products" | "specific_products";
  status: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeComboProduct {
  comboId: string;
  productId: string;
  position: number;
}

interface FakeComboTier {
  id: string;
  comboId: string;
  minQuantity: number;
  price: string;
  position: number;
}

const mockStores: FakeStore[] = [
  { id: "store-1", slug: "mystore", name: "My Store" },
];

let mockProducts: FakeProduct[] = [];
let mockCombos: FakeCombo[] = [];
let mockComboProducts: FakeComboProduct[] = [];
let mockComboTiers: FakeComboTier[] = [];

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(async () => ({ id: "seller-1", email: "seller@test.com" })),
  getCurrentStore: vi.fn(async () => mockStores[0]),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function extractMatchingProductIds(obj: any, allIds: string[]): string[] {
  const found: string[] = [];
  const visited = new Set();
  function search(item: any) {
    if (!item || typeof item !== "object" || visited.has(item)) return;
    visited.add(item);
    if (Array.isArray(item)) {
      for (const el of item) {
        if (typeof el === "string" && allIds.includes(el)) {
          found.push(el);
        } else {
          search(el);
        }
      }
    } else {
      for (const key of Object.keys(item)) {
        const val = item[key];
        if (typeof val === "string" && allIds.includes(val)) {
          found.push(val);
        } else {
          search(val);
        }
      }
    }
  }
  search(obj);
  return Array.from(new Set(found));
}

// Mock db
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        stores: {
          findFirst: vi.fn(async () => mockStores[0]),
        },
        combos: {
          findFirst: vi.fn(async () => {
            return mockCombos[0] || null;
          }),
          findMany: vi.fn(async () => {
            return mockCombos.map((c) => ({
              ...c,
              products: mockComboProducts
                .filter((cp) => cp.comboId === c.id)
                .map((cp) => {
                  const p = mockProducts.find((mp) => mp.id === cp.productId);
                  return {
                    position: cp.position,
                    product: p || { id: cp.productId, title: "Product", price: "10.00", status: "active", coverUrl: null },
                  };
                }),
              tiers: mockComboTiers.filter((ct) => ct.comboId === c.id),
            }));
          }),
        },
        products: {
          findMany: vi.fn(async ({ where }: any) => {
            const allProductIds = mockProducts.map((p) => p.id);
            const requested = extractMatchingProductIds(where, allProductIds);
            if (requested.length > 0) {
              return mockProducts.filter((p) => requested.includes(p.id));
            }
            return mockProducts;
          }),
        },
        orderItems: {
          findFirst: vi.fn(async () => null),
        },
      },
      insert: (table: any) => ({
        values: (data: any) => {
          const list = Array.isArray(data) ? data : [data];
          const createdList = list.map((row: any) => {
            const item = {
              id: row.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              ...row,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            if ("minQuantity" in row) {
              mockComboTiers.push(item as any);
            } else if ("comboId" in row && "productId" in row) {
              mockComboProducts.push(item as any);
            } else {
              mockCombos.push(item as any);
            }
            return item;
          });
          return {
            returning: () => createdList,
            then: (resolve: any) => resolve(createdList),
          };
        },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (predicate: any) => {
            if (mockCombos.length > 0) {
              Object.assign(mockCombos[0], data);
            }
            return {
              returning: () => {
                if (mockCombos.length > 0) {
                  return [mockCombos[0]];
                }
                return [];
              },
              then: (resolve: any) => resolve([mockCombos[0]]),
            };
          },
        }),
      }),
      delete: (table: any) => ({
        where: (predicate: any) => Promise.resolve(),
      }),
      transaction: vi.fn(async (cb: any) => {
        const tx = {
          insert: (t: any) => ({
            values: (data: any) => {
              const list = Array.isArray(data) ? data : [data];
              const createdList = list.map((row: any) => {
                const item = {
                  id: row.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  ...row,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                if ("minQuantity" in row) {
                  mockComboTiers.push(item as any);
                } else if ("comboId" in row && "productId" in row) {
                  mockComboProducts.push(item as any);
                } else {
                  mockCombos.push(item as any);
                }
                return item;
              });
              return {
                returning: () => createdList,
                then: (resolve: any) => resolve(createdList),
              };
            },
          }),
          update: (t: any) => ({
            set: (data: any) => ({
              where: () => {
                if (mockCombos.length > 0) {
                  Object.assign(mockCombos[0], data);
                }
                return {
                  returning: () => {
                    if (mockCombos.length > 0) {
                      return [mockCombos[0]];
                    }
                    return [];
                  },
                  then: (resolve: any) => resolve([mockCombos[0]]),
                };
              },
            }),
          }),
          delete: (t: any) => ({
            where: () => Promise.resolve(),
          }),
        };
        return cb(tx);
      }),
    },
  };
});

// Import actions after mocking
import {
  createComboAction,
  updateComboAction,
  toggleComboStatusAction,
  getCombosAction,
} from "@/app/(seller)/seller/combos/actions";

describe("Fase D — Interface e Actions de Combos Progressivos", () => {
  beforeEach(() => {
    mockProducts = [
      { id: "p1", storeId: "store-1", title: "Canal VIP", price: "20.00", status: "active", slug: "vip", coverUrl: null },
      { id: "p2", storeId: "store-1", title: "Grupo Chat", price: "15.00", status: "active", slug: "chat", coverUrl: null },
      { id: "p3", storeId: "store-1", title: "Curso Completo", price: "50.00", status: "active", slug: "curso", coverUrl: null },
    ];
    mockCombos = [];
    mockComboProducts = [];
    mockComboTiers = [];
    vi.clearAllMocks();
  });

  describe("Validação de Criação de Combos Tradicionais", () => {
    it("deve rejeitar combo tradicional com menos de 2 produtos", async () => {
      await expect(
        createComboAction({
          title: "Combo Invalido",
          type: "curated",
          productIds: ["p1"],
          price: 15.0,
        })
      ).rejects.toThrow("O combo tradicional deve conter pelo menos 2 produtos distintos.");
    });

    it("deve rejeitar combo tradicional se preço for maior ou igual à soma dos produtos", async () => {
      // p1 (20) + p2 (15) = 35.00
      await expect(
        createComboAction({
          title: "Combo Sem Desconto",
          type: "curated",
          productIds: ["p1", "p2"],
          price: 35.0,
        })
      ).rejects.toThrow("deve ser menor que a soma dos produtos individuais");
    });

    it("deve criar combo tradicional com sucesso quando dados forem válidos", async () => {
      const res = await createComboAction({
        title: "Combo Especial",
        type: "curated",
        productIds: ["p1", "p2"],
        price: 25.0,
      });

      expect(res.success).toBe(true);
      expect(res.combo).toBeDefined();
      expect(res.combo.title).toBe("Combo Especial");
      expect(res.combo.type).toBe("curated");
      expect(res.combo.eligibilityMode).toBe("specific_products");
    });
  });

  describe("Validação de Criação de Ofertas Progressivas", () => {
    it("deve rejeitar oferta progressiva sem nenhuma faixa", async () => {
      await expect(
        createComboAction({
          title: "Oferta Sem Faixas",
          type: "progressive",
          tiers: [],
        })
      ).rejects.toThrow("A oferta progressiva deve conter pelo menos uma faixa de desconto configurada.");
    });

    it("deve rejeitar faixa com quantidade mínima menor que 2", async () => {
      await expect(
        createComboAction({
          title: "Oferta Invalida",
          type: "progressive",
          tiers: [{ minQuantity: 1, price: 10.0 }],
        })
      ).rejects.toThrow("Quantidade mínima da faixa inválida (1). Deve ser um número inteiro maior ou igual a 2.");
    });

    it("deve rejeitar faixa com preço menor ou igual a zero", async () => {
      await expect(
        createComboAction({
          title: "Oferta Preço Zero",
          type: "progressive",
          tiers: [{ minQuantity: 3, price: 0 }],
        })
      ).rejects.toThrow("Preço da faixa inválido (R$ 0). Deve ser um valor maior que zero.");
    });

    it("deve rejeitar oferta progressiva com faixas de quantidades duplicadas", async () => {
      await expect(
        createComboAction({
          title: "Oferta Quantidade Duplicada",
          type: "progressive",
          tiers: [
            { minQuantity: 3, price: 12.0 },
            { minQuantity: 3, price: 10.0 },
          ],
        })
      ).rejects.toThrow("Quantidade duplicada encontrada nas faixas: 3 unidades já configurada.");
    });

    it("deve criar oferta progressiva no modo all_products sem exigir produtos selecionados", async () => {
      const res = await createComboAction({
        title: "Leve Mais por Menos - Loja Toda",
        type: "progressive",
        eligibilityMode: "all_products",
        tiers: [
          { minQuantity: 3, price: 12.0 },
          { minQuantity: 5, price: 18.0 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.combo).toBeDefined();
      expect(res.combo.type).toBe("progressive");
      expect(res.combo.eligibilityMode).toBe("all_products");
      expect(mockComboTiers.length).toBe(2);
      expect(mockComboTiers[0].minQuantity).toBe(3);
      expect(mockComboTiers[1].minQuantity).toBe(5);
    });

    it("deve rejeitar oferta progressiva specific_products se nenhum produto for informado", async () => {
      await expect(
        createComboAction({
          title: "Oferta Específica Vazia",
          type: "progressive",
          eligibilityMode: "specific_products",
          productIds: [],
          tiers: [{ minQuantity: 3, price: 12.0 }],
        })
      ).rejects.toThrow("No modo de produtos específicos, selecione pelo menos um produto participante.");
    });

    it("deve criar oferta progressiva no modo specific_products com produtos elegíveis", async () => {
      const res = await createComboAction({
        title: "Leve Mais por Menos - VIPs",
        type: "progressive",
        eligibilityMode: "specific_products",
        productIds: ["p1", "p2"],
        tiers: [{ minQuantity: 3, price: 12.0 }],
      });

      expect(res.success).toBe(true);
      expect(res.combo).toBeDefined();
      expect(res.combo.type).toBe("progressive");
      expect(res.combo.eligibilityMode).toBe("specific_products");
    });
  });

  describe("Edição e Gestão de Ofertas Progressivas", () => {
    it("deve permitir pausar e ativar sem apagar dados", async () => {
      mockCombos.push({
        id: "combo-prog-1",
        storeId: "store-1",
        title: "Oferta Ativa",
        slug: "oferta-ativa",
        description: null,
        coverUrl: null,
        price: "12.00",
        type: "progressive",
        eligibilityMode: "all_products",
        status: "active",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await toggleComboStatusAction("combo-prog-1");
      expect(res.success).toBe(true);
      expect(res.status).toBe("inactive");
      expect(mockCombos[0].status).toBe("inactive");
    });

    it("deve listar ofertas retornando os tipos, faixas e modos de elegibilidade corretos", async () => {
      mockCombos.push({
        id: "combo-prog-1",
        storeId: "store-1",
        title: "Oferta Progressiva",
        slug: "oferta-progressiva",
        description: null,
        coverUrl: null,
        price: "12.00",
        type: "progressive",
        eligibilityMode: "all_products",
        status: "active",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockComboTiers.push({
        id: "t1",
        comboId: "combo-prog-1",
        minQuantity: 3,
        price: "12.00",
        position: 1,
      });

      const list = await getCombosAction();
      expect(list.length).toBe(1);
      expect(list[0].type).toBe("progressive");
      expect(list[0].eligibilityMode).toBe("all_products");
      expect(list[0].tiers?.length).toBe(1);
      expect(list[0].tiers?.[0].minQuantity).toBe(3);
    });
  });
});
