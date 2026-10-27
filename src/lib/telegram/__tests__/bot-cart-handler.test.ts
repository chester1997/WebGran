import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCartMessage,
  formatCatalogMessage,
  handleCartCommand,
  handleCatalogCommand,
  handleCartCallbackQuery,
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { isDuplicateTelegramUpdate, clearProcessedTelegramUpdatesForTest } from "../update-dedup";

// Mock DB
const mockFindManyProducts = vi.fn();
const mockFindFirstProduct = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      products: {
        findMany: (...args: any[]) => mockFindManyProducts(...args),
        findFirst: (...args: any[]) => mockFindFirstProduct(...args),
      },
    },
  },
}));

// Mock CartService
vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCartByTelegramUser: vi.fn(),
    addItemByTelegramUser: vi.fn(),
    updateQuantityByTelegramUser: vi.fn(),
    removeItemByTelegramUser: vi.fn(),
    clearCartByTelegramUser: vi.fn(),
  },
}));

describe("Bot Cart Handler Suite (Phase 3)", () => {
  const mockSendMessage = vi.fn();
  const mockEditMessageText = vi.fn();
  const mockAnswerCallbackQuery = vi.fn();

  const mockBotService: any = {
    sendMessage: mockSendMessage,
    editMessageText: mockEditMessageText,
    answerCallbackQuery: mockAnswerCallbackQuery,
  };

  const defaultContext = {
    store: {
      id: "store-alpha-id",
      name: "Loja Alpha",
      slug: "loja-alpha",
    },
    botService: mockBotService,
    miniAppUrl: "https://webgran.test/miniapp/loja-alpha",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedTelegramUpdatesForTest();
    mockFindFirstProduct.mockResolvedValue({
      id: "prod-1",
      storeId: "store-alpha-id",
      status: "active",
      title: "Guia Completo",
      price: "19.90",
    });
  });

  describe("Update Deduplication", () => {
    it("should process new update_id and reject duplicate update_id within the window", () => {
      const updateId = 987654321;
      expect(isDuplicateTelegramUpdate(updateId)).toBe(false);
      expect(isDuplicateTelegramUpdate(updateId)).toBe(true);
      expect(isDuplicateTelegramUpdate(updateId)).toBe(true);
    });

    it("should ignore null or non-number update_id without deduplication blocking", () => {
      expect(isDuplicateTelegramUpdate(null)).toBe(false);
      expect(isDuplicateTelegramUpdate(undefined)).toBe(false);
      expect(isDuplicateTelegramUpdate(null)).toBe(false);
    });
  });

  describe("Cart Formatting & Visuals", () => {
    it("should format empty cart with clear message and Mini App action button", () => {
      const emptyCart = {
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      };

      const result = formatCartMessage(emptyCart, "https://webgran.test/miniapp/loja-alpha");
      expect(result.text).toContain("Seu Carrinho está vazio!");
      expect(result.replyMarkup.inline_keyboard[0][0].text).toContain("Ver Catálogo no Mini App");
      expect(result.replyMarkup.inline_keyboard[0][0].web_app.url).toBe("https://webgran.test/miniapp/loja-alpha");
    });

    it("should format cart with items, unit price, line totals, subtotal and inline quantity controls", () => {
      const cart = {
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack-vip",
            title: "Pack VIP Exclusivo",
            price: 29.9,
            quantity: 2,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 59.8,
        total: 59.8,
        itemCount: 2,
      };

      const result = formatCartMessage(cart, "https://webgran.test/miniapp/loja-alpha");
      expect(result.text).toContain("Seu Carrinho de Compras");
      expect(result.text).toContain("2x");
      expect(result.text).toContain("Pack VIP Exclusivo");
      expect(result.text).toContain("R$ 59,80");
      expect(result.text).toContain("Subtotal:* R$ 59,80");
      expect(result.text).toContain("Total de Itens:* 2");

      // Verify inline buttons: simplified 2-column layout without ➖ and ➕
      const buttons = result.replyMarkup.inline_keyboard;
      // Item row: [ 1. 2x Pack VIP Exclusivo ] [ 🗑️ Remover ]
      expect(buttons[0][0].text).toContain("2x");
      expect(buttons[0][0].callback_data).toBe("cart_noop");
      expect(buttons[0][1].text).toContain("Remover");
      expect(buttons[0][1].callback_data).toBe("cart_rem:prod-1");
      // Open Mini App button
      expect(buttons[1][0].web_app.url).toBe("https://webgran.test/miniapp/loja-alpha/cart");
      // Preserves Ver Ofertas and Ver Combos
      expect(buttons[2][0].callback_data).toBe("prog_view");
      expect(buttons[2][1].callback_data).toBe("combo_list");
    });
  });

  describe("/carrinho Command Handler", () => {
    it("should query cart for the verified buyer and send formatted response", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      await handleCartCommand(defaultContext, 123456, {
        id: 999888,
        first_name: "Luiz",
        username: "luiz_dev",
      });

      expect(CartService.getCartByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 999888);
      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining("Seu Carrinho está vazio!"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("should gracefully handle errors when querying cart", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockRejectedValueOnce(new Error("DB failure"));

      await handleCartCommand(defaultContext, 123456, { id: 999888 });

      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining("Ocorreu um erro ao carregar seu carrinho")
      );
    });
  });

  describe("Catalog Listing and Chat Products (/produtos)", () => {
    it("should display active store products with 'Adicionar' callback buttons", async () => {
      mockFindManyProducts.mockResolvedValueOnce([
        {
          id: "prod-1",
          storeId: "store-alpha-id",
          title: "Guia Completo",
          price: "19.90",
          status: "active",
        },
        {
          id: "prod-2",
          storeId: "store-alpha-id",
          title: "Mentoria",
          price: "150.00",
          status: "active",
        },
      ]);

      await handleCatalogCommand(defaultContext, 123456);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining("Catálogo de Produtos"),
        expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({
                callback_data: "prod_view:prod-1:1",
                text: expect.stringContaining("Guia Completo"),
              }),
              expect.objectContaining({
                callback_data: "cart_add:prod-1:1",
                text: "🛒",
              }),
            ]),
          ]),
        }),
        "Markdown",
        expect.anything()
      );
    });
  });

  describe("Interactive Cart Callback Queries", () => {
    it("should handle 'cart_add:<productId>' by calling CartService and updating message", async () => {
      vi.mocked(CartService.addItemByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack",
            title: "Pack",
            price: 10,
            quantity: 1,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 10,
        total: 10,
        itemCount: 1,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_add:prod-1",
        { id: 777666, first_name: "Buyer" }
      );

      expect(handled).toBe(true);
      expect(CartService.addItemByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666, "prod-1", 1);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "✅ Produto adicionado ao carrinho!");
      expect(mockEditMessageText).toHaveBeenCalledWith(
        123456,
        999,
        expect.stringContaining("Seu Carrinho de Compras"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("should handle 'cart_inc:<productId>' by incrementing item quantity", async () => {
      vi.mocked(CartService.addItemByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack",
            title: "Pack",
            price: 10,
            quantity: 2,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 20,
        total: 20,
        itemCount: 2,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_inc:prod-1",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(CartService.addItemByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666, "prod-1", 1);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "➕ Quantidade aumentada!");
      expect(mockEditMessageText).toHaveBeenCalled();
    });

    it("should handle 'cart_dec:<productId>' by reducing quantity if > 1", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack",
            title: "Pack",
            price: 10,
            quantity: 3,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 30,
        total: 30,
        itemCount: 3,
      });

      vi.mocked(CartService.updateQuantityByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack",
            title: "Pack",
            price: 10,
            quantity: 2,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 20,
        total: 20,
        itemCount: 2,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_dec:prod-1",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(CartService.updateQuantityByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666, "prod-1", 2);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "➖ Quantidade reduzida!");
    });

    it("should handle 'cart_dec:<productId>' by removing item if quantity reaches 1", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack",
            title: "Pack",
            price: 10,
            quantity: 1,
            coverUrl: null,
            storeId: "store-alpha-id",
          },
        ],
        subtotal: 10,
        total: 10,
        itemCount: 1,
      });

      vi.mocked(CartService.removeItemByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_dec:prod-1",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(CartService.removeItemByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666, "prod-1");
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "🗑️ Item removido do carrinho!");
    });

    it("should handle 'cart_rem:<productId>' by removing item directly", async () => {
      vi.mocked(CartService.removeItemByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_rem:prod-1",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(CartService.removeItemByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666, "prod-1");
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "🗑️ Item removido!");
    });

    it("should handle 'cart_clr' by clearing cart", async () => {
      vi.mocked(CartService.clearCartByTelegramUser).mockResolvedValueOnce({
        id: "cart-1",
        storeId: "store-alpha-id",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_clr",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(CartService.clearCartByTelegramUser).toHaveBeenCalledWith("store-alpha-id", 777666);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-123", "🗑️ Carrinho esvaziado!");
    });

    it("should answer with user-friendly alert when product is inactive or missing", async () => {
      vi.mocked(CartService.addItemByTelegramUser).mockRejectedValueOnce(
        new Error("Produto não está disponível para compra.")
      );

      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "cart_add:prod-inactive",
        { id: 777666 }
      );

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        "cb-123",
        "⚠️ Este produto não está mais disponível.",
        true
      );
    });

    it("should ignore callbacks not starting with cart_", async () => {
      const handled = await handleCartCallbackQuery(
        defaultContext,
        "cb-123",
        123456,
        999,
        "other_action:123",
        { id: 777666 }
      );

      expect(handled).toBe(false);
      expect(mockAnswerCallbackQuery).not.toHaveBeenCalled();
    });
  });
});
