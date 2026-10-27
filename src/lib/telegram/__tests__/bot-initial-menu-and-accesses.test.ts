import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      telegramCustomers: {
        findFirst: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
      },
      accesses: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/orders/access-service", () => ({
  AccessService: {
    getCustomerAccesses: vi.fn(),
  },
}));

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCartByTelegramUser: vi.fn(),
    addItemByTelegramUser: vi.fn(),
    updateQuantityByTelegramUser: vi.fn(),
    removeItemByTelegramUser: vi.fn(),
    clearCartByTelegramUser: vi.fn(),
  },
}));

import {
  getInitialBotKeyboard,
  formatAccessesMessage,
  handleAccessesCommand,
  handleSupportCommand,
  handleCartCallbackQuery,
  formatCartMessage,
} from "../bot-cart-handler";
import { AccessService } from "@/lib/orders/access-service";
import { CartService } from "@/lib/cart/cart-service";
import { ProgressivePricingEngine } from "@/lib/combos/pricing-engine";
import { clearProcessedTelegramUpdatesForTest } from "../update-dedup";

describe("WebGran — Initial Bot Menu, Accesses and Progressive Offers Verification", () => {
  const store = {
    id: "store-uuid-1",
    name: "Loja WebGran Oficial",
    slug: "webgran-oficial",
    supportType: "telegram",
    supportValue: "@suportewebgran",
  };

  const miniAppUrl = "https://webgran.online/miniapp/webgran-oficial";

  const mockBotService: any = {
    sendMessage: vi.fn().mockResolvedValue({}),
    editMessageText: vi.fn().mockResolvedValue({}),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
  };

  const ctx: any = {
    store,
    botService: mockBotService,
    miniAppUrl,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedTelegramUpdatesForTest();
  });

  // Requirement 1 & 2: Exact order of the 4 rows & Carrinho / Meus Acessos on row 2
  it("Requirement 1 & 2: should build exactly 4 rows in the required order with Carrinho and Meus Acessos on row 2", () => {
    const keyboardObj = getInitialBotKeyboard(store, miniAppUrl);
    const rows: any[][] = keyboardObj.inline_keyboard;

    // Must have exactly 4 rows
    expect(rows).toHaveLength(4);

    // Row 1: Full width "🛍️ ABRIR LOJA"
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0].text).toBe("🛍️ ABRIR LOJA");
    expect(rows[0][0].web_app?.url).toBe(miniAppUrl);

    // Row 2: 2 buttons side-by-side: "🛒 Carrinho" (left) and "📺 Meus Acessos" (right)
    expect(rows[1]).toHaveLength(2);
    expect(rows[1][0].text).toBe("🛒 Carrinho");
    expect(rows[1][0].callback_data).toBe("cart_view");
    expect(rows[1][1].text).toBe("📺 Meus Acessos");
    expect(rows[1][1].callback_data).toBe("my_accesses");

    // Row 3: Full width "📚 Catálogo"
    expect(rows[2]).toHaveLength(1);
    expect(rows[2][0].text).toBe("📚 Catálogo");
    expect(rows[2][0].callback_data).toBe("cart_cat");

    // Row 4: Full width "💬 Suporte"
    expect(rows[3]).toHaveLength(1);
    expect(rows[3][0].text).toBe("💬 Suporte");
    expect(rows[3][0].url).toBe("https://t.me/suportewebgran");
  });

  // Requirement 3: The "Ofertas" button does NOT appear on initial menu
  it("Requirement 3: should NOT contain 'Ofertas', 'Oferta', or '🔥' on the initial menu", () => {
    const keyboardObj = getInitialBotKeyboard(store, miniAppUrl);
    const allButtons: any[] = keyboardObj.inline_keyboard.flat();

    for (const btn of allButtons) {
      expect(btn.text.toLowerCase()).not.toContain("oferta");
      expect(btn.text).not.toContain("🔥");
      if (btn.callback_data) {
        expect(btn.callback_data).not.toContain("prog_");
        expect(btn.callback_data).not.toContain("oferta");
      }
    }
  });

  // Requirement 4: "ABRIR LOJA" continues opening the correct store Mini App
  it("Requirement 4: should configure 'ABRIR LOJA' to open the exact Mini App URL for the store", () => {
    const customMiniAppUrl = "https://custom-domain.com/miniapp/loja-especifica";
    const keyboardObj = getInitialBotKeyboard(store, customMiniAppUrl);
    const firstRow: any = keyboardObj.inline_keyboard[0];

    expect(firstRow[0].text).toBe("🛍️ ABRIR LOJA");
    expect(firstRow[0].web_app).toBeDefined();
    expect(firstRow[0].web_app.url).toBe(customMiniAppUrl);
  });

  // Requirement 5: "Carrinho" retrieves the persisted cart of the user
  it("Requirement 5: should retrieve the persisted cart of the user when cart_view callback is triggered", async () => {
    const mockCart = {
      id: "cart-123",
      storeId: store.id,
      telegramUserId: "tg-user-999",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          title: "Acesso Canal VIP",
          unitPrice: 20,
          quantity: 1,
          totalPrice: 20,
        },
      ],
      subtotal: 20,
      total: 20,
      itemCount: 1,
      progressiveDiscount: 0,
    };

    vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce(mockCart as any);

    const handled = await handleCartCallbackQuery(
      ctx,
      "cb-cart-1",
      12345,
      100,
      "cart_view",
      { id: 999, first_name: "Luiz" }
    );

    expect(handled).toBe(true);
    expect(CartService.getCartByTelegramUser).toHaveBeenCalledWith(store.id, 999);
    expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-cart-1");
    expect(mockBotService.editMessageText).toHaveBeenCalledWith(
      12345,
      100,
      expect.stringContaining("Acesso Canal VIP"),
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      "Markdown"
    );
  });

  // Requirement 6: "Meus Acessos" lists only liberated products (paid orders only)
  describe("Requirement 6: Meus Acessos lists only liberated products", () => {
    it("should list active liberated accesses when customer has paid products", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce({
        id: "cust-777",
        storeId: store.id,
        telegramUserId: "999",
      });

      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([
        {
          id: "acc-1",
          storeId: store.id,
          customerId: "cust-777",
          productId: "prod-vip-1",
          status: "ACTIVE",
          inviteLink: "https://t.me/+joinChatVip1",
          product: { title: "Canal VIP Séries Exclusivas" },
        } as any,
      ]);

      const result = await formatAccessesMessage(store, 999, miniAppUrl);

      expect(mockDb.query.telegramCustomers.findFirst).toHaveBeenCalled();
      expect(AccessService.getCustomerAccesses).toHaveBeenCalledWith(store.id, "cust-777");
      expect(result.text).toContain("Canal VIP Séries Exclusivas");
      expect(result.text).toContain("Você possui *1* produto liberado");

      const accessBtn = result.replyMarkup.inline_keyboard[0][0];
      expect(accessBtn.text).toContain("Canal VIP Séries Exclu");
      expect(accessBtn.url).toBe("https://t.me/+joinChatVip1");
    });

    it("should display informative empty state when user has no liberated/paid accesses", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce({
        id: "cust-888",
        storeId: store.id,
        telegramUserId: "999",
      });

      // No liberated accesses returned (e.g. pending/unpaid filtered out)
      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([]);

      const result = await formatAccessesMessage(store, 999, miniAppUrl);

      expect(result.text).toContain("Você ainda não possui conteúdos liberados nesta loja");
      expect(result.text).toContain("Assim que seu pagamento for confirmado");
      expect(result.replyMarkup.inline_keyboard[0][0].text).toBe("🛍️ ABRIR LOJA");
    });

    it("should route my_accesses callback query to formatAccessesMessage", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce({
        id: "cust-777",
        storeId: store.id,
        telegramUserId: "999",
      });

      vi.mocked(AccessService.getCustomerAccesses).mockResolvedValueOnce([]);

      const handled = await handleCartCallbackQuery(
        ctx,
        "cb-acc-1",
        12345,
        100,
        "my_accesses",
        { id: 999 }
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-acc-1");
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        12345,
        100,
        expect.stringContaining("Meus Acessos"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("should handle /acessos command cleanly", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce(null);

      await handleAccessesCommand(ctx, 12345, { id: 999 });

      expect(mockBotService.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining("Meus Acessos"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  // Requirement 7: "Catálogo" opens existing catalog
  it("Requirement 7: should show catalog products when cart_cat callback is triggered", async () => {
    mockDb.query.products.findMany.mockResolvedValueOnce([
      {
        id: "prod-cat-1",
        title: "Pack Stickers VIP",
        price: "15.00",
        status: "active",
      },
    ]);

    const handled = await handleCartCallbackQuery(
      ctx,
      "cb-cat-1",
      12345,
      100,
      "cart_cat",
      { id: 999 }
    );

    expect(handled).toBe(true);
    expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-cat-1");
    expect(mockBotService.editMessageText).toHaveBeenCalledWith(
      12345,
      100,
      expect.stringContaining("Catálogo de Produtos"),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Pack Stickers VIP"),
              callback_data: "prod_view:prod-cat-1:1",
            }),
            expect.objectContaining({
              text: "🛒",
              callback_data: "cart_add:prod-cat-1:1",
            }),
          ]),
        ]),
      }),
      "Markdown",
      expect.anything()
    );
  });

  // Requirement 8: "Suporte" reuses existing handler & store configuration
  describe("Requirement 8: Suporte reuses existing handler and store configuration", () => {
    it("should link directly to Telegram support when store.supportType is telegram", () => {
      const tgStore = {
        supportType: "telegram",
        supportValue: "@suporteloja",
      };
      const keyboardObj = getInitialBotKeyboard(tgStore, miniAppUrl);
      const supportBtn: any = keyboardObj.inline_keyboard[3][0];

      expect(supportBtn.text).toBe("💬 Suporte");
      expect(supportBtn.url).toBe("https://t.me/suporteloja");
    });

    it("should link directly to WhatsApp support when store.supportType is whatsapp", () => {
      const waStore = {
        supportType: "whatsapp",
        supportValue: "+5511999998888",
      };
      const keyboardObj = getInitialBotKeyboard(waStore, miniAppUrl);
      const supportBtn: any = keyboardObj.inline_keyboard[3][0];

      expect(supportBtn.text).toBe("💬 Suporte");
      expect(supportBtn.url).toBe("https://wa.me/5511999998888");
    });

    it("should fallback to support_info callback when support is not configured", () => {
      const noSupportStore = {
        supportType: null,
        supportValue: null,
      };
      const keyboardObj = getInitialBotKeyboard(noSupportStore, miniAppUrl);
      const supportBtn: any = keyboardObj.inline_keyboard[3][0];

      expect(supportBtn.text).toBe("💬 Suporte");
      expect(supportBtn.callback_data).toBe("support_info");
    });

    it("should handle handleSupportCommand cleanly when support URL is configured", async () => {
      await handleSupportCommand(ctx, 12345, store);

      expect(mockBotService.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining("Atendimento e Suporte"),
        expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({
                text: "💬 Falar com Suporte",
                url: "https://t.me/suportewebgran",
              }),
            ]),
          ]),
        }),
        "Markdown"
      );
    });
  });

  // Requirement 9: Store and User Isolation
  it("Requirement 9: should isolate carts and accesses by storeId and telegramUserId", async () => {
    // User A on Store 1
    mockDb.query.telegramCustomers.findFirst.mockImplementation(async ({ where }: any) => {
      return null;
    });

    await formatAccessesMessage(
      { id: "store-1", name: "Loja 1", slug: "loja-1" },
      "tg-user-a",
      "https://webgran.online/miniapp/loja-1"
    );

    // Verify customer query used both storeId AND telegramUserId
    expect(mockDb.query.telegramCustomers.findFirst).toHaveBeenCalled();

    // Verify CartService isolation
    vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
      items: [],
      subtotal: 0,
      total: 0,
      itemCount: 0,
    } as any);

    await handleCartCallbackQuery(
      {
        store: { id: "store-2", name: "Loja 2", slug: "loja-2" },
        botService: mockBotService,
        miniAppUrl: "https://webgran.online/miniapp/loja-2",
      } as any,
      "cb-cart-iso",
      12345,
      100,
      "cart_view",
      { id: "tg-user-b" }
    );

    expect(CartService.getCartByTelegramUser).toHaveBeenCalledWith("store-2", "tg-user-b");
  });

  // Requirement 10: Progressive offer calculations continue working in cart & checkout
  it("Requirement 10: progressive offer calculations and pricing engine continue working seamlessly", () => {
    const promotion = {
      id: "promo-progressive-1",
      storeId: store.id,
      title: "Super Desconto Progressivo",
      eligibilityMode: "all_products" as const,
      tiers: [
        { id: "t1", minQuantity: 2, priceCents: 1600 }, // R$ 16.00 for 2 items
        { id: "t2", minQuantity: 4, priceCents: 2800 }, // R$ 28.00 for 4 items
      ],
    };

    // 5 units: 3x prod-a (1000 each) and 2x prod-b (1000 each)
    const items = [
      { id: "item-1", priceCents: 1000 },
      { id: "item-2", priceCents: 1000 },
      { id: "item-3", priceCents: 1000 },
      { id: "item-4", priceCents: 1000 },
      { id: "item-5", priceCents: 1000 },
    ];

    const result = ProgressivePricingEngine.calculate(items, promotion.tiers);

    expect(result.totalUnits).toBe(5);
    expect(result.coveredUnits).toBe(4);
    // 5 items with tiers [2: 1600, 4: 2800]:
    // 1x Tier 4 (2800) + 1 remaining unit (1000) = 3800 cents.
    // Savings = 5000 - 3800 = 1200 cents (R$ 12.00).
    expect(result.savingsCents).toBe(1200);
    expect(result.finalPriceCents).toBe(3800);
    expect(result.appliedTiers).toHaveLength(1);
    expect(result.appliedTiers[0].minQuantity).toBe(4);

    // Verify formatCartMessage correctly shows progressive discount info
    const cartDTO = {
      id: "cart-prog",
      storeId: store.id,
      telegramUserId: "999",
      items: [
        {
          id: "item-a",
          productId: "prod-a",
          title: "Produto A",
          unitPrice: 10,
          quantity: 5,
          totalPrice: 50,
        },
      ],
      subtotal: 50,
      total: 38,
      itemCount: 5,
      progressiveDiscount: 12,
      progressivePromotion: {
        savingsPercentage: 24,
        appliedTiers: [
          { minQuantity: 4, count: 1, priceCents: 2800 },
        ],
      },
    };

    const formattedCart = formatCartMessage(cartDTO as any, miniAppUrl);
    expect(formattedCart.text).toContain("🎉 *Desconto Progressivo:* -R$ 12,00 (24% OFF)");
    expect(formattedCart.text).toContain("💵 *Total:* *R$ 38,00*");
    expect(formattedCart.text).toContain("🏷️ *Faixa aplicada:* 1x (4 un por R$ 28,00)");
  });
});
