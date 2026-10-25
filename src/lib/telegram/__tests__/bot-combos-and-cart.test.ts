import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      combos: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      carts: {
        findFirst: vi.fn(),
      },
      cartItems: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramCustomers: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

import { 
  formatCombosMessage, 
  handleCombosCommand, 
  handleCartCallbackQuery 
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";

describe("Bot Combos and Cart Integration Suite (Phase 4 — Etapa 4)", () => {
  const storeId = "store-123";
  const miniAppUrl = "https://webgran.online/miniapp/minha-loja";

  const mockBotService = {
    sendMessage: vi.fn(),
    editMessageText: vi.fn(),
    answerCallbackQuery: vi.fn(),
  };

  const mockCtx = {
    store: {
      id: storeId,
      name: "Minha Loja",
      slug: "minha-loja",
    },
    botService: mockBotService as any,
    miniAppUrl,
  };

  const telegramUser = {
    id: 99887766,
    first_name: "Comprador",
    username: "comprador_vip",
  };

  const product1 = {
    id: "prod-1",
    storeId,
    title: "Canal Alpha",
    price: "40.00",
    coverUrl: "https://img.test/p1.webp",
    status: "active",
  };

  const product2 = {
    id: "prod-2",
    storeId,
    title: "Grupo Beta",
    price: "60.00",
    coverUrl: "https://img.test/p2.webp",
    status: "active",
  };

  const activeCombo = {
    id: "combo-123",
    storeId,
    title: "Pacote Alpha + Beta",
    slug: "pacote-alpha-beta",
    description: "Dois acessos com desconto",
    coverUrl: "https://img.test/combo.webp",
    price: "69.90",
    status: "active",
    position: 0,
    products: [
      { position: 0, product: product1 },
      { position: 1, product: product2 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. formatCombosMessage & /combos Command", () => {
    it("should format friendly empty message when store has no active combos", async () => {
      mockDb.query.combos.findMany.mockResolvedValueOnce([]);

      const { text, replyMarkup } = await formatCombosMessage(storeId, miniAppUrl);

      expect(text).toContain("Nenhum combo promocional disponível");
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("cart_cat");
    });

    it("should format combos with products, crossed-out regular price, promo price and compact combo_add callback", async () => {
      mockDb.query.combos.findMany.mockResolvedValueOnce([activeCombo]);

      const { text, replyMarkup } = await formatCombosMessage(storeId, miniAppUrl);

      expect(text).toContain("Pacote Alpha + Beta");
      expect(text).toContain("Canal Alpha");
      expect(text).toContain("Grupo Beta");
      expect(text).toContain("~R$ 100,00~");
      expect(text).toContain("*R$ 69,90*");
      expect(text).toContain("30% OFF");

      const addBtn = replyMarkup.inline_keyboard[0][0];
      expect(addBtn.callback_data).toBe("combo_add:combo-123");
    });

    it("should handle /combos command and send formatted message via botService", async () => {
      mockDb.query.combos.findMany.mockResolvedValueOnce([activeCombo]);

      await handleCombosCommand(mockCtx, 123456);

      expect(mockBotService.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining("Pacote Alpha + Beta"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  describe("2. Interactive Callbacks: combo_list & combo_add", () => {
    it("should handle combo_list callback and edit message to show combos", async () => {
      mockDb.query.combos.findMany.mockResolvedValueOnce([activeCombo]);

      const handled = await handleCartCallbackQuery(
        mockCtx,
        "cb-1",
        123456,
        789,
        "combo_list",
        telegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-1");
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        789,
        expect.stringContaining("Pacote Alpha + Beta"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("should handle combo_add callback, add combo to customer cart and update message", async () => {
      // Mock customer resolution
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce({
        id: "cust-1",
        storeId,
        telegramUserId: "99887766",
      });

      // Mock combo check in CartService.addComboItem
      mockDb.query.combos.findFirst.mockResolvedValueOnce({
        id: "combo-123",
        storeId,
        title: "Pacote Alpha + Beta",
        slug: "pacote-alpha-beta",
        price: "69.90",
        status: "active",
      });

      // Mock cart record
      mockDb.query.carts.findFirst.mockResolvedValue({
        id: "cart-1",
        storeId,
        customerId: "cust-1",
      });

      // Mock cartItems check
      mockDb.query.cartItems.findFirst.mockResolvedValueOnce(null);

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      } as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      } as any);

      // Mock getCart call at the end of addComboItem
      mockDb.query.cartItems.findMany.mockResolvedValueOnce([
        {
          id: "item-combo-1",
          cartId: "cart-1",
          comboId: "combo-123",
          productId: null,
          quantity: 1,
          combo: {
            id: "combo-123",
            storeId,
            title: "Pacote Alpha + Beta",
            slug: "pacote-alpha-beta",
            price: "69.90",
            status: "active",
            coverUrl: null,
          },
        },
      ]);

      const handled = await handleCartCallbackQuery(
        mockCtx,
        "cb-2",
        123456,
        789,
        "combo_add:combo-123",
        telegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-2",
        "🎁 Combo adicionado ao carrinho!"
      );
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        789,
        expect.stringContaining("Pacote Alpha + Beta"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("should answer callback with error alert if combo is inactive or not found", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce({
        id: "cust-1",
        storeId,
        telegramUserId: "99887766",
      });

      // Combo not found or inactive
      mockDb.query.combos.findFirst.mockResolvedValueOnce(null);

      const handled = await handleCartCallbackQuery(
        mockCtx,
        "cb-err",
        123456,
        789,
        "combo_add:combo-invalid",
        telegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-err",
        "⚠️ Este combo não está mais disponível.",
        true
      );
    });
  });

  describe("3. Shared Cart Coexistence: Products and Combos", () => {
    it("should correctly calculate cart subtotal with both individual products and combos", async () => {
      mockDb.query.carts.findFirst.mockResolvedValueOnce({
        id: "cart-mixed",
        storeId,
        customerId: "cust-1",
      });

      mockDb.query.cartItems.findMany.mockResolvedValueOnce([
        {
          id: "item-1",
          cartId: "cart-mixed",
          productId: "prod-1",
          comboId: null,
          quantity: 2, // 2 x 40 = 80
          product: product1,
        },
        {
          id: "item-2",
          cartId: "cart-mixed",
          productId: null,
          comboId: "combo-123",
          quantity: 1, // 1 x 69.90 = 69.90
          combo: {
            id: "combo-123",
            storeId,
            title: "Pacote Alpha + Beta",
            slug: "pacote-alpha-beta",
            price: "69.90",
            status: "active",
            coverUrl: null,
          },
        },
      ]);

      const cart = await CartService.getCart(storeId, "cust-1");

      expect(cart.items).toHaveLength(2);
      expect(cart.itemCount).toBe(3); // 2 + 1
      expect(cart.subtotal).toBe(149.9); // 80 + 69.90 = 149.90
      expect(cart.total).toBe(149.9);

      const comboItem = cart.items.find((i) => i.isCombo);
      expect(comboItem).toBeDefined();
      expect(comboItem?.title).toBe("Pacote Alpha + Beta");
      expect(comboItem?.comboId).toBe("combo-123");
    });
  });
});
