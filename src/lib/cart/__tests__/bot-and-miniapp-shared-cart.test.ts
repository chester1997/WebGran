import { describe, it, expect, vi, beforeEach } from "vitest";
import { CartService } from "@/lib/cart/cart-service";
import { GET } from "@/app/api/miniapp/cart/route";
import { NextRequest } from "next/server";

// In-memory persistent database simulator for testing shared bot + miniapp cart state
interface DbCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
}

interface DbCart {
  id: string;
  storeId: string;
  customerId: string;
}

interface DbCustomer {
  id: string;
  storeId: string;
  telegramUserId: string;
  firstName: string;
}

interface DbProduct {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  price: string;
  status: string;
  coverUrl: string | null;
}

let simulatedCarts: DbCart[] = [];
let simulatedCartItems: DbCartItem[] = [];
let simulatedCustomers: DbCustomer[] = [];
let simulatedProducts: DbProduct[] = [];

vi.mock("@/lib/telegram/session", () => ({
  getMiniAppSession: vi.fn(),
  resolveMiniAppCustomerSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      stores: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve({
            id: "store-shared-id",
            slug: "loja-compartilhada",
          });
        }),
      },
      products: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          // Find active product
          return Promise.resolve(simulatedProducts.find((p) => p.status === "active") || null);
        }),
        findMany: vi.fn().mockImplementation(() => {
          return Promise.resolve(simulatedProducts.filter((p) => p.status === "active"));
        }),
      },
      telegramCustomers: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(simulatedCustomers[0] || null);
        }),
      },
      carts: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(simulatedCarts[0] || null);
        }),
      },
      cartItems: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(simulatedCartItems[0] || null);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(
            simulatedCartItems.map((item) => {
              const product = simulatedProducts.find((p) => p.id === item.productId);
              return {
                ...item,
                product: product || null,
              };
            })
          );
        }),
      },
    },
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val: any) => ({
        onConflictDoNothing: vi.fn().mockImplementation(() => {
          if (!simulatedCarts.some((c) => c.storeId === val.storeId && c.customerId === val.customerId)) {
            simulatedCarts.push({ id: "cart-shared-uuid", ...val });
          }
          return { returning: vi.fn().mockResolvedValue(simulatedCarts) };
        }),
        onConflictDoUpdate: vi.fn().mockImplementation(() => {
          const existing = simulatedCartItems.find((i) => i.cartId === val.cartId && i.productId === val.productId);
          if (existing) {
            existing.quantity = val.quantity;
          } else {
            simulatedCartItems.push({ id: `item-${Date.now()}`, ...val });
          }
          return { returning: vi.fn().mockResolvedValue(simulatedCartItems) };
        }),
        returning: vi.fn().mockResolvedValue([val]),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(() => {
          if (updates.quantity !== undefined && simulatedCartItems[0]) {
            simulatedCartItems[0].quantity = updates.quantity;
          }
          return Promise.resolve();
        }),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        simulatedCartItems = [];
        return Promise.resolve();
      }),
    })),
  },
}));

describe("Bot and Mini App Shared Cart End-to-End Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulatedCarts = [{ id: "cart-shared-uuid", storeId: "store-shared-id", customerId: "customer-luiz-uuid" }];
    simulatedCustomers = [
      {
        id: "customer-luiz-uuid",
        storeId: "store-shared-id",
        telegramUserId: "11223344",
        firstName: "Luiz",
      },
    ];
    simulatedProducts = [
      {
        id: "prod-cursinho",
        storeId: "store-shared-id",
        title: "Curso Fullstack",
        slug: "curso-fullstack",
        price: "49.90",
        status: "active",
        coverUrl: "https://webgran.test/cover.jpg",
      },
    ];
    simulatedCartItems = [];
  });

  it("should reflect items added in Telegram Bot when queried by Mini App API", async () => {
    // 1. Buyer sends /carrinho or clicks "➕ Adicionar ao Carrinho" in the Telegram bot
    const botCart = await CartService.addItemByTelegramUser(
      "store-shared-id",
      11223344, // Telegram User ID
      "prod-cursinho",
      2 // 2 units
    );

    expect(botCart.items).toHaveLength(1);
    expect(botCart.items[0].quantity).toBe(2);
    expect(botCart.subtotal).toBe(99.8);

    // 2. Buyer opens the Mini App with authenticated tg_session
    const { getMiniAppSession } = await import("@/lib/telegram/session");
    vi.mocked(getMiniAppSession).mockResolvedValueOnce({
      customerId: "customer-luiz-uuid",
      storeId: "store-shared-id",
      telegramId: "11223344",
    });

    const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=loja-compartilhada");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.cart.items).toHaveLength(1);
    expect(data.cart.items[0].id).toBe("prod-cursinho");
    expect(data.cart.items[0].quantity).toBe(2);
    expect(data.cart.total).toBe(99.8);
  });

  it("should reflect item removal in Bot when reloaded in Mini App without restoring from old cache", async () => {
    // Populate cart with 1 item
    simulatedCartItems = [
      {
        id: "item-1",
        cartId: "cart-shared-uuid",
        productId: "prod-cursinho",
        quantity: 1,
      },
    ];

    // Buyer removes item in Bot (e.g. clicked 🗑️ in Telegram)
    const botCart = await CartService.removeItemByTelegramUser(
      "store-shared-id",
      11223344,
      "prod-cursinho"
    );
    expect(botCart.items).toHaveLength(0);

    // Mini App queries server cart
    const { getMiniAppSession } = await import("@/lib/telegram/session");
    vi.mocked(getMiniAppSession).mockResolvedValueOnce({
      customerId: "customer-luiz-uuid",
      storeId: "store-shared-id",
      telegramId: "11223344",
    });

    const req = new NextRequest("http://localhost:3000/api/miniapp/cart?storeSlug=loja-compartilhada");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    // Server cart is empty; items are NOT restored!
    expect(data.cart.items).toHaveLength(0);
    expect(data.cart.total).toBe(0);
  });
});
