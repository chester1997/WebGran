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
  formatCartMessage,
  formatProgressiveOfferMessage,
  formatProgressiveProductsMessage,
  handleProgressiveOffersCommand,
  handleCartCallbackQuery,
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { ComboService } from "@/lib/combos/combo-service";
import {
  isDuplicateTelegramCallback,
  isDuplicateTelegramUpdate,
  clearProcessedTelegramUpdatesForTest,
} from "../update-dedup";

describe("WebGran — Fase E: Ofertas Progressivas no Bot do Telegram", () => {
  const storeId = "store-alpha-100";
  const miniAppUrl = "https://webgran.online/miniapp/loja-alpha";

  const mockBotService = {
    sendMessage: vi.fn().mockResolvedValue({}),
    editMessageText: vi.fn().mockResolvedValue({}),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
  };

  const mockCtx = {
    store: {
      id: storeId,
      name: "Loja Alpha",
      slug: "loja-alpha",
    },
    botService: mockBotService as any,
    miniAppUrl,
  };

  const telegramUser = {
    id: 99887766,
    first_name: "Carlos",
    username: "carlos_vip",
  };

  // 3 Eligible Products
  const prod1 = {
    id: "prod-1",
    storeId,
    title: "Canal VIP Cinema",
    price: "5.00",
    status: "active",
  };

  const prod2 = {
    id: "prod-2",
    storeId,
    title: "Grupo VIP Séries",
    price: "5.00",
    status: "active",
  };

  const prod3 = {
    id: "prod-3",
    storeId,
    title: "Acesso VIP Documentários",
    price: "5.00",
    status: "active",
  };

  // Ineligible Product (different store or not in eligible list)
  const prodIneligible = {
    id: "prod-extra-non-eligible",
    storeId,
    title: "Ebook Não Participante",
    price: "10.00",
    status: "active",
  };

  // Active progressive promotion: 3 items for R$ 12,00 (regular: 3x5 = 15, saving: 3,00) and 5 items for R$ 18,00
  const progressivePromo = {
    id: "promo-prog-1",
    storeId,
    title: "Super Combo Mix: Leve Mais por Menos",
    slug: "super-combo-mix",
    description: "Descontos progressivos exclusivos em todos os canais VIP!",
    eligibilityMode: "all_products" as const,
    eligibleProductIds: [] as string[],
    tiers: [
      { id: "t-3", minQuantity: 3, priceCents: 1200 }, // R$ 12,00
      { id: "t-5", minQuantity: 5, priceCents: 1800 }, // R$ 18,00
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedTelegramUpdatesForTest();
  });

  // =========================================================================
  // 1. LISTAGEM DE PROMOÇÕES E FAIXAS
  // =========================================================================
  describe("1. Listagem de Promoções e Faixas (/ofertas)", () => {
    it("deve retornar mensagem amigável quando não houver oferta progressiva ativa", async () => {
      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValueOnce(null);

      const { text, replyMarkup } = await formatProgressiveOfferMessage(storeId, miniAppUrl);

      expect(text).toContain("Ofertas Progressivas");
      expect(text).toContain("Nenhuma oferta progressiva por quantidade está ativa no momento");
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("cart_cat");
      expect(replyMarkup.inline_keyboard[0][1].callback_data).toBe("combo_list");
    });

    it("deve formatar detalhes da oferta ativa com tabela de faixas, preços totais e unitários", async () => {
      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValueOnce(progressivePromo);

      const { text, replyMarkup } = await formatProgressiveOfferMessage(storeId, miniAppUrl);

      expect(text).toContain("Super Combo Mix: Leve Mais por Menos");
      expect(text).toContain("Descontos progressivos exclusivos");
      expect(text).toContain("• *3 itens* por *R$ 12,00* (R$ 4,00/un)");
      expect(text).toContain("• *5 itens* por *R$ 18,00* (R$ 3,60/un)");
      expect(text).toContain("Válido para *todos* os produtos da loja!");

      // Botões de ação direta
      expect(replyMarkup.inline_keyboard[0][0].text).toContain("Ver Produtos Elegíveis");
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("prog_prods");
      expect(replyMarkup.inline_keyboard[1][0].callback_data).toBe("cart_view");
    });

    it("deve responder ao comando /ofertas enviando a mensagem formatada para o cliente", async () => {
      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValueOnce(progressivePromo);

      await handleProgressiveOffersCommand(mockCtx, 123456);

      expect(mockBotService.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining("Super Combo Mix"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  // =========================================================================
  // 2. SELEÇÃO DE PRODUTOS DIFERENTES ELEGÍVEIS
  // =========================================================================
  describe("2. Seleção de Produtos Elegíveis", () => {
    it("deve listar produtos elegíveis com botões inline de adição direta ao carrinho", async () => {
      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValueOnce(progressivePromo);
      mockDb.query.products.findMany.mockResolvedValueOnce([prod1, prod2, prod3]);

      const { text, replyMarkup } = await formatProgressiveProductsMessage(storeId, miniAppUrl);

      expect(text).toContain("Produtos Elegíveis");
      expect(replyMarkup.inline_keyboard[0][0].text).toContain("Canal VIP Cinema — R$ 5,00");
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("cart_add:prod-1");
      expect(replyMarkup.inline_keyboard[1][0].text).toContain("Grupo VIP Séries — R$ 5,00");
      expect(replyMarkup.inline_keyboard[1][0].callback_data).toBe("cart_add:prod-2");
      expect(replyMarkup.inline_keyboard[2][0].text).toContain("Acesso VIP Documentários — R$ 5,00");
      expect(replyMarkup.inline_keyboard[2][0].callback_data).toBe("cart_add:prod-3");
    });

    it("deve respeitar modo specific_products filtrando apenas os produtos autorizados na promoção", async () => {
      const specificPromo = {
        ...progressivePromo,
        eligibilityMode: "specific_products" as const,
        eligibleProductIds: ["prod-1", "prod-2"],
      };

      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValueOnce(specificPromo);
      mockDb.query.products.findMany.mockResolvedValueOnce([prod1, prod2]);

      const { replyMarkup } = await formatProgressiveProductsMessage(storeId, miniAppUrl);

      expect(replyMarkup.inline_keyboard).toHaveLength(4); // 2 produtos + faixas + nav
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("cart_add:prod-1");
      expect(replyMarkup.inline_keyboard[1][0].callback_data).toBe("cart_add:prod-2");
    });

    it("deve responder callback prog_view e prog_prods via handleCartCallbackQuery", async () => {
      vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(progressivePromo);
      mockDb.query.products.findMany.mockResolvedValue([prod1, prod2]);

      // prog_view
      const handledView = await handleCartCallbackQuery(
        mockCtx,
        "cb-view-1",
        123456,
        10,
        "prog_view",
        telegramUser
      );
      expect(handledView).toBe(true);
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        10,
        expect.stringContaining("Super Combo Mix"),
        expect.any(Object),
        "Markdown"
      );

      // prog_prods
      const handledProds = await handleCartCallbackQuery(
        mockCtx,
        "cb-prods-1",
        123456,
        10,
        "prog_prods",
        telegramUser
      );
      expect(handledProds).toBe(true);
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        10,
        expect.stringContaining("Produtos Elegíveis"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  // =========================================================================
  // 3. ATUALIZAÇÃO DO CARRINHO E DO PROGRESSO
  // =========================================================================
  describe("3. Atualização do Carrinho e do Progresso", () => {
    it("deve exibir mensagem de progresso quando o carrinho estiver abaixo da faixa: 'Faltam 2 produtos para desbloquear 3 por R$ 12,00'", () => {
      const cartBelow = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "canal-vip-cinema",
            title: "Canal VIP Cinema",
            price: 5.0,
            quantity: 1,
            coverUrl: null,
            storeId,
          },
        ],
        subtotal: 5.0,
        progressiveDiscount: 0,
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 0,
          savingsPercentage: 0,
          appliedTiers: [],
          nextTierProgress: {
            targetQuantity: 3,
            unitsRemaining: 2,
            targetTierPriceCents: 1200,
            projectedAdditionalSavingsCents: 300,
          },
        },
        total: 5.0,
        itemCount: 1,
      };

      const { text } = formatCartMessage(cartBelow, miniAppUrl);

      expect(text).toContain("💰 *Subtotal:* R$ 5,00");
      expect(text).toContain("💵 *Total:* *R$ 5,00*");
      expect(text).toContain("Faltam *2 produtos* para desbloquear *3 por R$ 12,00*!");
    });

    it("deve atualizar para 'Falta 1 produto' quando adicionar o segundo produto diferente", () => {
      const cartTwoItems = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "canal-vip-cinema",
            title: "Canal VIP Cinema",
            price: 5.0,
            quantity: 1,
            coverUrl: null,
            storeId,
          },
          {
            id: "prod-2",
            slug: "grupo-vip-series",
            title: "Grupo VIP Séries",
            price: 5.0,
            quantity: 1,
            coverUrl: null,
            storeId,
          },
        ],
        subtotal: 10.0,
        progressiveDiscount: 0,
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 0,
          savingsPercentage: 0,
          appliedTiers: [],
          nextTierProgress: {
            targetQuantity: 3,
            unitsRemaining: 1,
            targetTierPriceCents: 1200,
            projectedAdditionalSavingsCents: 300,
          },
        },
        total: 10.0,
        itemCount: 2,
      };

      const { text } = formatCartMessage(cartTwoItems, miniAppUrl);

      expect(text).toContain("💰 *Subtotal:* R$ 10,00");
      expect(text).toContain("Falta *1 produto* para desbloquear *3 por R$ 12,00*!");
    });

    it("deve aplicar o desconto ao atingir 3 produtos diferentes elegíveis e exibir economia", () => {
      const cartUnlocked = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 1, coverUrl: null, storeId },
          { id: "prod-2", slug: "p2", title: "Grupo VIP Séries", price: 5.0, quantity: 1, coverUrl: null, storeId },
          { id: "prod-3", slug: "p3", title: "Acesso VIP Documentários", price: 5.0, quantity: 1, coverUrl: null, storeId },
        ],
        subtotal: 15.0,
        progressiveDiscount: 3.0,
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 3.0,
          savingsPercentage: 20,
          appliedTiers: [
            {
              tierId: "t-3",
              minQuantity: 3,
              priceCents: 1200,
              count: 1,
              totalCoveredUnits: 3,
              totalPriceCents: 1200,
            },
          ],
          nextTierProgress: {
            targetQuantity: 5,
            unitsRemaining: 2,
            targetTierPriceCents: 1800,
            projectedAdditionalSavingsCents: 400,
          },
        },
        total: 12.0,
        itemCount: 3,
      };

      const { text } = formatCartMessage(cartUnlocked, miniAppUrl);

      expect(text).toContain("💰 *Subtotal:* R$ 15,00");
      expect(text).toContain("🎉 *Desconto Progressivo:* -R$ 3,00 (20% OFF)");
      expect(text).toContain("💵 *Total:* *R$ 12,00*");
      expect(text).toContain("✨ *Você economizou:* R$ 3,00!");
      expect(text).toContain("🏷️ *Faixa aplicada:* 1x (3 un por R$ 12,00)");
      // Exibe também a próxima faixa (5 por R$ 18,00)
      expect(text).toContain("Faltam *2 produtos* para desbloquear *5 por R$ 18,00*!");
    });
  });

  // =========================================================================
  // 4. QUANTIDADES ABAIXO, DENTRO E ACIMA DAS FAIXAS
  // =========================================================================
  describe("4. Quantidades Abaixo, Dentro e Acima das Faixas", () => {
    it("deve gerenciar carrinho com 4 itens (1 acima da faixa de 3): cobre 3 e cobra 1 a preço regular", () => {
      const cartFourUnits = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 2, coverUrl: null, storeId },
          { id: "prod-2", slug: "p2", title: "Grupo VIP Séries", price: 5.0, quantity: 2, coverUrl: null, storeId },
        ],
        subtotal: 20.0, // 4 x 5,00 = 20,00
        progressiveDiscount: 3.0, // 3 por 12,00 + 1 por 5,00 = 17,00 (desconto = 3,00)
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 3.0,
          savingsPercentage: 15,
          appliedTiers: [
            {
              tierId: "t-3",
              minQuantity: 3,
              priceCents: 1200,
              count: 1,
              totalCoveredUnits: 3,
              totalPriceCents: 1200,
            },
          ],
          nextTierProgress: {
            targetQuantity: 5,
            unitsRemaining: 1,
            targetTierPriceCents: 1800,
            projectedAdditionalSavingsCents: 400,
          },
        },
        total: 17.0,
        itemCount: 4,
      };

      const { text } = formatCartMessage(cartFourUnits, miniAppUrl);

      expect(text).toContain("💰 *Subtotal:* R$ 20,00");
      expect(text).toContain("🎉 *Desconto Progressivo:* -R$ 3,00");
      expect(text).toContain("💵 *Total:* *R$ 17,00*");
      expect(text).toContain("Falta *1 produto* para desbloquear *5 por R$ 18,00*!");
    });

    it("deve permitir alterar quantidades via callback cart_inc e cart_dec recalculando pelo servidor", async () => {
      mockDb.query.telegramCustomers.findFirst.mockResolvedValue({
        id: "cust-1",
        storeId,
        telegramUserId: "99887766",
      });

      // Simula getCart retornando 2 itens após cart_inc
      vi.spyOn(CartService, "addItemByTelegramUser").mockResolvedValueOnce({
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 2, coverUrl: null, storeId },
        ],
        subtotal: 10.0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 10.0,
        itemCount: 2,
      });

      const handledInc = await handleCartCallbackQuery(
        mockCtx,
        "cb-inc-1",
        123456,
        20,
        "cart_inc:prod-1",
        telegramUser
      );

      expect(handledInc).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-inc-1", "➕ Quantidade aumentada!");
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        20,
        expect.stringContaining("Subtotal:* R$ 10,00"),
        expect.any(Object),
        "Markdown"
      );
    });

    it("deve remover item completamente via callback cart_rem e atualizar interface", async () => {
      vi.spyOn(CartService, "removeItemByTelegramUser").mockResolvedValueOnce({
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 0,
        itemCount: 0,
      });

      const handledRem = await handleCartCallbackQuery(
        mockCtx,
        "cb-rem-1",
        123456,
        21,
        "cart_rem:prod-1",
        telegramUser
      );

      expect(handledRem).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-rem-1", "🗑️ Item removido!");
      expect(mockBotService.editMessageText).toHaveBeenCalledWith(
        123456,
        21,
        expect.stringContaining("Seu Carrinho está vazio!"),
        expect.any(Object),
        "Markdown"
      );
    });
  });

  // =========================================================================
  // 5. PRODUTOS INELEGÍVEIS E ISOLAMENTO POR LOJA
  // =========================================================================
  describe("5. Produtos Inelegíveis e Isolamento por Loja", () => {
    it("não deve conceder desconto progressivo para produtos inelegíveis em specific_products", () => {
      const cartWithIneligible = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [
          // 2 itens elegíveis (faixa requer 3)
          { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 2, coverUrl: null, storeId },
          // 1 item inelegível
          { id: "prod-extra-non-eligible", slug: "ebook", title: "Ebook Não Participante", price: 10.0, quantity: 1, coverUrl: null, storeId },
        ],
        subtotal: 20.0, // 2x5 + 10 = 20,00
        progressiveDiscount: 0, // Inelegível não ativou a faixa de 3
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 0,
          savingsPercentage: 0,
          appliedTiers: [],
          nextTierProgress: {
            targetQuantity: 3,
            unitsRemaining: 1, // Ainda falta 1 produto elegível
            targetTierPriceCents: 1200,
            projectedAdditionalSavingsCents: 300,
          },
        },
        total: 20.0,
        itemCount: 3,
      };

      const { text } = formatCartMessage(cartWithIneligible, miniAppUrl);

      expect(text).toContain("💰 *Subtotal:* R$ 20,00");
      expect(text).toContain("💵 *Total:* *R$ 20,00*");
      expect(text).not.toContain("🎉 *Desconto Progressivo:*");
      expect(text).toContain("Falta *1 produto* para desbloquear *3 por R$ 12,00*!");
    });

    it("deve proteger isolamento por loja: rejeitar adição se produto pertencer a outra loja", async () => {
      vi.spyOn(CartService, "addItemByTelegramUser").mockRejectedValueOnce(
        new Error("Produto não encontrado ou pertencente a outra loja.")
      );

      const handled = await handleCartCallbackQuery(
        mockCtx,
        "cb-store-isolation",
        123456,
        30,
        "cart_add:prod-from-store-beta",
        telegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-store-isolation",
        "⚠️ Este produto não está mais disponível.",
        true
      );
    });
  });

  // =========================================================================
  // 6. CALLBACKS REPETIDOS E UPDATES DUPLICADOS
  // =========================================================================
  describe("6. Callbacks Repetidos e Deduplicação", () => {
    it("deve deduplicar callbacks idênticos com isDuplicateTelegramCallback", () => {
      const cbId = "callback-query-unique-42";

      expect(isDuplicateTelegramCallback(cbId)).toBe(false);
      expect(isDuplicateTelegramCallback(cbId)).toBe(true);
      expect(isDuplicateTelegramCallback(cbId)).toBe(true);
    });

    it("deve ignorar execução repetida de callback no handler sem adicionar itens 2 vezes", async () => {
      vi.spyOn(CartService, "addItemByTelegramUser").mockResolvedValue({
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [{ id: "prod-1", slug: "p1", title: "Canal VIP", price: 5.0, quantity: 1, coverUrl: null, storeId }],
        subtotal: 5.0,
        total: 5.0,
        itemCount: 1,
      });

      const duplicateCbId = "cb-rapid-double-click-99";

      // 1ª chamada
      const first = await handleCartCallbackQuery(
        mockCtx,
        duplicateCbId,
        123456,
        40,
        "cart_add:prod-1",
        telegramUser
      );
      expect(first).toBe(true);
      expect(CartService.addItemByTelegramUser).toHaveBeenCalledTimes(1);

      // 2ª chamada idêntica (duplo clique de rede)
      const second = await handleCartCallbackQuery(
        mockCtx,
        duplicateCbId,
        123456,
        40,
        "cart_add:prod-1",
        telegramUser
      );
      expect(second).toBe(true);
      // NÃO chamou addItemByTelegramUser novamente
      expect(CartService.addItemByTelegramUser).toHaveBeenCalledTimes(1);
    });

    it("deve deduplicar update_id no nível de webhook com isDuplicateTelegramUpdate", () => {
      const updateId = 777666;
      expect(isDuplicateTelegramUpdate(updateId)).toBe(false);
      expect(isDuplicateTelegramUpdate(updateId)).toBe(true);
    });
  });

  // =========================================================================
  // 7. CONTINUIDADE DO FLUXO DE CHECKOUT
  // =========================================================================
  describe("7. Continuidade do Fluxo de Checkout", () => {
    it("deve conter botão direto de checkout no Mini App apontando para /miniapp/[slug]/cart", () => {
      const cart = {
        id: "cart-1",
        storeId,
        customerId: "cust-1",
        items: [{ id: "prod-1", slug: "p1", title: "Canal VIP", price: 5.0, quantity: 3, coverUrl: null, storeId }],
        subtotal: 15.0,
        progressiveDiscount: 3.0,
        total: 12.0,
        itemCount: 3,
      };

      const { replyMarkup } = formatCartMessage(cart, miniAppUrl);

      // Botão de checkout/Mini App
      const checkoutRow = replyMarkup.inline_keyboard[1];
      expect(checkoutRow[0].web_app.url).toBe("https://webgran.online/miniapp/loja-alpha/cart");
    });
  });

  // =========================================================================
  // 8. COMPATIBILIDADE COM COMBOS TRADICIONAIS
  // =========================================================================
  describe("8. Compatibilidade com Combos Tradicionais", () => {
    it("deve coexistir produtos de oferta progressiva e combos tradicionais no mesmo carrinho", () => {
      const mixedCart = {
        id: "cart-mixed-1",
        storeId,
        customerId: "cust-1",
        items: [
          // 3 itens progressivos elegíveis (R$ 15 -> R$ 12)
          { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 3, coverUrl: null, storeId },
          // 1 Combo tradicional (R$ 49,90)
          {
            id: "combo-pack-vip",
            slug: "pack-vip",
            title: "Pack VIP Completo",
            price: 49.9,
            quantity: 1,
            coverUrl: null,
            storeId,
            isCombo: true,
            comboId: "combo-pack-vip",
          },
        ],
        subtotal: 64.9, // 15,00 + 49,90 = 64,90
        progressiveDiscount: 3.0,
        progressivePromotion: {
          id: progressivePromo.id,
          title: progressivePromo.title,
          slug: progressivePromo.slug,
          savings: 3.0,
          savingsPercentage: 20,
          appliedTiers: [
            {
              tierId: "t-3",
              minQuantity: 3,
              priceCents: 1200,
              count: 1,
              totalCoveredUnits: 3,
              totalPriceCents: 1200,
            },
          ],
          nextTierProgress: null,
        },
        total: 61.9, // 64,90 - 3,00 = 61,90
        itemCount: 4,
      };

      const { text, replyMarkup } = formatCartMessage(mixedCart, miniAppUrl);

      // Exibe combo e produtos
      expect(text).toContain("🎁 *[Combo]* *1x* Pack VIP Completo");
      expect(text).toContain("• *3x* Canal VIP Cinema");
      expect(text).toContain("💰 *Subtotal:* R$ 64,90");
      expect(text).toContain("🎉 *Desconto Progressivo:* -R$ 3,00");
      expect(text).toContain("💵 *Total:* *R$ 61,90*");

      // Botões para combo tradicional e produtos
      const comboRow = replyMarkup.inline_keyboard[1]; // Linha do segundo item
      expect(comboRow[2].callback_data).toBe("combo_add:combo-pack-vip");
    });
  });
});
