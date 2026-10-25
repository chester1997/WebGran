import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      query: {
        combos: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        comboProducts: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        products: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        orderItems: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
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

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { 
  getCombosAction, 
  getStoreActiveProductsAction, 
  createComboAction, 
  updateComboAction, 
  toggleComboStatusAction, 
  archiveComboAction, 
  deleteComboAction 
} from "../actions";

describe("Seller Combos Actions Suite (Phase 4 — Etapa 3)", () => {
  const mockSeller = { id: "seller-123", email: "seller@test.com" };
  const mockStore = { id: "store-123", name: "Minha Loja", slug: "minha-loja" };

  const product1 = {
    id: "prod-1",
    storeId: "store-123",
    title: "Produto 1",
    price: "40.00",
    coverUrl: "https://img.test/p1.webp",
    status: "active",
  };

  const product2 = {
    id: "prod-2",
    storeId: "store-123",
    title: "Produto 2",
    price: "60.00",
    coverUrl: "https://img.test/p2.webp",
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSeller).mockResolvedValue(mockSeller as any);
    vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);
  });

  describe("1. Authentication & Multi-Tenant Store Boundaries", () => {
    it("should throw error when seller is not authenticated", async () => {
      vi.mocked(requireSeller).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(getCombosAction()).rejects.toThrow("Unauthorized");
    });

    it("should throw error when store is not found", async () => {
      vi.mocked(getCurrentStore).mockResolvedValueOnce(null as any);
      await expect(getCombosAction()).rejects.toThrow("Loja não encontrada.");
    });
  });

  describe("2. createComboAction", () => {
    it("should successfully create a valid combo with at least 2 active products and price savings", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null); // No slug conflict
      mockDb.query.products.findMany.mockResolvedValueOnce([product1, product2]); // 40 + 60 = 100

      const insertedCombo = {
        id: "combo-1",
        storeId: "store-123",
        title: "Combo Promocional",
        slug: "combo-promocional",
        price: "69.90",
        status: "active",
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([insertedCombo]),
            }),
          }),
        };
        return callback(tx);
      });

      const res = await createComboAction({
        title: "Combo Promocional",
        productIds: ["prod-1", "prod-2"],
        price: 69.90, // Normal is 100 -> valid savings
      });

      expect(res.success).toBe(true);
      expect(res.combo).toEqual(insertedCombo);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should reject combo creation with fewer than 2 products", async () => {
      await expect(
        createComboAction({
          title: "Combo 1",
          productIds: ["prod-1"],
          price: 30.00,
        })
      ).rejects.toThrow("O combo deve conter pelo menos 2 produtos distintos.");
    });

    it("should reject combo creation with duplicate product IDs resulting in fewer than 2 distinct products", async () => {
      await expect(
        createComboAction({
          title: "Combo Duplicado",
          productIds: ["prod-1", "prod-1"],
          price: 30.00,
        })
      ).rejects.toThrow("O combo deve conter pelo menos 2 produtos distintos.");
    });

    it("should reject combo if any product belongs to another store or doesn't exist", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null);
      // DB only returns 1 matching product for store-123 (prod-2 might belong to store-999)
      mockDb.query.products.findMany.mockResolvedValueOnce([product1]);

      await expect(
        createComboAction({
          title: "Combo Cross-Store",
          productIds: ["prod-1", "prod-other-store"],
          price: 50.00,
        })
      ).rejects.toThrow("Um ou mais produtos selecionados não pertencem a esta loja ou não existem.");
    });

    it("should reject combo if any component product is not active", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null);
      const inactiveProduct = { ...product2, status: "draft" };
      mockDb.query.products.findMany.mockResolvedValueOnce([product1, inactiveProduct]);

      await expect(
        createComboAction({
          title: "Combo com Produto Rascunho",
          productIds: ["prod-1", "prod-2"],
          price: 50.00,
        })
      ).rejects.toThrow('O produto "Produto 2" não está ativo.');
    });

    it("should reject combo if promotional price is greater than or equal to sum of individual prices", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null);
      mockDb.query.products.findMany.mockResolvedValueOnce([product1, product2]); // Total: 100.00

      await expect(
        createComboAction({
          title: "Combo Sem Desconto",
          productIds: ["prod-1", "prod-2"],
          price: 120.00, // Greater than 100
        })
      ).rejects.toThrow("deve ser menor que a soma dos produtos individuais (R$ 100.00)");
    });

    it("should reject combo if custom slug is already used in the same store", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({ id: "combo-existing", slug: "meu-slug" });

      await expect(
        createComboAction({
          title: "Novo Combo",
          slug: "meu-slug",
          productIds: ["prod-1", "prod-2"],
          price: 50.00,
        })
      ).rejects.toThrow("Já existe um combo com este slug na sua loja.");
    });
  });

  describe("3. getCombosAction & Pricing Calculations", () => {
    it("should list active/inactive combos with correctly calculated aggregated price and savings", async () => {
      const mockComboFromDb = {
        id: "combo-1",
        storeId: "store-123",
        title: "Combo Duo",
        slug: "combo-duo",
        description: "Dois produtos em um",
        coverUrl: "https://img.test/combo.webp",
        price: "70.00",
        status: "active",
        position: 0,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        products: [
          { position: 0, product: product1 }, // 40
          { position: 1, product: product2 }, // 60 -> Normal = 100
        ],
      };

      mockDb.query.combos.findMany.mockResolvedValueOnce([mockComboFromDb]);

      const result = await getCombosAction();

      expect(result).toHaveLength(1);
      const c = result[0];
      expect(c.normalPrice).toBe(100);
      expect(c.price).toBe("70.00");
      expect(c.savings).toBe(30); // 100 - 70 = 30
      expect(c.savingsPercentage).toBe(30); // 30%
      expect(c.products).toHaveLength(2);
    });
  });

  describe("4. updateComboAction", () => {
    it("should successfully update a combo belonging to the store", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-1",
        storeId: "store-123",
        title: "Combo Antigo",
        slug: "combo-antigo",
        price: "70.00",
      });

      mockDb.query.products.findMany.mockResolvedValueOnce([product1, product2]);

      mockDb.transaction.mockImplementation(async (callback) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(true),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(true),
          }),
        };
        return callback(tx);
      });

      const res = await updateComboAction("combo-1", {
        title: "Combo Atualizado",
        productIds: ["prod-1", "prod-2"],
        price: 75.00,
      });

      expect(res.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should prevent updating a combo belonging to another store", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null); // Not found in store-123

      await expect(
        updateComboAction("combo-other-store", {
          title: "Tentativa Maliciosa",
        })
      ).rejects.toThrow("Combo não encontrado ou não pertence a esta loja.");
    });
  });

  describe("5. toggleComboStatusAction & archiveComboAction", () => {
    it("should toggle combo status between active and inactive", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-1",
        storeId: "store-123",
        status: "active",
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      } as any);

      const res = await toggleComboStatusAction("combo-1");
      expect(res.success).toBe(true);
      expect(res.status).toBe("inactive");
    });

    it("should archive a combo", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-1",
        storeId: "store-123",
        status: "active",
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      } as any);

      const res = await archiveComboAction("combo-1");
      expect(res.success).toBe(true);
    });
  });

  describe("6. deleteComboAction & Financial Order Protection", () => {
    it("should archive instead of deleting if combo is referenced in historical order_items", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-1",
        storeId: "store-123",
      });

      // Simulates existing historical order item for this combo
      mockDb.query.orderItems.findFirst.mockResolvedValueOnce({
        id: "item-1",
        comboId: "combo-1",
        orderId: "order-999",
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      } as any);

      const res = await deleteComboAction("combo-1");

      expect(res.success).toBe(true);
      expect(res.action).toBe("archived");
      expect(res.message).toContain("pedidos registrados e foi arquivado para preservar o histórico financeiro");
      expect(mockDb.transaction).not.toHaveBeenCalled(); // No hard delete
    });

    it("should hard delete combo if it has never been purchased", async () => {
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-unused",
        storeId: "store-123",
      });

      // No orders found
      mockDb.query.orderItems.findFirst.mockResolvedValueOnce(null);

      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(true),
          }),
        };
        return callback(tx);
      });

      const res = await deleteComboAction("combo-unused");

      expect(res.success).toBe(true);
      expect(res.action).toBe("deleted");
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should never allow hard deletion of combo with sales, strictly preserving order_items and frozen combo_snapshot", async () => {
      const comboWithSalesId = "combo-with-sales-100";
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: comboWithSalesId,
        storeId: "store-123",
        title: "Combo Pro VIP",
      });

      // Existing historical order item with frozen snapshot
      const frozenSnapshot = {
        title: "Combo Pro VIP",
        price: "150.00",
        products: [
          { id: "p1", title: "VIP 1", deliveryType: "telegram", deliveryValue: "-1001" },
          { id: "p2", title: "VIP 2", deliveryType: "telegram", deliveryValue: "-1002" },
        ],
      };

      mockDb.query.orderItems.findFirst.mockResolvedValueOnce({
        id: "item-sold-1",
        comboId: comboWithSalesId,
        productId: null,
        comboSnapshot: frozenSnapshot,
        orderId: "order-historical-500",
      });

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(true),
      });
      mockDb.update.mockReturnValueOnce({
        set: updateSetMock,
      } as any);

      const result = await deleteComboAction(comboWithSalesId);

      // Verify action was archived, preserving foreign key and financial records
      expect(result.success).toBe(true);
      expect(result.action).toBe("archived");
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "archived",
        })
      );
      // Hard delete transaction MUST NOT be called
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });
});
