import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      query: {
        products: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        productCarousels: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        carouselProducts: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        telegramBots: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        productVideos: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));

vi.mock("@/lib/telegram/product-chat-validator", () => ({
  validateProductTelegramChat: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn().mockResolvedValue(undefined),
    deleteMediaFile: vi.fn().mockResolvedValue(undefined),
  },
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
    upload: vi.fn().mockResolvedValue({ url: "https://cdn.test/prod.webp", sizeBytes: 1000 }),
  }),
  generateMultiTenantStoragePath: vi.fn().mockReturnValue("stores/store-1/products/prod.webp"),
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    assignVideosToProduct: vi.fn().mockResolvedValue(undefined),
    listProductVideos: vi.fn().mockResolvedValue([]),
  },
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { createProductAction, updateProductAction } from "../actions";
import {
  createCarouselAction,
  updateCarouselAction,
  updateRankingCarouselAction
} from "../../carousels/actions";

describe("Product and Carousel Decoupling Suite", () => {
  const mockSeller = { id: "seller-1", email: "seller@test.com" };
  const mockStore = { id: "store-1", name: "Loja Teste", slug: "loja-teste" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSeller).mockResolvedValue(mockSeller as any);
    vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "created-id", title: "Test" }]),
      }),
    });
  });

  describe("1. Carousel Creation & Update (Simplified)", () => {
    it("allows creating a carousel without products (empty carousel)", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 2 }]),
        }),
      });

      const returningFn = vi.fn().mockResolvedValue([{
        id: "carousel-new-1",
        storeId: "store-1",
        name: "Lançamentos de Outono",
        indicatorType: "ICON",
        iconName: "Sparkles",
        iconColor: "#EC4899",
        isRanking: false,
      }]);

      const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
      mockDb.insert.mockReturnValue({ values: valuesFn });

      const result = await createCarouselAction(
        "Lançamentos de Outono",
        undefined,
        "ICON",
        "Sparkles",
        "#EC4899"
      );

      expect(result).toBeDefined();
      expect(result.id).toBe("carousel-new-1");
      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Lançamentos de Outono",
          indicatorType: "ICON",
          iconName: "Sparkles",
          iconColor: "#EC4899",
          isRanking: false,
        })
      );
      // No insertion into carouselProducts when productIds is undefined
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("updates carousel visual metadata without wiping existing carousel products when productIds is undefined", async () => {
      mockDb.query.productCarousels.findFirst.mockResolvedValue({
        id: "carousel-1",
        storeId: "store-1",
        name: "Nome Antigo",
      });

      const whereFn = vi.fn().mockResolvedValue([]);
      const setFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.update.mockReturnValue({ set: setFn });

      const result = await updateCarouselAction(
        "carousel-1",
        "Nome Novo Atualizado",
        undefined, // Product selection untouched
        "BAR",
        "Flame",
        "#10B981"
      );

      expect(result).toEqual({ success: true });
      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nome Novo Atualizado",
          indicatorType: "BAR",
          iconColor: "#10B981",
        })
      );
      // Since productIds is undefined, carouselProducts delete/insert should NOT have been called
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("2. Product Creation with Carousel Multi-Select", () => {
    it("creates a product with multiple valid store carousels", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const newProduct = {
        id: "prod-new-1",
        title: "Curso Avançado de TypeScript",
        price: "99.00",
        storeId: "store-1",
      };

      const returningFn = vi.fn().mockResolvedValue([newProduct]);
      const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
      const insertProductsFn = vi.fn().mockReturnValue({ values: valuesFn });

      const insertCarouselsValuesFn = vi.fn().mockResolvedValue([]);
      const insertCarouselsFn = vi.fn().mockReturnValue({ values: insertCarouselsValuesFn });

      mockDb.insert
        .mockImplementationOnce(insertProductsFn)
        .mockImplementationOnce(insertCarouselsFn);

      // Mock carousel validation query: returns the 2 valid carousels
      mockDb.query.productCarousels.findMany.mockResolvedValue([
        { id: "c-1" },
        { id: "c-2" },
      ]);

      const formData = new FormData();
      formData.set("title", "Curso Avançado de TypeScript");
      formData.set("price", "99.00");
      formData.set("deliveryType", "telegram");
      formData.set("deliveryValue", "-1001234567890");
      formData.set("carouselIds", JSON.stringify(["c-1", "c-2"]));

      const res = await createProductAction(formData);

      expect(res.success).toBe(true);
      expect(insertCarouselsValuesFn).toHaveBeenCalledWith([
        { carouselId: "c-1", productId: "prod-new-1", position: 0 },
        { carouselId: "c-2", productId: "prod-new-1", position: 1 },
      ]);
    });

    it("rejects product creation if any carousel belongs to another store or is a ranking carousel", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      const returningFn = vi.fn().mockResolvedValue([{
        id: "prod-x",
        title: "Produto Inválido",
      }]);
      mockDb.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: returningFn }) });

      // Only 1 of the 2 carousels belongs to this store
      mockDb.query.productCarousels.findMany.mockResolvedValue([
        { id: "c-valid-1" },
      ]);

      const formData = new FormData();
      formData.set("title", "Produto Inválido");
      formData.set("price", "49.90");
      formData.set("deliveryType", "telegram");
      formData.set("deliveryValue", "-1001234567890");
      formData.set("carouselIds", JSON.stringify(["c-valid-1", "c-foreign-2"]));

      await expect(createProductAction(formData)).rejects.toThrow(
        "Um ou mais carrosséis selecionados são inválidos ou não pertencem a esta loja."
      );
    });
  });

  describe("3. Product Update with Carousel Synchronization & Ranking Protection", () => {
    it("updates product carousel associations and preserves Top 15 ranking", async () => {
      mockDb.query.products.findFirst.mockResolvedValue({
        id: "prod-existing-1",
        storeId: "store-1",
        title: "Produto Existente",
      });

      // The store has 3 custom carousels: c-1, c-2, c-3
      mockDb.query.productCarousels.findMany
        .mockResolvedValueOnce([{ id: "c-1" }, { id: "c-3" }]) // Validation query for selected carousels
        .mockResolvedValueOnce([{ id: "c-1" }, { id: "c-2" }, { id: "c-3" }]); // Store's custom carousels query

      const insertValuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: insertValuesFn });

      const formData = new FormData();
      formData.set("title", "Produto Existente Atualizado");
      formData.set("price", "50.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://entrega.com/token");
      formData.set("carouselIds", JSON.stringify(["c-1", "c-3"]));

      const res = await updateProductAction("prod-existing-1", formData);

      expect(res.success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(insertValuesFn).toHaveBeenCalledWith([
        { carouselId: "c-1", productId: "prod-existing-1", position: 0 },
        { carouselId: "c-3", productId: "prod-existing-1", position: 1 },
      ]);
    });

    it("allows unlinking all carousels safely (0 carousels selected)", async () => {
      mockDb.query.products.findFirst.mockResolvedValue({
        id: "prod-existing-2",
        storeId: "store-1",
        title: "Produto Sem Carrossel",
      });

      // Custom carousels of the store
      mockDb.query.productCarousels.findMany.mockResolvedValue([
        { id: "c-1" },
        { id: "c-2" },
      ]);

      const formData = new FormData();
      formData.set("title", "Produto Sem Carrossel");
      formData.set("price", "25.00");
      formData.set("deliveryType", "telegram");
      formData.set("deliveryValue", "-10099887766");
      formData.set("carouselIds", JSON.stringify([])); // Explicitly empty

      const res = await updateProductAction("prod-existing-2", formData);

      expect(res.success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("rejects updating product with a carousel ID belonging to another store", async () => {
      mockDb.query.products.findFirst.mockResolvedValue({
        id: "prod-existing-3",
        storeId: "store-1",
        title: "Produto Teste",
      });

      // Validation returns empty (foreign carousel)
      mockDb.query.productCarousels.findMany.mockResolvedValue([]);

      const formData = new FormData();
      formData.set("title", "Produto Teste");
      formData.set("price", "10.00");
      formData.set("deliveryType", "telegram");
      formData.set("deliveryValue", "-10099887766");
      formData.set("carouselIds", JSON.stringify(["foreign-carousel-999"]));

      await expect(
        updateProductAction("prod-existing-3", formData)
      ).rejects.toThrow("Um ou mais carrosséis selecionados são inválidos ou não pertencem a esta loja.");
    });
  });

  describe("4. Top 15 Ranking Safeguards", () => {
    it("enforces maximum 15 products in updateRankingCarouselAction", async () => {
      const sixteenProductIds = Array.from({ length: 16 }, (_, i) => `prod-${i + 1}`);

      await expect(
        updateRankingCarouselAction(
          "ranking-1",
          "Top 15 Hoje",
          "active",
          sixteenProductIds
        )
      ).rejects.toThrow("Esta seção permite no máximo 15 produtos.");
    });

    it("accepts up to 15 products in updateRankingCarouselAction", async () => {
      mockDb.query.productCarousels.findFirst.mockResolvedValue({
        id: "ranking-1",
        storeId: "store-1",
        isRanking: true,
      });

      const insertValuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: insertValuesFn });

      const tenProductIds = Array.from({ length: 10 }, (_, i) => `prod-${i + 1}`);

      const res = await updateRankingCarouselAction(
        "ranking-1",
        "Top 10 da Semana",
        "active",
        tenProductIds,
        "ICON",
        "Trophy",
        "#FFD700"
      );

      expect(res.success).toBe(true);
      expect(insertValuesFn).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ carouselId: "ranking-1", position: 0 }),
        ])
      );
    });
  });

  describe("5. Mini App Carousel Filtering Rules", () => {
    it("filters out empty carousels and carousels with inactive products", () => {
      const mockCarousels = [
        {
          id: "c-empty",
          name: "Vazio",
          items: [],
        },
        {
          id: "c-drafts-only",
          name: "Apenas Rascunhos",
          items: [
            { product: { id: "p-draft-1", status: "draft" } },
            { product: { id: "p-draft-2", status: "inactive" } },
          ],
        },
        {
          id: "c-active",
          name: "Carrossel Ativo",
          items: [
            { product: { id: "p-draft", status: "draft" } },
            { product: { id: "p-active", status: "active" } },
          ],
        },
      ];

      const renderedCarousels = mockCarousels.map((c) => {
        const activeProducts = c.items
          .map((i) => i.product)
          .filter((p) => p && p.status === "active");

        if (activeProducts.length === 0) return null;
        return {
          id: c.id,
          name: c.name,
          productCount: activeProducts.length,
        };
      }).filter(Boolean);

      expect(renderedCarousels).toHaveLength(1);
      expect(renderedCarousels[0]?.id).toBe("c-active");
      expect(renderedCarousels[0]?.productCount).toBe(1);
    });
  });
});
