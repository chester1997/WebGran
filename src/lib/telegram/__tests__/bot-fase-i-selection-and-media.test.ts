import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCatalogMessage,
  formatCartMessage,
  formatAccessesMessage,
  formatProductDetailMessage,
  handleCartCallbackQuery,
  type BotCartContext,
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { AccessService } from "@/lib/orders/access-service";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

// Mock DB
const mockFindManyProducts = vi.fn();
const mockFindFirstProduct = vi.fn();
const mockFindFirstCustomer = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      products: {
        findMany: (...args: any[]) => mockFindManyProducts(...args),
        findFirst: (...args: any[]) => mockFindFirstProduct(...args),
      },
      telegramCustomers: {
        findFirst: (...args: any[]) => mockFindFirstCustomer(...args),
      },
      clips: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCartByTelegramUser: vi.fn(),
    addItemByTelegramUser: vi.fn(),
    removeItemByTelegramUser: vi.fn(),
    clearCartByTelegramUser: vi.fn(),
  },
}));

vi.mock("@/lib/orders/access-service", () => ({
  AccessService: {
    getCustomerAccesses: vi.fn(),
  },
}));

vi.mock("@/lib/orders/access-lifecycle-service", () => ({
  AccessLifecycleService: {
    resolveAccessDestination: vi.fn(),
  },
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    listProductVideos: vi.fn().mockResolvedValue([]),
  },
}));

