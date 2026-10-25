import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/miniapp/cart/route";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetMiniAppSession = vi.fn();
const mockResolveMiniAppCustomerSession = vi.fn();
const mockGetCart = vi.fn();
const mockAddItem = vi.fn();
const mockUpdateItemQuantity = vi.fn();
const mockRemoveItem = vi.fn();
const mockClearCart = vi.fn();
const mockSyncLocalItems = vi.fn();

vi.mock("@/lib/telegram/session", () => ({
  getMiniAppSession: () => mockGetMiniAppSession(),
  resolveMiniAppCustomerSession: (...args: any[]) => mockResolveMiniAppCustomerSession(...args),
}));

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCart: (...args: any[]) => mockGetCart(...args),
    addItem: (...args: any[]) => mockAddItem(...args),
    updateItemQuantity: (...args: any[]) => mockUpdateItemQuantity(...args),
    removeItem: (...args: any[]) => mockRemoveItem(...args),
    clearCart: (...args: any[]) => mockClearCart(...args),
    syncLocalItems: (...args: any[]) => mockSyncLocalItems(...args),
  },
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      stores: {
        findFirst: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            id: "store-real-id",
            slug: "minhaloja",
          });
        }),
      },
    },
  },
}));

describe("Cart API Route (/api/miniapp/cart)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication and Authorization", () => {
    it("should return 401 for GET when neither session nor valid initData exists", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce(null);
      mockResolveMiniAppCustomerSession.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Não autenticado");
    });

    it("should return 401 for POST when caller is unauthenticated", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce(null);
      mockResolveMiniAppCustomerSession.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja", {
        method: "POST",
        body: JSON.stringify({ action: "add", productId: "prod-1", quantity: 1 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Não autenticado");
    });

    it("should return 403 Forbidden when storeSlug in URL does not match session store", async () => {
      // Session belongs to store-other, but URL requested minhaloja (which resolves to store-real-id)
      mockGetMiniAppSession.mockResolvedValueOnce({
        customerId: "cust-1",
        storeId: "store-other-id",
        telegramId: "12345",
      });

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja");
      const res = await GET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Acesso negado");
    });
  });

  describe("Cart Actions (POST)", () => {
    it("should reject invalid or unknown action with 400", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce({
        customerId: "cust-1",
        storeId: "store-real-id",
        telegramId: "12345",
      });

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja", {
        method: "POST",
        body: JSON.stringify({ action: "unknown_hack" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("unknown_hack");
    });

    it("should successfully execute 'add' action with verified session identity", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce({
        customerId: "cust-1",
        storeId: "store-real-id",
        telegramId: "12345",
      });

      mockAddItem.mockResolvedValueOnce({
        id: "cart-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 2,
            price: 50,
          },
        ],
        subtotal: 100,
        total: 100,
        itemCount: 2,
      });

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja", {
        method: "POST",
        body: JSON.stringify({ action: "add", productId: "prod-1", quantity: 2 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockAddItem).toHaveBeenCalledWith(
        "store-real-id",
        "cust-1",
        "prod-1",
        2
      );

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.cart.items).toHaveLength(1);
    });

    it("should successfully execute 'remove' action", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce({
        customerId: "cust-1",
        storeId: "store-real-id",
        telegramId: "12345",
      });

      mockRemoveItem.mockResolvedValueOnce({
        id: "cart-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja", {
        method: "POST",
        body: JSON.stringify({ action: "remove", productId: "prod-1" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockRemoveItem).toHaveBeenCalledWith(
        "store-real-id",
        "cust-1",
        "prod-1"
      );
    });

    it("should return 400 when CartService throws a validation error", async () => {
      mockGetMiniAppSession.mockResolvedValueOnce({
        customerId: "cust-1",
        storeId: "store-real-id",
        telegramId: "12345",
      });

      mockAddItem.mockRejectedValueOnce(new Error("Produto não está disponível para compra."));

      const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=minhaloja", {
        method: "POST",
        body: JSON.stringify({ action: "add", productId: "prod-1", quantity: 1 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Produto não está disponível para compra.");
    });
  });
});
