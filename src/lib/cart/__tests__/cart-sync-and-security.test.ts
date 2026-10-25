import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartService } from "@/lib/cart/cart-service";

const mockFindFirstProduct = vi.fn();
const mockFindManyProducts = vi.fn();
const mockFindFirstCustomer = vi.fn();
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

describe("Cart Security, Isolation, and Server-Side Pricing Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({ returning: mockReturning }),
      onConflictDoUpdate: vi.fn().mockReturnValue({ returning: mockReturning }),
      returning: mockReturning,
    });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  describe("Anti-Tampering: Server-Side Price Authority", () => {
    it("should strictly ignore any client-provided price and compute total from database price", async () => {
      // Product in database costs 99.90
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-vip",
        storeId: "store-1",
        status: "active",
        title: "VIP Channel Access",
        slug: "vip-channel",
        price: "99.90",
        coverUrl: "https://example.com/vip.jpg",
      });

      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-buyer-1",
        storeId: "store-1",
        customerId: "buyer-1",
      });

      mockFindFirstCartItem.mockResolvedValueOnce(null);

      // getCart queries items with relations:
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-buyer-1",
        storeId: "store-1",
        customerId: "buyer-1",
      });

      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-1",
          cartId: "cart-buyer-1",
          productId: "prod-vip",
          quantity: 2,
          product: {
            id: "prod-vip",
            storeId: "store-1",
            status: "active",
            title: "VIP Channel Access",
            slug: "vip-channel",
            price: "99.90",
            coverUrl: "https://example.com/vip.jpg",
          },
        },
      ]);

      const cart = await CartService.addItem("store-1", "buyer-1", "prod-vip", 2);

      // Total must be 99.90 * 2 = 199.80, irrespective of any client input
      expect(cart.total).toBe(199.8);
      expect(cart.items[0].price).toBe(99.9);
      expect(cart.items[0].quantity).toBe(2);
    });
  });

  describe("Store and Buyer Boundary Isolation", () => {
    it("should strictly isolate carts between different buyers in the same store", async () => {
      // Buyer 1 Cart
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-buyer-1",
        storeId: "store-alpha",
        customerId: "buyer-1",
      });
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-b1",
          cartId: "cart-buyer-1",
          productId: "prod-alpha",
          quantity: 1,
          product: {
            id: "prod-alpha",
            storeId: "store-alpha",
            status: "active",
            title: "Alpha Prod",
            slug: "alpha",
            price: "25.00",
          },
        },
      ]);

      const cartBuyer1 = await CartService.getCart("store-alpha", "buyer-1");
      expect(cartBuyer1.customerId).toBe("buyer-1");
      expect(cartBuyer1.items).toHaveLength(1);
      expect(cartBuyer1.total).toBe(25);

      // Buyer 2 Cart
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-buyer-2",
        storeId: "store-alpha",
        customerId: "buyer-2",
      });
      mockFindManyCartItems.mockResolvedValueOnce([]);

      const cartBuyer2 = await CartService.getCart("store-alpha", "buyer-2");
      expect(cartBuyer2.customerId).toBe("buyer-2");
      expect(cartBuyer2.items).toHaveLength(0);
      expect(cartBuyer2.total).toBe(0);
    });

    it("should strictly isolate carts for the same buyer across different stores", async () => {
      // Buyer 1 in Store A
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-store-a",
        storeId: "store-a",
        customerId: "buyer-1",
      });
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-a",
          cartId: "cart-store-a",
          productId: "prod-a",
          quantity: 1,
          product: {
            id: "prod-a",
            storeId: "store-a",
            status: "active",
            title: "Store A Product",
            slug: "prod-a",
            price: "10.00",
          },
        },
      ]);

      const cartStoreA = await CartService.getCart("store-a", "buyer-1");
      expect(cartStoreA.storeId).toBe("store-a");
      expect(cartStoreA.items[0].title).toBe("Store A Product");

      // Buyer 1 in Store B
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-store-b",
        storeId: "store-b",
        customerId: "buyer-1",
      });
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-b",
          cartId: "cart-store-b",
          productId: "prod-b",
          quantity: 4,
          product: {
            id: "prod-b",
            storeId: "store-b",
            status: "active",
            title: "Store B Product",
            slug: "prod-b",
            price: "30.00",
          },
        },
      ]);

      const cartStoreB = await CartService.getCart("store-b", "buyer-1");
      expect(cartStoreB.storeId).toBe("store-b");
      expect(cartStoreB.items[0].title).toBe("Store B Product");
      expect(cartStoreB.total).toBe(120);
    });
  });

  describe("Automatic Cleanup of Inactive or Deleted Products", () => {
    it("should silently purge orphaned or deactivated product items when fetching cart", async () => {
      mockFindFirstCart.mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-1",
        customerId: "cust-1",
      });

      // Cart has 2 items in database, but prod-deleted is missing/inactive
      mockFindManyCartItems.mockResolvedValueOnce([
        {
          id: "item-active",
          cartId: "cart-1",
          productId: "prod-active",
          quantity: 1,
          product: {
            id: "prod-active",
            storeId: "store-1",
            status: "active",
            title: "Active Item",
            slug: "active",
            price: "40.00",
          },
        },
        {
          id: "item-orphan",
          cartId: "cart-1",
          productId: "prod-deleted",
          quantity: 1,
          product: null, // Product was deleted or belongs to other store
        },
      ]);

      const cart = await CartService.getCart("store-1", "cust-1");

      // Only the active item should be returned to buyer
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].id).toBe("prod-active");
      expect(cart.total).toBe(40);
      expect(mockDelete).toHaveBeenCalled(); // Triggered cleanup
    });
  });
});
