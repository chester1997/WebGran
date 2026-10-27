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

import { formatCartMessage, handleCartCallbackQuery } from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { ComboService } from "@/lib/combos/combo-service";
import { ProgressivePricingEngine } from "@/lib/combos/pricing-engine";

describe("WebGran — Fase J: Exibir Ofertas Progressivas Antes de Desbloquear a Faixa", () => {
  const storeId = "store-alpha-fase-j";
  const miniAppUrl = "https://webgran.test/miniapp/loja-alpha";

  const promoWithTwoTiers = {
    id: "promo-prog-j",
    storeId,
    title: "Compre Mais por Menos",
    slug: "compre-mais-por-menos",
    description: "Descontos progressivos a partir de 3 itens",
    eligibilityMode: "all_products" as const,
    eligibleProductIds: [] as string[],
    tiers: [
      { id: "tier-1", comboId: "promo-prog-j", minQuantity: 3, priceCents: 1200, position: 1 },
      { id: "tier-2", comboId: "promo-prog-j", minQuantity: 5, priceCents: 1500, position: 2 },
    ],
  };

  const mockBotService = {
    sendMessage: vi.fn().mockResolvedValue({}),
    editMessageText: vi.fn().mockResolvedValue({}),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
  };

  const mockCtx = {
    store: {
      id: storeId,
      name: "Loja Alpha Fase J",
      slug: "loja-alpha-fase-j",
    },
    botService: mockBotService as any,
    miniAppUrl,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Carrinho com 1 produto elegível para uma faixa de 3: mostrar que faltam 2
  it("1. Carrinho com 1 produto elegível para uma faixa de 3: deve exibir que faltam 2 produtos e a economia estimada", async () => {
    // 1 produto de R$ 5,00
    const items = [{ productId: "prod-1", quantity: 1, price: 5.0, title: "Canal VIP Cinema" }];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-1", storeId, title: "Canal VIP Cinema", price: "5.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.discountAmount).toBe(0);
    expect(evalResult.hasPromotion).toBe(true);
    expect(evalResult.pricingResult).toBeDefined();
    expect(evalResult.pricingResult?.nextTierProgress).toEqual({
      targetQuantity: 3,
      unitsRemaining: 2,
      targetTierPriceCents: 1200,
      projectedAdditionalSavingsCents: 300, // 3 * 5,00 = 15,00 - 12,00 = 3,00 de economia estimada
    });

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 5.0,
      progressiveDiscount: 0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 0,
        savingsPercentage: 0,
        appliedTiers: [],
        nextTierProgress: evalResult.pricingResult!.nextTierProgress,
      },
      total: 5.0,
      itemCount: 1,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);

    expect(text).toContain("💰 *Subtotal:* R$ 5,00");
    expect(text).toContain("💵 *Total:* *R$ 5,00*");
    expect(text).toContain("🚀 *Oferta progressiva:* Faltam *2 produtos* para desbloquear *3 por R$ 12,00*!");
    expect(text).toContain("Economia estimada de R$ 3,00 ao completar a faixa!");
    // Nenhum desconto fictício deve ser subtraído
    expect(text).not.toContain("Desconto Progressivo:");
  });

  // 2. Carrinho com 2 produtos elegíveis: mostrar que falta 1
  it("2. Carrinho com 2 produtos elegíveis: deve exibir que falta 1 produto para desbloquear a faixa", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 5.0, title: "Canal VIP Cinema" },
      { productId: "prod-2", quantity: 1, price: 5.0, title: "Grupo VIP Séries" },
    ];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-1", storeId, title: "Canal VIP Cinema", price: "5.00", status: "active" },
      { id: "prod-2", storeId, title: "Grupo VIP Séries", price: "5.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.discountAmount).toBe(0);
    expect(evalResult.pricingResult?.nextTierProgress).toEqual({
      targetQuantity: 3,
      unitsRemaining: 1,
      targetTierPriceCents: 1200,
      projectedAdditionalSavingsCents: 300,
    });

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "Grupo VIP Séries", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 10.0,
      progressiveDiscount: 0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 0,
        savingsPercentage: 0,
        appliedTiers: [],
        nextTierProgress: evalResult.pricingResult!.nextTierProgress,
      },
      total: 10.0,
      itemCount: 2,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);

    expect(text).toContain("💰 *Subtotal:* R$ 10,00");
    expect(text).toContain("💵 *Total:* *R$ 10,00*");
    expect(text).toContain("🔥 *Oferta progressiva:* Falta *1 produto* para desbloquear *3 por R$ 12,00*!");
    expect(text).toContain("Economia estimada de R$ 3,00 ao completar a faixa!");
  });

  // 3. Carrinho com 3 produtos: mostrar a faixa desbloqueada e a economia correta
  it("3. Carrinho com 3 produtos: deve exibir faixa desbloqueada, economia real de R$ 3,00 e o progresso para a próxima faixa", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 5.0, title: "Canal VIP Cinema" },
      { productId: "prod-2", quantity: 1, price: 5.0, title: "Grupo VIP Séries" },
      { productId: "prod-3", quantity: 1, price: 5.0, title: "Acesso VIP Cursos" },
    ];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-1", storeId, title: "Canal VIP Cinema", price: "5.00", status: "active" },
      { id: "prod-2", storeId, title: "Grupo VIP Séries", price: "5.00", status: "active" },
      { id: "prod-3", storeId, title: "Acesso VIP Cursos", price: "5.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.discountAmount).toBe(3.0); // 3 * 5 = 15 - 12 = 3
    expect(evalResult.pricingResult?.finalPriceCents).toBe(1200);
    expect(evalResult.pricingResult?.appliedTiers).toHaveLength(1);
    expect(evalResult.pricingResult?.nextTierProgress).toEqual({
      targetQuantity: 5,
      unitsRemaining: 2,
      targetTierPriceCents: 1500,
      projectedAdditionalSavingsCents: 700, // 5 x 5 = 25 - 15 = 10 total savings - 3 current savings = 7 adicional
    });

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "Canal VIP Cinema", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "Grupo VIP Séries", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-3", slug: "p3", title: "Acesso VIP Cursos", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 15.0,
      progressiveDiscount: 3.0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 3.0,
        savingsPercentage: 20,
        appliedTiers: evalResult.pricingResult!.appliedTiers,
        nextTierProgress: evalResult.pricingResult!.nextTierProgress,
      },
      total: 12.0,
      itemCount: 3,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);

    expect(text).toContain("💰 *Subtotal:* R$ 15,00");
    expect(text).toContain("🎉 *Desconto Progressivo:* -R$ 3,00 (20% OFF)");
    expect(text).toContain("💵 *Total:* *R$ 12,00*");
    expect(text).toContain("✨ *Você economizou:* R$ 3,00!");
    expect(text).toContain("🎉 *Oferta desbloqueada:* 3 produtos por R$ 12,00! Você economizou R$ 3,00.");
    expect(text).toContain("🚀 *Próxima faixa:* Faltam *2 produtos* para desbloquear *5 por R$ 15,00*!");
    expect(text).toContain("Economia adicional estimada de R$ 7,00!");
  });

  // 4. Carrinho com 4 produtos e uma faixa seguinte de 5: mostrar que falta 1 para a próxima
  it("4. Carrinho com 4 produtos e faixa seguinte de 5: deve mostrar 1 desbloqueada e falta 1 para a próxima", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 5.0, title: "P1" },
      { productId: "prod-2", quantity: 1, price: 5.0, title: "P2" },
      { productId: "prod-3", quantity: 1, price: 5.0, title: "P3" },
      { productId: "prod-4", quantity: 1, price: 5.0, title: "P4" },
    ];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-1", storeId, title: "P1", price: "5.00", status: "active" },
      { id: "prod-2", storeId, title: "P2", price: "5.00", status: "active" },
      { id: "prod-3", storeId, title: "P3", price: "5.00", status: "active" },
      { id: "prod-4", storeId, title: "P4", price: "5.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.discountAmount).toBe(3.0); // 3 por 12 + 1 por 5 = 17 (desconto de 3 sobre subtotal 20)
    expect(evalResult.pricingResult?.nextTierProgress).toEqual({
      targetQuantity: 5,
      unitsRemaining: 1,
      targetTierPriceCents: 1500,
      projectedAdditionalSavingsCents: 700,
    });

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "P1", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "P2", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-3", slug: "p3", title: "P3", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-4", slug: "p4", title: "P4", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 20.0,
      progressiveDiscount: 3.0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 3.0,
        savingsPercentage: 15,
        appliedTiers: evalResult.pricingResult!.appliedTiers,
        nextTierProgress: evalResult.pricingResult!.nextTierProgress,
      },
      total: 17.0,
      itemCount: 4,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);

    expect(text).toContain("💰 *Subtotal:* R$ 20,00");
    expect(text).toContain("💵 *Total:* *R$ 17,00*");
    expect(text).toContain("🎉 *Oferta desbloqueada:* 3 produtos por R$ 12,00! Você economizou R$ 3,00.");
    expect(text).toContain("🔥 *Próxima faixa:* Falta *1 produto* para desbloquear *5 por R$ 15,00*!");
    expect(text).toContain("Economia adicional estimada de R$ 7,00!");
  });

  // 5. Carrinho com 5 produtos: mostrar a faixa correspondente
  it("5. Carrinho com 5 produtos: deve desbloquear a segunda faixa de 5 por R$ 15,00 com economia de R$ 10,00", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 5.0, title: "P1" },
      { productId: "prod-2", quantity: 1, price: 5.0, title: "P2" },
      { productId: "prod-3", quantity: 1, price: 5.0, title: "P3" },
      { productId: "prod-4", quantity: 1, price: 5.0, title: "P4" },
      { productId: "prod-5", quantity: 1, price: 5.0, title: "P5" },
    ];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-1", storeId, title: "P1", price: "5.00", status: "active" },
      { id: "prod-2", storeId, title: "P2", price: "5.00", status: "active" },
      { id: "prod-3", storeId, title: "P3", price: "5.00", status: "active" },
      { id: "prod-4", storeId, title: "P4", price: "5.00", status: "active" },
      { id: "prod-5", storeId, title: "P5", price: "5.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.discountAmount).toBe(10.0); // 5 x 5 = 25 - 15 = 10
    expect(evalResult.pricingResult?.finalPriceCents).toBe(1500);
    expect(evalResult.pricingResult?.appliedTiers[0].minQuantity).toBe(5);

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "P1", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "P2", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-3", slug: "p3", title: "P3", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-4", slug: "p4", title: "P4", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-5", slug: "p5", title: "P5", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 25.0,
      progressiveDiscount: 10.0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 10.0,
        savingsPercentage: 40,
        appliedTiers: evalResult.pricingResult!.appliedTiers,
        nextTierProgress: evalResult.pricingResult!.nextTierProgress,
      },
      total: 15.0,
      itemCount: 5,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);

    expect(text).toContain("💰 *Subtotal:* R$ 25,00");
    expect(text).toContain("🎉 *Desconto Progressivo:* -R$ 10,00 (40% OFF)");
    expect(text).toContain("💵 *Total:* *R$ 15,00*");
    expect(text).toContain("✨ *Você economizou:* R$ 10,00!");
    expect(text).toContain("🎉 *Oferta desbloqueada:* 5 produtos por R$ 15,00! Você economizou R$ 10,00.");
  });

  // 6. Carrinho vazio
  it("6. Carrinho vazio: não deve inventar quantidade de progresso sem contexto", () => {
    const emptyCart = {
      id: "cart-empty",
      storeId,
      customerId: "cust-1",
      items: [],
      subtotal: 0,
      progressiveDiscount: 0,
      progressivePromotion: null,
      total: 0,
      itemCount: 0,
    };

    const { text, replyMarkup } = formatCartMessage(emptyCart, miniAppUrl);

    expect(text).toContain("🛒 *Seu Carrinho está vazio!*");
    expect(text).not.toContain("Falta");
    expect(text).not.toContain("Faltam");
    expect(text).not.toContain("desbloquear");
    expect(replyMarkup.inline_keyboard).toBeDefined();
  });

  // 7. Produtos não elegíveis para a oferta
  it("7. Produtos não elegíveis para a oferta: não calcula progresso nem desconto", async () => {
    const promoSpecific = {
      ...promoWithTwoTiers,
      eligibilityMode: "specific_products" as const,
      eligibleProductIds: ["prod-eligible-1", "prod-eligible-2"],
    };

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoSpecific);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-ineligible-9", storeId, title: "Produto Inelegível", price: "5.00", status: "active" },
    ]);

    const items = [{ productId: "prod-ineligible-9", quantity: 2, price: 5.0, title: "Produto Inelegível" }];
    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.hasPromotion).toBe(false);
    expect(evalResult.discountAmount).toBe(0);
    expect(evalResult.pricingResult).toBeNull();

    const cart = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-ineligible-9", slug: "p-ineligible", title: "Produto Inelegível", price: 5.0, quantity: 2, coverUrl: null, storeId },
      ],
      subtotal: 10.0,
      progressiveDiscount: 0,
      progressivePromotion: null,
      total: 10.0,
      itemCount: 2,
    };

    const { text } = formatCartMessage(cart, miniAppUrl);
    expect(text).not.toContain("Oferta progressiva:");
    expect(text).not.toContain("Desconto Progressivo:");
    expect(text).toContain("💵 *Total:* *R$ 10,00*");
  });

  // 8. Produtos de lojas diferentes (Multi-tenant)
  it("8. Produtos de lojas diferentes: isolamento impede que produtos de outra loja gerem progresso ou desconto", async () => {
    // Consulta para loja sem promoção progressiva cadastrada
    const evalBeta = await ComboService.calculateProgressivePricingForCart("store-beta-isolated", [
      { productId: "prod-beta-1", quantity: 2, price: 5.0, title: "Produto Beta" },
    ]);

    expect(evalBeta.hasPromotion).toBe(false);
    expect(evalBeta.discountAmount).toBe(0);
    expect(evalBeta.pricingResult).toBeNull();

    // Na consulta do carrinho da loja alpha, itens de outra loja são filtrados no CartService
    mockDb.query.carts.findFirst.mockResolvedValue({
      id: "cart-alpha-1",
      storeId,
      customerId: "cust-1",
    });

    mockDb.query.cartItems.findMany.mockResolvedValue([
      {
        id: "item-beta",
        productId: "prod-beta",
        quantity: 2,
        product: { id: "prod-beta", storeId: "store-beta", status: "active", price: "5.00" },
      },
    ]);

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        catch: vi.fn(),
      }),
    });

    const cartAlpha = await CartService.getCart(storeId, "cust-1");
    // Itens de outra loja são descartados, carrinho fica vazio
    expect(cartAlpha.items).toHaveLength(0);
    expect(cartAlpha.progressiveDiscount).toBe(0);
    expect(cartAlpha.progressivePromotion).toBeNull();
  });

  // 9. Remoção de um produto e recálculo do progresso
  it("9. Remoção de um produto e recálculo do progresso: transiciona corretamente entre faixas", async () => {
    // Estado inicial: 3 produtos -> faixa de 3 desbloqueada
    const cart3 = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "P1", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "P2", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-3", slug: "p3", title: "P3", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 15.0,
      progressiveDiscount: 3.0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 3.0,
        savingsPercentage: 20,
        appliedTiers: [{ tierId: "tier-1", minQuantity: 3, priceCents: 1200, count: 1, totalCoveredUnits: 3, totalPriceCents: 1200 }],
        nextTierProgress: {
          targetQuantity: 5,
          unitsRemaining: 2,
          targetTierPriceCents: 1500,
          projectedAdditionalSavingsCents: 700,
        },
      },
      total: 12.0,
      itemCount: 3,
    };

    const text3 = formatCartMessage(cart3, miniAppUrl).text;
    expect(text3).toContain("🎉 *Oferta desbloqueada:* 3 produtos por R$ 12,00!");

    // Após remover 1 item -> sobram 2 produtos -> volta a faltar 1 para desbloquear 3 por R$ 12,00
    const cart2 = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "P1", price: 5.0, quantity: 1, coverUrl: null, storeId },
        { id: "prod-2", slug: "p2", title: "P2", price: 5.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 10.0,
      progressiveDiscount: 0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
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

    const text2 = formatCartMessage(cart2, miniAppUrl).text;
    expect(text2).not.toContain("🎉 *Oferta desbloqueada:*");
    expect(text2).toContain("🔥 *Oferta progressiva:* Falta *1 produto* para desbloquear *3 por R$ 12,00*!");
    expect(text2).toContain("Economia estimada de R$ 3,00 ao completar a faixa!");

    // Após remover mais 1 item -> sobra 1 produto -> faltam 2 produtos
    const cart1 = {
      ...cart2,
      items: [cart2.items[0]],
      subtotal: 5.0,
      total: 5.0,
      itemCount: 1,
      progressivePromotion: {
        ...cart2.progressivePromotion,
        nextTierProgress: {
          targetQuantity: 3,
          unitsRemaining: 2,
          targetTierPriceCents: 1200,
          projectedAdditionalSavingsCents: 300,
        },
      },
    };

    const text1 = formatCartMessage(cart1, miniAppUrl).text;
    expect(text1).toContain("🚀 *Oferta progressiva:* Faltam *2 produtos* para desbloquear *3 por R$ 12,00*!");
  });

  // 10. Produtos com preços diferentes
  it("10. Produtos com preços diferentes: calcula economia potencial e real com base no preço real dos produtos", async () => {
    // Produto 1: R$ 4,00 / Produto 2: R$ 6,00 (Preço médio = R$ 5,00)
    // Para faixa de 3 por R$ 12,00: 3 * 5,00 = 15,00 -> Economia estimada de R$ 3,00
    const items = [
      { productId: "prod-4brl", quantity: 1, price: 4.0, title: "Item Barato" },
      { productId: "prod-6brl", quantity: 1, price: 6.0, title: "Item Médio" },
    ];

    vi.spyOn(ComboService, "getActiveProgressivePromotion").mockResolvedValue(promoWithTwoTiers);
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-4brl", storeId, title: "Item Barato", price: "4.00", status: "active" },
      { id: "prod-6brl", storeId, title: "Item Médio", price: "6.00", status: "active" },
    ]);

    const evalResult = await ComboService.calculateProgressivePricingForCart(storeId, items);

    expect(evalResult.pricingResult?.regularSubtotalCents).toBe(1000);
    expect(evalResult.pricingResult?.nextTierProgress?.projectedAdditionalSavingsCents).toBe(300);

    // Agora adiciona o 3º produto mais caro: R$ 8,00
    // Total real: 4 + 6 + 8 = 18,00. Faixa de 3 por R$ 12,00 -> Economia real de R$ 6,00!
    const items3 = [
      ...items,
      { productId: "prod-8brl", quantity: 1, price: 8.0, title: "Item Caro" },
    ];
    mockDb.query.products.findMany.mockResolvedValue([
      { id: "prod-4brl", storeId, title: "Item Barato", price: "4.00", status: "active" },
      { id: "prod-6brl", storeId, title: "Item Médio", price: "6.00", status: "active" },
      { id: "prod-8brl", storeId, title: "Item Caro", price: "8.00", status: "active" },
    ]);

    const evalResult3 = await ComboService.calculateProgressivePricingForCart(storeId, items3);

    expect(evalResult3.pricingResult?.regularSubtotalCents).toBe(1800);
    expect(evalResult3.pricingResult?.finalPriceCents).toBe(1200);
    expect(evalResult3.discountAmount).toBe(6.0); // 18 - 12 = 6,00 de desconto real!
  });

  // 11. Ofertas progressivas existentes sem regressões
  it("11. Ofertas progressivas existentes sem regressões: mantém cálculo pelo motor ProgressivePricingEngine", () => {
    const tiers = [
      { id: "t1", comboId: "c1", minQuantity: 3, priceCents: 1200, position: 1 },
      { id: "t2", comboId: "c1", minQuantity: 5, priceCents: 1800, position: 2 },
    ];

    const pricingUnits = [
      { id: "u1", priceCents: 500 },
      { id: "u2", priceCents: 500 },
      { id: "u3", priceCents: 500 },
    ];

    const result = ProgressivePricingEngine.calculate(pricingUnits, tiers);

    expect(result.totalUnits).toBe(3);
    expect(result.coveredUnits).toBe(3);
    expect(result.finalPriceCents).toBe(1200);
    expect(result.savingsCents).toBe(300);
    expect(result.appliedTiers).toHaveLength(1);
    expect(result.nextTierProgress?.targetQuantity).toBe(5);
    expect(result.nextTierProgress?.unitsRemaining).toBe(2);
  });

  // 12. Ausência de descontos falsos antes do desbloqueio
  it("12. Ausência de descontos falsos antes do desbloqueio: subtotal e total permanecem estritamente iguais", () => {
    const cartPreUnlock = {
      id: "cart-1",
      storeId,
      customerId: "cust-1",
      items: [
        { id: "prod-1", slug: "p1", title: "Item 1", price: 15.0, quantity: 1, coverUrl: null, storeId },
      ],
      subtotal: 15.0,
      progressiveDiscount: 0,
      progressivePromotion: {
        id: promoWithTwoTiers.id,
        title: promoWithTwoTiers.title,
        slug: promoWithTwoTiers.slug,
        savings: 0,
        savingsPercentage: 0,
        appliedTiers: [],
        nextTierProgress: {
          targetQuantity: 3,
          unitsRemaining: 2,
          targetTierPriceCents: 3000,
          projectedAdditionalSavingsCents: 1500,
        },
      },
      total: 15.0,
      itemCount: 1,
    };

    const { text } = formatCartMessage(cartPreUnlock, miniAppUrl);

    // Subtotal e Total devem ser exatamente R$ 15,00
    expect(text).toContain("💰 *Subtotal:* R$ 15,00");
    expect(text).toContain("💵 *Total:* *R$ 15,00*");
    expect(text).not.toContain("Desconto Progressivo:");
    expect(cartPreUnlock.progressiveDiscount).toBe(0);
    expect(cartPreUnlock.total).toBe(cartPreUnlock.subtotal);
  });
});
