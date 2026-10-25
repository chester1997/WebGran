import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      combos: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      comboProducts: {
        findMany: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

import { ComboService } from "../combo-service";

describe("ComboService Suite (Phase 4 — Etapa 4)", () => {
  const storeId = "store-alpha";

  const product1 = {
    id: "p1",
    storeId: "store-alpha",
    title: "Canal VIP",
    price: "50.00",
    coverUrl: "https://img.test/p1.webp",
    status: "active",
  };

  const product2 = {
    id: "p2",
    storeId: "store-alpha",
    title: "Grupo Network",
    price: "70.00",
    coverUrl: "https://img.test/p2.webp",
    status: "active",
  };

  const productForeign = {
    id: "p-other",
    storeId: "store-beta", // Belongs to different store!
    title: "Produto de Outra Loja",
    price: "100.00",
    coverUrl: null,
    status: "active",
  };

  const productInactive = {
    id: "p-inactive",
    storeId: "store-alpha",
    title: "Produto Inativo",
    price: "40.00",
    coverUrl: null,
    status: "inactive",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty list if storeId is empty or no combos found", async () => {
    mockDb.query.combos.findMany.mockResolvedValueOnce([]);
    const res = await ComboService.getActiveCombos("");
    expect(res).toEqual([]);

    const res2 = await ComboService.getActiveCombos(storeId);
    expect(res2).toEqual([]);
  });

  it("should list active combos with valid component products and correct savings calculation", async () => {
    mockDb.query.combos.findMany.mockResolvedValueOnce([
      {
        id: "combo-1",
        storeId: "store-alpha",
        title: "Pacote VIP Completo",
        slug: "pacote-vip-completo",
        description: "Acesso a ambos os canais",
        coverUrl: "https://img.test/combo1.webp",
        price: "89.90",
        status: "active",
        position: 0,
        products: [
          { position: 0, product: product1 }, // 50
          { position: 1, product: product2 }, // 70 -> Total = 120
        ],
      },
    ]);

    const combos = await ComboService.getActiveCombos(storeId);

    expect(combos).toHaveLength(1);
    const c = combos[0];
    expect(c.id).toBe("combo-1");
    expect(c.title).toBe("Pacote VIP Completo");
    expect(c.price).toBe(89.9);
    expect(c.normalPrice).toBe(120);
    expect(c.savings).toBe(30.1); // 120 - 89.90 = 30.10
    expect(c.savingsPercentage).toBe(25); // 30.1 / 120 = 25%
    expect(c.products).toHaveLength(2);
  });

  it("should filter out component products that belong to another store or are inactive", async () => {
    mockDb.query.combos.findMany.mockResolvedValueOnce([
      {
        id: "combo-invalid-items",
        storeId: "store-alpha",
        title: "Combo com Itens Inválidos",
        slug: "combo-invalid-items",
        price: "60.00",
        status: "active",
        position: 0,
        products: [
          { position: 0, product: product1 }, // Active in store-alpha (50)
          { position: 1, product: productForeign }, // store-beta (Ignored)
          { position: 2, product: productInactive }, // inactive (Ignored)
        ],
      },
    ]);

    // Since only 1 product remains valid (product1), combo has < 2 products and must be discarded
    const combos = await ComboService.getActiveCombos(storeId);
    expect(combos).toHaveLength(0);
  });

  it("should retain combo when at least 2 products remain active after filtering out invalid items", async () => {
    const product3 = {
      id: "p3",
      storeId: "store-alpha",
      title: "Curso Especial",
      price: "100.00",
      status: "active",
    };

    mockDb.query.combos.findMany.mockResolvedValueOnce([
      {
        id: "combo-3",
        storeId: "store-alpha",
        title: "Super Combo",
        slug: "super-combo",
        price: "119.90",
        status: "active",
        position: 0,
        products: [
          { position: 0, product: product1 }, // 50
          { position: 1, product: product3 }, // 100 -> Total 150
          { position: 2, product: productForeign }, // Ignored
        ],
      },
    ]);

    const combos = await ComboService.getActiveCombos(storeId);
    expect(combos).toHaveLength(1);
    expect(combos[0].products).toHaveLength(2);
    expect(combos[0].normalPrice).toBe(150);
    expect(combos[0].price).toBe(119.9);
    expect(combos[0].savings).toBe(30.1);
  });

  it("should retrieve a combo by slug or id", async () => {
    mockDb.query.combos.findMany.mockResolvedValueOnce([
      {
        id: "combo-target",
        storeId: "store-alpha",
        title: "Combo Alvo",
        slug: "combo-alvo",
        price: "79.90",
        status: "active",
        position: 0,
        products: [
          { position: 0, product: product1 },
          { position: 1, product: product2 },
        ],
      },
    ]);

    const comboBySlug = await ComboService.getActiveComboBySlug(storeId, "combo-alvo");
    expect(comboBySlug).not.toBeNull();
    expect(comboBySlug?.id).toBe("combo-target");

    mockDb.query.combos.findMany.mockResolvedValueOnce([
      {
        id: "combo-target",
        storeId: "store-alpha",
        title: "Combo Alvo",
        slug: "combo-alvo",
        price: "79.90",
        status: "active",
        position: 0,
        products: [
          { position: 0, product: product1 },
          { position: 1, product: product2 },
        ],
      },
    ]);

    const comboById = await ComboService.getActiveComboBySlug(storeId, "combo-target");
    expect(comboById).not.toBeNull();
    expect(comboById?.slug).toBe("combo-alvo");
  });
});
