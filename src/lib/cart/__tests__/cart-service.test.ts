import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartService } from "@/lib/cart/cart-service";

// Mock DB
const mockFindFirstProduct = vi.fn();
const mockFindManyProducts = vi.fn();
const mockFindFirstCustomer = vi.fn();
const mockFindFirstBot = vi.fn();
const mockFindFirstCart = vi.fn();
const mockFindManyCartItems = vi.fn();
const mockFindFirstCartItem = vi.fn();

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      products: {
        findFirst: (...args: any[]) => mockFindFirstProduct(...args),
        findMany: (...args: any[]) => mockFindManyProducts(...args),
      },
      telegramCustomers: {
        findFirst: (...args: any[]) => mockFindFirstCustomer(...args),
      },
      telegramBots: {
        findFirst: (...args: any[]) => mockFindFirstBot(...args),
      },
      carts: {
        findFirst: (...args: any[]) => mockFindFirstCart(...args),
      },
      cartItems: {
        findFirst: (...args: any[]) => mockFindFirstCartItem(...args),
        findMany: (...args: any[]) => mockFindManyCartItems(...args),
      },
    },
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

describe("CartService - Quantities, Persistence, and Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock update chaining: .update().set().where()
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    // Default mock delete chaining: .delete().where()
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    // Default mock insert chaining: .insert().values().onConflictDoNothing().returning()
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      onConflictDoUpdate: mockOnConflictDoUpdate,
      returning: mockReturning,
    });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  describe("Quantity Sanitization", () => {
    it("should accept valid positive integers within bounds", () => {
      expect(CartService.sanitizeQuantity(1)).toBe(1);
      expect(CartService.sanitizeQuantity(5)).toBe(5);
      expect(CartService.sanitizeQuantity(999)).toBe(999);
      expect(CartService.sanitizeQuantity("3")).toBe(3);
    });

    it("should reject zero and negative quantities", () => {
      expect(() => CartService.sanitizeQuantity(0)).toThrow();
      expect(() => CartService.sanitizeQuantity(-1)).toThrow();
      expect(() => CartService.sanitizeQuantity(-99)).toThrow();
    });

    it("should reject fractional/decimal quantities", () => {
      expect(() => CartService.sanitizeQuantity(1.5)).toThrow();
      expect(() => CartService.sanitizeQuantity(0.99)).toThrow();
      expect(() => CartService.sanitizeQuantity(2.0001)).toThrow();
    });

    it("should reject excessively large quantities (> 999)", () => {
      expect(() => CartService.sanitizeQuantity(1000)).toThrow();
      expect(() => CartService.sanitizeQuantity(50000)).toThrow();
    });

    it("should reject NaN, null, undefined, strings that are not integers", () => {
      expect(() => CartService.sanitizeQuantity(NaN)).toThrow();
      expect(() => CartService.sanitizeQuantity(null as any)).toThrow();
      expect(() => CartService.sanitizeQuantity(undefined as any)).toThrow();
      expect(() => CartService.sanitizeQuantity("abc")).toThrow();
      expect(() => CartService.sanitizeQuantity("1.5")).toThrow();
    });
  });

  describe("Product Validation and Store Isolation", () => {
    it("should reject product that does not exist or belongs to another store", async () => {
      mockFindFirstProduct.mockResolvedValueOnce(null);

      await expect(
        CartService.addItem("store-1", "cust-1", "prod-unknown", 1)
      ).rejects.toThrow("Produto não encontrado, inativo ou pertencente a outra loja.");
    });

    it("should reject product that is inactive", async () => {
      mockFindFirstProduct.mockResolvedValueOnce(null);

      await expect(
        CartService.addItem("store-1", "cust-1", "prod-inactive", 1)
      ).rejects.toThrow("Produto não encontrado, inativo ou pertencente a outra loja.");
    });

    it("should reject adding item with invalid quantity", async () => {
      await expect(
        CartService.addItem("store-1", "cust-1", "prod-1", -2)
      ).rejects.toThrow("Quantidade inválida");
    });

    it("should reject requests without storeId or customerId", async () => {
      await expect(
        CartService.getOrCreateCartRecord("", "cust-1")
      ).rejects.toThrow("storeId e customerId são obrigatórios");

      await expect(
        CartService.getOrCreateCartRecord("store-1", "")
      ).rejects.toThrow("storeId e customerId são obrigatórios");
    });
  });

  describe("Cart Persistence, Upsert & Isolation", () => {
    it("should ensure atomic cart creation and not duplicate cart per (store, customer)", async () => {
      mockFindFirstCart.mockResolvedValueOnce(null);

      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: "cart-created",
          storeId: "store-1",
          customerId: "cust-1",
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });
      mockInsert.mockReturnValue({ values: mockValues });

      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-created",
        storeId: "store-1",
        customerId: "cust-1",
      });

      const cart = await CartService.getOrCreateCartRecord("store-1", "cust-1");
      expect(cart.id).toBe("cart-created");
      expect(cart.storeId).toBe("store-1");
      expect(cart.customerId).toBe("cust-1");
    });

    it("should add a new product atomically without duplicates", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-1",
        storeId: "store-1",
        status: "active",
        title: "Pack VIP",
        slug: "pack-vip",
        price: "50.00",
      });

      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      mockFindFirstCartItem.mockResolvedValueOnce(null); // Not already in cart

      // For getCart call at the end of addItem:
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-1",
          cartId: "cart-1",
          productId: "prod-1",
          quantity: 2,
          product: {
            id: "prod-1",
            storeId: "store-1",
            status: "active",
            title: "Pack VIP",
            slug: "pack-vip",
            price: "50.00",
            coverUrl: "https://example.com/cover.png",
          },
        },
      ]);

      const cart = await CartService.addItem("store-1", "cust-1", "prod-1", 2);

      expect(mockInsert).toHaveBeenCalled();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.items[0].price).toBe(50);
      expect(cart.total).toBe(100);
    });

    it("should remove item from cart", async () => {
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });
      mockFindManyCartItems.mockResolvedValueOnce([]);

      const result = await CartService.removeItem("store-1", "cust-1", "prod-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should clear cart entirely", async () => {
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      const result = await CartService.clearCart("store-1", "cust-1");
      expect(mockDelete).toHaveBeenCalled();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Idempotent Local Items Sync", () => {
    it("should sync and merge local items idempotently", async () => {
      // 1. Initial getCart inside syncLocalItems
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      // Products verification
      mockFindManyProducts.mockResolvedValueOnce([
        {
          id: "prod-1",
          storeId: "store-1",
          status: "active",
          title: "Prod 1",
          slug: "prod-1",
          price: "10.00",
          coverUrl: null,
        },
        {
          id: "prod-2",
          storeId: "store-1",
          status: "active",
          title: "Prod 2",
          slug: "prod-2",
          price: "20.00",
          coverUrl: null,
        },
      ]);

      // Existing items in database
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-1",
          cartId: "cart-1",
          productId: "prod-1",
          quantity: 2,
        },
      ]);

      // Final getCart after sync:
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-1",
          cartId: "cart-1",
          productId: "prod-1",
          quantity: 3, // max(2, 3)
          product: {
            id: "prod-1",
            storeId: "store-1",
            status: "active",
            title: "Prod 1",
            slug: "prod-1",
            price: "10.00",
            coverUrl: null,
          },
        },
        {
          id: "item-2",
          cartId: "cart-1",
          productId: "prod-2",
          quantity: 1,
          product: {
            id: "prod-2",
            storeId: "store-1",
            status: "active",
            title: "Prod 2",
            slug: "prod-2",
            price: "20.00",
            coverUrl: null,
          },
        },
      ]);

      const mergedCart = await CartService.syncLocalItems("store-1", "cust-1", [
        { productId: "prod-1", quantity: 3 },
        { productId: "prod-2", quantity: 1 },
        { productId: "prod-invalid", quantity: 0 }, // Should be ignored
      ]);

      expect(mergedCart.items).toHaveLength(2);
      expect(mergedCart.items[0].quantity).toBe(3);
      expect(mergedCart.items[1].quantity).toBe(1);
    });
  });

  describe("Telegram Bot Preparation & Identity Association", () => {
    it("should associate verified Telegram user to customer record in the store", async () => {
      mockFindFirstCustomer.mockResolvedValueOnce(null);

      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: "cust-created-from-bot",
          telegramUserId: "123456789",
          storeId: "store-1",
          username: "testuser",
        },
      ]);
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      const customer = await CartService.getOrCreateCustomerForTelegramUser("store-1", {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "Buyer",
      });

      expect(customer.id).toBe("cust-created-from-bot");
      expect(customer.telegramUserId).toBe("123456789");
    });
  });
});