describe("WebGran — Fase I: Carrinho por Seleção, Alinhamento Mobile e Reprodução Direta", () => {
  const storeId = "store-fase-i";
  const miniAppUrl = "https://webgran.test/miniapp/fase-i-store";
  const mockBotService = {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
    editMessageText: vi.fn().mockResolvedValue({ message_id: 101 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    sendVideo: vi.fn().mockResolvedValue({ message_id: 102 }),
  };

  const defaultCtx: BotCartContext = {
    botService: mockBotService as any,
    store: {
      id: storeId,
      name: "Loja Fase I",
      slug: "fase-i-store",
    } as any,
    miniAppUrl,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Seleção e Desseleção no Catálogo (Toggle)", () => {
    it("should render 🛒 when product is not in cart and ✅ Adicionado when product is in cart", async () => {
      mockFindManyProducts.mockResolvedValueOnce([
        { id: "prod-1", title: "Produto 1", price: "25.00", status: "active", storeId },
        { id: "prod-2", title: "Produto 2", price: "35.00", status: "active", storeId },
      ]);

      // User has prod-2 in cart, but not prod-1
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
        items: [{ id: "item-2", productId: "prod-2", quantity: 1 }],
      } as any);

      const res = await formatCatalogMessage(storeId, miniAppUrl, 1, 998877);

      expect(res.replyMarkup.inline_keyboard[0][1].text).toBe("🛒");
      expect(res.replyMarkup.inline_keyboard[0][1].callback_data).toBe("cart_add:prod-1:1");

      expect(res.replyMarkup.inline_keyboard[1][1].text).toBe("✅ Adicionado");
      expect(res.replyMarkup.inline_keyboard[1][1].callback_data).toBe("cart_add:prod-2:1");
    });

    it("1st click: adds product to cart and updates catalog in-place without replacing screen", async () => {
      mockFindManyProducts.mockResolvedValue([
        { id: "prod-toggle", title: "Produto Toggle", price: "20.00", status: "active", storeId },
      ]);

      // Cart initially empty
      vi.mocked(CartService.getCartByTelegramUser)
        .mockResolvedValueOnce({ items: [] } as any) // Check before add
        .mockResolvedValueOnce({ items: [{ id: "item-t1", productId: "prod-toggle", quantity: 1 }] } as any); // Re-render

      vi.mocked(CartService.addItemByTelegramUser).mockResolvedValueOnce({
        items: [{ id: "item-t1", productId: "prod-toggle", quantity: 1 }],
        subtotal: 20,
        total: 20,
      } as any);

      const handled = await handleCartCallbackQuery(
        defaultCtx,
        "cb-first-click",
        12345,
        200,
        "cart_add:prod-toggle:1",
        { id: 998877 }
      );

      expect(handled).toBe(true);
      expect(CartService.addItemByTelegramUser).toHaveBeenCalledWith(storeId, 998877, "prod-toggle", 1);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-first-click", expect.stringContaining("Adicionado"));
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        12345,
        200,
        expect.stringContaining("Catálogo de Produtos"),
        expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: "✅ Adicionado" }),
            ]),
          ]),
        }),
        "Markdown",
        expect.any(Object)
      );
    });

    it("2nd click: deselects/removes product from cart and reverts to 🛒 without increasing quantity", async () => {
      mockFindManyProducts.mockResolvedValue([
        { id: "prod-toggle", title: "Produto Toggle", price: "20.00", status: "active", storeId },
      ]);

      // Cart currently has the product
      vi.mocked(CartService.getCartByTelegramUser)
        .mockResolvedValueOnce({
          items: [{ id: "item-t1", productId: "prod-toggle", quantity: 1 }],
        } as any) // Check before toggle
        .mockResolvedValueOnce({ items: [] } as any); // Re-render after removal

      vi.mocked(CartService.removeItemByTelegramUser).mockResolvedValueOnce({
        items: [],
        subtotal: 0,
        total: 0,
      } as any);

      const handled = await handleCartCallbackQuery(
        defaultCtx,
        "cb-second-click",
        12345,
        200,
        "cart_add:prod-toggle:1",
        { id: 998877 }
      );

      expect(handled).toBe(true);
      expect(CartService.removeItemByTelegramUser).toHaveBeenCalledWith(storeId, 998877, "item-t1");
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-second-click", expect.stringContaining("Removido"));
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        12345,
        200,
        expect.stringContaining("Catálogo de Produtos"),
        expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: "🛒" }),
            ]),
          ]),
        }),
        "Markdown",
        expect.any(Object)
      );
    });

    it("should retain selection state when changing catalog page", async () => {
      const tenProds = Array.from({ length: 15 }, (_, i) => ({
        id: `prod-p-${i + 1}`,
        title: `Produto ${i + 1}`,
        price: "10.00",
        status: "active",
        storeId,
      }));
      mockFindManyProducts.mockResolvedValue(tenProds);

      // prod-p-12 (on page 2) is in user cart
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValue({
        items: [{ id: "item-12", productId: "prod-p-12", quantity: 1 }],
      } as any);

      // Page 1
      const page1 = await formatCatalogMessage(storeId, miniAppUrl, 1, 998877);
      expect(page1.replyMarkup.inline_keyboard[0][1].text).toBe("🛒");

      // Page 2
      const page2 = await formatCatalogMessage(storeId, miniAppUrl, 2, 998877);
      // First item of page 2 is prod-p-11 (not in cart)
      expect(page2.replyMarkup.inline_keyboard[0][1].text).toBe("🛒");
      // Second item of page 2 is prod-p-12 (in cart!)
      expect(page2.replyMarkup.inline_keyboard[1][1].text).toBe("✅ Adicionado");
    });

    it("should never show fake success when persistence fails", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({ items: [] } as any);
      vi.mocked(CartService.addItemByTelegramUser).mockRejectedValueOnce(new Error("Connection reset"));

      const handled = await handleCartCallbackQuery(
        defaultCtx,
        "cb-fail-persist",
        12345,
        200,
        "cart_add:prod-err:1",
        { id: 998877 }
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-fail-persist",
        "⚠️ Não foi possível alterar o carrinho no momento.",
        true
      );
      expect(mockBotService.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe("2. Carrinho Simplificado (Sem ➖ e ➕)", () => {
    it("should NOT render ➖ and ➕ buttons in cart, rendering a clean 2-button row", () => {
      const cart = {
        id: "cart-simple-1",
        storeId,
        customerId: "cust-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            title: "Pack VIP Completo",
            price: 49.9,
            quantity: 1,
            isCombo: false,
          },
          {
            id: "item-2",
            productId: "prod-2",
            title: "E-book Estratégico",
            price: 19.9,
            quantity: 2,
            isCombo: false,
          },
        ],
        subtotal: 89.7,
        total: 89.7,
        itemCount: 3,
      };

      const result = formatCartMessage(cart as any, miniAppUrl);
      const allButtons = result.replyMarkup.inline_keyboard.flat();

      // Ensure ➖ and ➕ are completely absent
      expect(allButtons.some((b: any) => b.text === "➖" || b.text === "➕")).toBe(false);

      // Verify row 1 has compact label and removal button
      const row1 = result.replyMarkup.inline_keyboard[0];
      expect(row1).toHaveLength(2);
      expect(row1[0].text).toContain("Pack VIP Completo");
      expect(row1[0].callback_data).toBe("cart_noop");
      expect(row1[1].text).toBe("🗑️ Remover");
      expect(row1[1].callback_data).toBe("cart_rem:item-1");

      // Verify row 2 handles quantity > 1 safely
      const row2 = result.replyMarkup.inline_keyboard[1];
      expect(row2).toHaveLength(2);
      expect(row2[0].text).toContain("2x");
      expect(row2[1].callback_data).toBe("cart_rem:item-2");

      // Preserves Ver Ofertas and Ver Combos
      const offersRow = result.replyMarkup.inline_keyboard.find((row: any) =>
        row.some((b: any) => b.callback_data === "prog_view")
      );
      expect(offersRow).toBeDefined();
      expect(offersRow?.some((b: any) => b.callback_data === "combo_list")).toBe(true);

      // Preserves Mini App Checkout and Voltar ao Menu
      expect(allButtons.some((b: any) => b.web_app?.url?.includes("/cart"))).toBe(true);
      expect(allButtons.some((b: any) => b.callback_data === "start_menu")).toBe(true);
    });

    it("should remove item via cart_rem callback and re-render cart with recalculated totals", async () => {
      vi.mocked(CartService.removeItemByTelegramUser).mockResolvedValueOnce({
        id: "cart-simple-1",
        storeId,
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
      });

      const handled = await handleCartCallbackQuery(
        defaultCtx,
        "cb-rem-item",
        12345,
        300,
        "cart_rem:item-1",
        { id: 998877 }
      );

      expect(handled).toBe(true);
      expect(CartService.removeItemByTelegramUser).toHaveBeenCalledWith(storeId, 998877, "item-1");
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-rem-item", expect.stringContaining("removido"));
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        12345,
        300,
        expect.stringContaining("vazio"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  describe("3. Meus Acessos: Distinção entre Vídeo e Grupo/Canal", () => {
    it("should render web_app button for video product opening direct video route", async () => {
      mockFindFirstCustomer.mockResolvedValueOnce({
        id: "cust-real-1",
        storeId,
        telegramUserId: "777888",
      });

      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([
        {
          id: "acc-vid-1",
          storeId,
          customerId: "cust-real-1",
          status: "ACTIVE",
          product: {
            id: "prod-vid-1",
            title: "Série VIP Vídeos",
            deliveryType: "product_video",
          },
        } as any,
      ]);

      vi.mocked(AccessLifecycleService.resolveAccessDestination).mockResolvedValueOnce({
        success: true,
        status: "ACTIVE",
        destinationType: "PRODUCT_VIDEO",
        destinationUrl: "https://webgran.test/miniapp/fase-i-store/video/vid-ready-1",
      } as any);

      const result = await formatAccessesMessage(
        { id: storeId, name: "Loja Fase I", slug: "fase-i-store" },
        777888,
        miniAppUrl
      );

      expect(result.text).toContain("Série VIP Vídeos");
      const videoBtn = result.replyMarkup.inline_keyboard[0][0];
      expect(videoBtn.text).toContain("Assistir");
      // MUST be a web_app button to keep user inside Telegram without redirecting to external browser
      expect(videoBtn.web_app).toBeDefined();
      expect(videoBtn.web_app.url).toBe("https://webgran.test/miniapp/fase-i-store/video/vid-ready-1");
      expect(videoBtn.url).toBeUndefined();
    });

    it("should preserve standard Telegram invite URL button for channel or group products", async () => {
      mockFindFirstCustomer.mockResolvedValueOnce({
        id: "cust-real-1",
        storeId,
        telegramUserId: "777888",
      });

      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([
        {
          id: "acc-channel-1",
          storeId,
          customerId: "cust-real-1",
          status: "ACTIVE",
          inviteLink: "https://t.me/+joinGroupChat123",
          product: {
            id: "prod-chan-1",
            title: "Canal de Sinais VIP",
            deliveryType: "telegram_invite",
          },
        } as any,
      ]);

      vi.mocked(AccessLifecycleService.resolveAccessDestination).mockResolvedValueOnce({
        success: true,
        status: "ACTIVE",
        destinationType: "TELEGRAM_INVITE",
        destinationUrl: "https://t.me/+joinGroupChat123",
      } as any);

      const result = await formatAccessesMessage(
        { id: storeId, name: "Loja Fase I", slug: "fase-i-store" },
        777888,
        miniAppUrl
      );

      expect(result.text).toContain("Canal de Sinais VIP");
      const channelBtn = result.replyMarkup.inline_keyboard[0][0];
      expect(channelBtn.text).toContain("Acessar");
      expect(channelBtn.url).toBe("https://t.me/+joinGroupChat123");
      expect(channelBtn.web_app).toBeUndefined();
    });

    it("should handle product without video gracefully with safe fallback", async () => {
      mockFindFirstCustomer.mockResolvedValueOnce({
        id: "cust-real-1",
        storeId,
        telegramUserId: "777888",
      });

      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([
        {
          id: "acc-no-video",
          storeId,
          customerId: "cust-real-1",
          status: "ACTIVE",
          product: {
            id: "prod-pending-video",
            title: "Curso Em Produção",
            deliveryType: "product_video",
          },
        } as any,
      ]);

      vi.mocked(AccessLifecycleService.resolveAccessDestination).mockResolvedValueOnce({
        success: true,
        status: "ACTIVE",
        destinationType: "PRODUCT_VIDEO",
        destinationUrl: `${miniAppUrl}/accesses`,
      } as any);

      const result = await formatAccessesMessage(
        { id: storeId, name: "Loja Fase I", slug: "fase-i-store" },
        777888,
        miniAppUrl
      );

      const fallbackBtn = result.replyMarkup.inline_keyboard[0][0];
      expect(fallbackBtn.web_app.url).toBe(`${miniAppUrl}/accesses`);
    });
  });
});
