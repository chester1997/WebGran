import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      products: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      telegramCustomers: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCartByTelegramUser: vi.fn(),
    addItemByTelegramUser: vi.fn(),
    addComboByTelegramUser: vi.fn(),
    updateQuantityByTelegramUser: vi.fn(),
    removeItemByTelegramUser: vi.fn(),
    clearCartByTelegramUser: vi.fn(),
  },
}));

vi.mock("@/lib/orders/access-service", () => ({
  AccessService: {
    getCustomerAccesses: vi.fn(),
  },
}));

import {
  formatCatalogMessage,
  formatProductDetailMessage,
  formatCartMessage,
  formatAccessesMessage,
  getInitialBotKeyboard,
  handleCartCallbackQuery,
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { AccessService } from "@/lib/orders/access-service";
import { ProgressivePricingEngine } from "@/lib/combos/pricing-engine";
import { clearProcessedTelegramUpdatesForTest } from "../update-dedup";

describe("WebGran — Fase G: Catálogo Paginado, Botões Compactos e Navegação de Retorno", () => {
  const storeId = "store-alpha-123";
  const miniAppUrl = "https://webgran.online/miniapp/loja-alpha";

  const mockBotService: any = {
    sendMessage: vi.fn().mockResolvedValue({}),
    editMessageText: vi.fn().mockResolvedValue({}),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
  };

  const defaultCtx: any = {
    store: {
      id: storeId,
      name: "Loja Alpha",
      slug: "loja-alpha",
      supportType: "telegram",
      supportValue: "@suportealpha",
    },
    botService: mockBotService,
    miniAppUrl,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedTelegramUpdatesForTest();
  });

  const generateProducts = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `prod-${i + 1}`,
      storeId,
      title: `Produto ${i + 1}`,
      price: `${(i + 1) * 10}.00`,
      status: "active",
      createdAt: new Date(2026, 0, count - i),
    }));
  };

  // Test 1: Catálogo com zero produtos
  it("Test 1: should handle empty catalog cleanly with start_menu back button", async () => {
    mockDb.query.products.findMany.mockResolvedValueOnce([]);

    const result = await formatCatalogMessage(storeId, miniAppUrl);
    expect(result.text).toContain("Nenhum produto disponível");

    const buttons = result.replyMarkup.inline_keyboard.flat();
    const backBtn = buttons.find((b: any) => b.callback_data === "start_menu");
    expect(backBtn).toBeDefined();
    expect(backBtn.text).toBe("↩️ Voltar ao Menu");
  });

  // Test 2: Catálogo com 1, 10, 11, 20 e 21 produtos
  describe("Test 2: Pagination boundaries (1, 10, 11, 20 and 21 products)", () => {
    it("should handle 1 product (1 page, no pagination row)", async () => {
      mockDb.query.products.findMany.mockResolvedValueOnce(generateProducts(1));

      const result = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(result.text).toContain("Página 1 de 1 · 1 produto");
      // 1 product row + 2 action rows = 3 rows total (no nav row)
      expect(result.replyMarkup.inline_keyboard).toHaveLength(3);
    });

    it("should handle exactly 10 products (1 page, 10 items, no pagination row)", async () => {
      mockDb.query.products.findMany.mockResolvedValueOnce(generateProducts(10));

      const result = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(result.text).toContain("Página 1 de 1 · 10 produtos");
      // 10 product rows + 2 action rows = 12 rows total
      expect(result.replyMarkup.inline_keyboard).toHaveLength(12);
    });

    it("should handle 11 products (2 pages: 10 on page 1, 1 on page 2)", async () => {
      const prods = generateProducts(11);
      mockDb.query.products.findMany.mockResolvedValue(prods);

      // Page 1
      const p1 = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(p1.text).toContain("Página 1 de 2 · 11 produtos");
      expect(p1.text).toContain("Produto 1");
      expect(p1.text).toContain("Produto 10");
      expect(p1.text).not.toContain("Produto 11");

      // Pagination row on page 1 has "1/2" and "Próxima ▶️"
      const navRowP1 = p1.replyMarkup.inline_keyboard[10];
      expect(navRowP1[0].text).toBe("1/2");
      expect(navRowP1[1].text).toBe("Próxima ▶️");
      expect(navRowP1[1].callback_data).toBe("cat_p:2");

      // Page 2
      const p2 = await formatCatalogMessage(storeId, miniAppUrl, 2);
      expect(p2.text).toContain("Página 2 de 2 · 11 produtos");
      expect(p2.text).toContain("Produto 11");
      expect(p2.text).not.toContain("Produto 10");

      // Pagination row on page 2 has "◀️ Anterior" and "2/2"
      const navRowP2 = p2.replyMarkup.inline_keyboard[1];
      expect(navRowP2[0].text).toBe("◀️ Anterior");
      expect(navRowP2[0].callback_data).toBe("cat_p:1");
      expect(navRowP2[1].text).toBe("2/2");
    });

    it("should handle 20 products (exactly 2 pages of 10 items)", async () => {
      const prods = generateProducts(20);
      mockDb.query.products.findMany.mockResolvedValue(prods);

      const p1 = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(p1.text).toContain("Página 1 de 2 · 20 produtos");
      expect(p1.replyMarkup.inline_keyboard).toHaveLength(13); // 10 prods + 1 nav + 2 actions

      const p2 = await formatCatalogMessage(storeId, miniAppUrl, 2);
      expect(p2.text).toContain("Página 2 de 2 · 20 produtos");
      expect(p2.replyMarkup.inline_keyboard).toHaveLength(13); // 10 prods + 1 nav + 2 actions
    });

    it("should handle 21 products (3 pages: 10, 10, 1)", async () => {
      const prods = generateProducts(21);
      mockDb.query.products.findMany.mockResolvedValue(prods);

      const p1 = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(p1.text).toContain("Página 1 de 3 · 21 produtos");

      const p2 = await formatCatalogMessage(storeId, miniAppUrl, 2);
      expect(p2.text).toContain("Página 2 de 3 · 21 produtos");
      const navRowP2 = p2.replyMarkup.inline_keyboard[10];
      expect(navRowP2[0].text).toBe("◀️ Anterior");
      expect(navRowP2[0].callback_data).toBe("cat_p:1");
      expect(navRowP2[1].text).toBe("2/3");
      expect(navRowP2[2].text).toBe("Próxima ▶️");
      expect(navRowP2[2].callback_data).toBe("cat_p:3");

      const p3 = await formatCatalogMessage(storeId, miniAppUrl, 3);
      expect(p3.text).toContain("Página 3 de 3 · 21 produtos");
      expect(p3.text).toContain("Produto 21");
    });
  });

  // Test 3 & 4: Navegação entre páginas sem duplicação nem pulos
  it("Test 3 & 4: should navigate seamlessly across all pages without duplicating or skipping products", async () => {
    const totalCount = 25;
    const prods = generateProducts(totalCount);
    mockDb.query.products.findMany.mockResolvedValue(prods);

    const visitedProductIds: string[] = [];

    // Traverse page 1, 2, 3
    for (let p = 1; p <= 3; p++) {
      const res = await formatCatalogMessage(storeId, miniAppUrl, p);
      // Collect product ids from keyboard
      const prodRows = res.replyMarkup.inline_keyboard.slice(0, p === 3 ? 5 : 10);
      for (const row of prodRows) {
        const cartBtn = row[1];
        const prodId = cartBtn.callback_data.replace(`cart_add:`, "").replace(`:${p}`, "");
        visitedProductIds.push(prodId);
      }
    }

    // Verify all 25 products were visited exactly once in order
    expect(visitedProductIds).toHaveLength(25);
    const expectedIds = prods.map((p) => p.id);
    expect(visitedProductIds).toEqual(expectedIds);

    // Verify set size matches totalCount (no duplicates)
    expect(new Set(visitedProductIds).size).toBe(25);
  });

  // Test 5: Dois botões por produto, com botão 🛒 compacto
  it("Test 5: each product must have 2 buttons: compact title on the left and 🛒 on the right", async () => {
    mockDb.query.products.findMany.mockResolvedValueOnce([
      {
        id: "prod-99",
        storeId,
        title: "Nome de Produto Extremamente Longo para Testar Truncamento e Alinhamento Visual",
        price: "49.90",
        status: "active",
      },
    ]);

    const res = await formatCatalogMessage(storeId, miniAppUrl, 1);
    const prodRow = res.replyMarkup.inline_keyboard[0];

    expect(prodRow).toHaveLength(2);

    // Left button: numbered compact title truncated with ellipsis (price moved to body for mobile alignment)
    const titleBtn = prodRow[0];
    expect(titleBtn.text).toBe("1. Nome de Produto...");
    expect(titleBtn.callback_data).toBe("prod_view:prod-99:1");
    expect(res.text).toContain("Nome de Produto Extremamente Longo");
    expect(res.text).toContain("R$ 49,90");

    // Right button: strictly "🛒"
    const cartBtn = prodRow[1];
    expect(cartBtn.text).toBe("🛒");
    expect(cartBtn.callback_data).toBe("cart_add:prod-99:1");
  });

  // Test 6 & 8: Adição do produto correto ao carrinho persistido e cálculo de ofertas
  it("Test 6 & 8: should add correct product to persisted cart, retain catalog page, and recalculate progressive discounts", async () => {
    mockDb.query.products.findFirst.mockResolvedValueOnce({
      id: "prod-1",
      storeId,
      status: "active",
      title: "Produto 1",
    });

    const mockCartWithProgressive = {
      id: "cart-persist-1",
      storeId,
      telegramUserId: "user-42",
      items: [{ id: "item-1", productId: "prod-1", quantity: 2, price: 10 }],
      subtotal: 20,
      total: 16,
      progressiveDiscount: 4,
      progressivePromotion: { savingsPercentage: 20 },
    };

    vi.mocked(CartService.addItemByTelegramUser).mockResolvedValueOnce(mockCartWithProgressive as any);

    const handled = await handleCartCallbackQuery(
      defaultCtx,
      "cb-add-prod-1",
      12345,
      100,
      "cart_add:prod-1:2", // Added from page 2 of catalog
      { id: "user-42" }
    );

    expect(handled).toBe(true);
    expect(CartService.addItemByTelegramUser).toHaveBeenCalledWith(storeId, "user-42", "prod-1", 1);

    // Toast popup presented with progressive discount info
    expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
      "cb-add-prod-1",
      expect.stringContaining("Desconto ativado! Economia de R$ 4,00")
    );

    // Message is NOT overwritten away from catalog because page was specified!
    expect(mockBotService.editMessageText).not.toHaveBeenCalled();
  });

  // Test 7: Rejeição de produto de outra loja ou indisponível
  it("Test 7: should reject product belonging to another store or inactive", async () => {
    vi.mocked(CartService.addItemByTelegramUser).mockRejectedValueOnce(
      new Error("Produto não encontrado ou pertencente a outra loja.")
    );

    const handled = await handleCartCallbackQuery(
      defaultCtx,
      "cb-foreign-prod",
      12345,
      100,
      "cart_add:foreign-prod-id:1",
      { id: "user-42" }
    );

    expect(handled).toBe(true);
    expect(CartService.addItemByTelegramUser).toHaveBeenCalledWith(
      storeId,
      "user-42",
      "foreign-prod-id",
      1
    );
    expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
      "cb-foreign-prod",
      "⚠️ Este produto não está mais disponível.",
      true
    );
  });

  // Test 9 & 10: Botão Voltar ao Menu em Catálogo, Carrinho e Meus Acessos preservando o menu inicial
  it("Test 9 & 10: should present 'Voltar ao Menu' in Catalog, Cart, and Accesses, and restore the exact 4-row initial menu", async () => {
    // 1. Catalog
    mockDb.query.products.findMany.mockResolvedValueOnce(generateProducts(2));
    const catalogRes = await formatCatalogMessage(storeId, miniAppUrl);
    const catalogLastRow = catalogRes.replyMarkup.inline_keyboard.slice(-1)[0];
    expect(catalogLastRow[0].text).toBe("↩️ Voltar ao Menu");
    expect(catalogLastRow[0].callback_data).toBe("start_menu");

    // 2. Cart (both empty and with items)
    const emptyCartRes = formatCartMessage({ items: [] } as any, miniAppUrl);
    const emptyCartLastRow = emptyCartRes.replyMarkup.inline_keyboard.slice(-1)[0];
    expect(emptyCartLastRow[0].text).toBe("↩️ Voltar ao Menu");
    expect(emptyCartLastRow[0].callback_data).toBe("start_menu");

    const fullCartRes = formatCartMessage(
      {
        items: [{ id: "i1", title: "P1", quantity: 1, price: 10, totalPrice: 10 }],
        subtotal: 10,
        total: 10,
        itemCount: 1,
      } as any,
      miniAppUrl
    );
    const fullCartLastRow = fullCartRes.replyMarkup.inline_keyboard.slice(-1)[0];
    expect(fullCartLastRow[0].text).toBe("↩️ Voltar ao Menu");
    expect(fullCartLastRow[0].callback_data).toBe("start_menu");

    // 3. Meus Acessos
    mockDb.query.telegramCustomers.findFirst.mockResolvedValueOnce(null);
    const accessesRes = await formatAccessesMessage(defaultCtx.store, "user-42", miniAppUrl);
    const accessesLastRow = accessesRes.replyMarkup.inline_keyboard.slice(-1)[0];
    expect(accessesLastRow[0].text).toBe("↩️ Voltar ao Menu");
    expect(accessesLastRow[0].callback_data).toBe("start_menu");

    // 4. Invoking start_menu callback query restores the exact 4-row initial menu
    await handleCartCallbackQuery(defaultCtx, "cb-menu", 12345, 100, "start_menu", { id: "user-42" });
    expect(mockBotService.editMessageText).toHaveBeenCalledWith(
      12345,
      100,
      expect.stringContaining("Menu Inicial"),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ text: "🛍️ ABRIR LOJA" })]),
          expect.arrayContaining([
            expect.objectContaining({ text: "🛒 Carrinho" }),
            expect.objectContaining({ text: "📺 Meus Acessos" }),
          ]),
          expect.arrayContaining([expect.objectContaining({ text: "📚 Catálogo" })]),
          expect.arrayContaining([expect.objectContaining({ text: "💬 Suporte" })]),
        ]),
      }),
      "Markdown"
    );
  });

  // Test 11: Deduplicação e segurança dos callbacks
  it("Test 11: should deduplicate rapid repeated clicks on callbacks", async () => {
    mockDb.query.products.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId,
      status: "active",
      title: "P1",
    });

    vi.mocked(CartService.addItemByTelegramUser).mockResolvedValue({ items: [] } as any);

    // First click with cbId
    const click1 = await handleCartCallbackQuery(
      defaultCtx,
      "cb-dedup-100",
      12345,
      100,
      "cart_add:prod-1:1",
      { id: "user-42" }
    );
    expect(click1).toBe(true);
    expect(CartService.addItemByTelegramUser).toHaveBeenCalledTimes(1);

    // Duplicate retry click with same cbId
    const click2 = await handleCartCallbackQuery(
      defaultCtx,
      "cb-dedup-100",
      12345,
      100,
      "cart_add:prod-1:1",
      { id: "user-42" }
    );
    expect(click2).toBe(true);
    // Did NOT call addItemByTelegramUser again!
    expect(CartService.addItemByTelegramUser).toHaveBeenCalledTimes(1);
  });

  // Test 12: Ausência do botão Ofertas no menu inicial
  it("Test 12: initial bot menu must NOT contain 'Ofertas', 'Oferta', or '🔥'", () => {
    const initialKb = getInitialBotKeyboard(defaultCtx.store, miniAppUrl);
    const allBtns = initialKb.inline_keyboard.flat();

    for (const btn of allBtns) {
      expect(btn.text.toLowerCase()).not.toContain("oferta");
      expect(btn.text).not.toContain("🔥");
      if ("callback_data" in btn && typeof btn.callback_data === "string") {
        expect(btn.callback_data).not.toContain("prog_");
      }
    }
  });

  // Test 13: Preservação do motor de preços progressivos
  it("Test 13: progressive pricing calculation engine remains completely functional", () => {
    const tiers = [
      { minQuantity: 2, priceCents: 1800 },
      { minQuantity: 3, priceCents: 2400 },
    ];
    const items = [
      { id: "1", priceCents: 1000 },
      { id: "2", priceCents: 1000 },
      { id: "3", priceCents: 1000 },
    ];

    const result = ProgressivePricingEngine.calculate(items, tiers);
    expect(result.coveredUnits).toBe(3);
    expect(result.savingsCents).toBe(600); // 3000 - 2400 = 600
    expect(result.finalPriceCents).toBe(2400);
  });
});
