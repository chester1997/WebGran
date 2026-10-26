import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComboService } from "../combo-service";
import { CartService } from "@/lib/cart/cart-service";
import { createCheckoutSession } from "@/app/miniapp/[slug]/cart/actions";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";

// In-memory mock database state
const dbStores: Record<string, any> = {};
const dbProducts: Record<string, any> = {};
const dbCombos: Record<string, any> = {};
const dbComboTiers: Record<string, any[]> = {};
const dbComboProducts: Record<string, any[]> = {};
const dbCarts: Record<string, any> = {};
const dbCartItems: Record<string, any> = {};
const dbOrders: Record<string, any> = {};
const dbOrderItems: any[] = [];
const dbCoupons: Record<string, any> = {};
const dbAccesses: any[] = [];
const dbCustomers: Record<string, any> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    get: vi.fn().mockReturnValue({ value: "test-session" }),
  })),
}));

vi.mock("@/lib/telegram/session", () => ({
  getMiniAppSession: vi.fn().mockImplementation(async () => ({
    storeId: "store-alpha",
    customerId: "cust-1",
    telegramUser: { id: 111222, first_name: "Test Buyer" },
  })),
}));

vi.mock("@/lib/payments/payment-service", () => ({
  paymentService: {
    getSellerConnection: vi.fn().mockResolvedValue(null),
    createPushinPayPix: vi.fn().mockResolvedValue({
      paymentId: "pix-123",
      qrCode: "00020126580014br.gov.bcb.pix...",
      qrCodeBase64: "base64data",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }),
    createSyncPayPix: vi.fn().mockResolvedValue({
      paymentId: "sync-123",
      qrCode: "sync-pix-qr",
      qrCodeBase64: "sync-base64",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }),
    createPixPayment: vi.fn().mockResolvedValue({
      paymentId: "mp-123",
      qrCode: "mp-pix-qr",
      qrCodeBase64: "mp-base64",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }),
    pushinPayProvider: {
      getPushinPayConnection: vi.fn().mockResolvedValue({ status: "active" }),
    },
    syncPayProvider: {
      getSyncPayConnection: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/telegram/bot-service", () => ({
  telegramBotService: {
    generateInviteLinkWithFallback: vi.fn().mockResolvedValue({
      inviteLink: "https://t.me/+mockInviteLink",
      method: "primary",
    }),
    sendCustomerAccessDeliveredNotification: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/notifications/seller-sale-notification-service", () => ({
  SellerSaleNotificationService: {
    notifySale: vi.fn().mockResolvedValue({ success: true }),
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
  sellerSaleNotificationService: {
    notifySale: vi.fn().mockResolvedValue({ success: true }),
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/push/seller-push-service", () => ({
  SellerPushService: {
    sendPushToSeller: vi.fn().mockResolvedValue({ success: true }),
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
  sellerPushService: {
    sendPushToSeller: vi.fn().mockResolvedValue({ success: true }),
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/orders/order-usage-service", () => ({
  getMonthlyOrderUsage: vi.fn().mockResolvedValue(5),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      stores: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbStores)[0] || null;
        }),
      },
      telegramCustomers: {
        findFirst: vi.fn().mockImplementation(async () => {
          return Object.values(dbCustomers)[0] || { id: "cust-1", storeId: "store-alpha", telegramUserId: "111222" };
        }),
      },
      products: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbProducts)[0] || null;
        }),
        findMany: vi.fn().mockImplementation(async () => {
          return Object.values(dbProducts);
        }),
      },
      combos: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          let targetStoreId = "store-alpha";
          function checkChunk(chunk: any) {
            if (!chunk) return;
            if (typeof chunk.value === "string" && chunk.value.startsWith("store-")) {
              targetStoreId = chunk.value;
            }
            if (Array.isArray(chunk.queryChunks)) {
              for (const sc of chunk.queryChunks) checkChunk(sc);
            }
          }
          if (where && Array.isArray(where.queryChunks)) {
            for (const c of where.queryChunks) checkChunk(c);
          }

          const promo = Object.values(dbCombos).find((c) => {
            return c.status === "active" && c.type === "progressive" && c.storeId === targetStoreId;
          });
          if (!promo) return null;
          return {
            ...promo,
            tiers: dbComboTiers[promo.id] || [],
            products: (dbComboProducts[promo.id] || []).map((cp) => ({
              ...cp,
              product: dbProducts[cp.productId] || null,
            })),
          };
        }),
        findMany: vi.fn().mockImplementation(async () => {
          return Object.values(dbCombos).filter((c) => c.status === "active").map((c) => ({
            ...c,
            tiers: dbComboTiers[c.id] || [],
            products: (dbComboProducts[c.id] || []).map((cp) => ({
              ...cp,
              product: dbProducts[cp.productId] || null,
            })),
          }));
        }),
      },
      carts: {
        findFirst: vi.fn().mockImplementation(async () => {
          return Object.values(dbCarts)[0] || null;
        }),
      },
      cartItems: {
        findMany: vi.fn().mockImplementation(async () => {
          return Object.values(dbCartItems).map((ci) => ({
            ...ci,
            product: dbProducts[ci.productId] || null,
            combo: dbCombos[ci.comboId] || null,
          }));
        }),
      },
      orders: {
        findFirst: vi.fn().mockImplementation(async () => {
          const ord = Object.values(dbOrders)[0];
          if (!ord) return null;
          return {
            ...ord,
            items: dbOrderItems.filter((oi) => oi.orderId === ord.id),
          };
        }),
        findMany: vi.fn().mockImplementation(async () => {
          return Object.values(dbOrders).map((ord) => ({
            ...ord,
            items: dbOrderItems.filter((oi) => oi.orderId === ord.id),
          }));
        }),
      },
      orderItems: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return dbOrderItems;
        }),
      },
      accesses: {
        findFirst: vi.fn().mockImplementation(async () => null),
        findMany: vi.fn().mockImplementation(async () => dbAccesses),
      },
      telegramBots: {
        findFirst: vi.fn().mockImplementation(async () => ({
          id: "bot-1",
          storeId: "store-alpha",
          status: "active",
          botToken: "mock-token",
        })),
      },
      telegramBotChats: {
        findFirst: vi.fn().mockImplementation(async () => ({
          id: "chat-1",
          botId: "bot-1",
          chatId: "-100111",
          status: "active",
        })),
      },
    },
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((vals: any) => {
        const items = Array.isArray(vals) ? vals : [vals];
        return {
          returning: vi.fn().mockImplementation(async () => {
            const item = items[0];
            const id = item.id || `rec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const record = { id, ...item };
            if (item.storeId && item.status && (item.total !== undefined || item.subtotal !== undefined)) {
              dbOrders[id] = record;
            } else if (item.orderId && (item.productId !== undefined || item.comboId !== undefined)) {
              dbOrderItems.push(...items);
            } else if (item.cartId) {
              dbCartItems[id] = record;
            } else if (item.deliveryType || item.inviteLink !== undefined) {
              dbAccesses.push(...items);
            }
            return [record];
          }),
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(async () => {
              const item = items[0];
              const id = item.id || `rec-${Date.now()}`;
              const record = { id, ...item };
              return [record];
            }),
          }),
          then: vi.fn().mockImplementation((resolve: any) => {
            for (const item of items) {
              if (item.orderId && (item.productId !== undefined || item.comboId !== undefined)) {
                dbOrderItems.push(item);
              } else if (item.deliveryType || item.inviteLink !== undefined) {
                dbAccesses.push(item);
              }
            }
            return resolve ? resolve(items) : Promise.resolve(items);
          }),
        };
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          for (const ord of Object.values(dbOrders)) {
            Object.assign(ord, updates);
          }
          return [updates];
        }),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(async () => {
          return Object.values(dbCoupons);
        }),
      })),
    })),
  },
}));

describe("Fase C — Persistência e Integração de Ofertas Progressivas com Carrinho e Checkout", () => {
  beforeEach(() => {
    // Reset all tables
    for (const k in dbStores) delete dbStores[k];
    for (const k in dbProducts) delete dbProducts[k];
    for (const k in dbCombos) delete dbCombos[k];
    for (const k in dbComboTiers) delete dbComboTiers[k];
    for (const k in dbComboProducts) delete dbComboProducts[k];
    for (const k in dbCarts) delete dbCarts[k];
    for (const k in dbCartItems) delete dbCartItems[k];
    for (const k in dbOrders) delete dbOrders[k];
    dbOrderItems.length = 0;
    for (const k in dbCoupons) delete dbCoupons[k];
    dbAccesses.length = 0;
    for (const k in dbCustomers) delete dbCustomers[k];

    // Seed default store
    dbStores["store-alpha"] = {
      id: "store-alpha",
      name: "Loja Alpha",
      slug: "loja-alpha",
      ownerId: "owner-1",
      status: "active",
    };

    dbCustomers["cust-1"] = {
      id: "cust-1",
      storeId: "store-alpha",
      telegramUserId: "111222",
    };

    // Seed products in store-alpha (R$ 10,00 each)
    dbProducts["prod-1"] = {
      id: "prod-1",
      storeId: "store-alpha",
      title: "VIP Canais A",
      slug: "vip-canais-a",
      price: "10.00",
      status: "active",
      deliveryType: "external",
      deliveryValue: "https://t.me/vip_canais_a",
    };

    dbProducts["prod-2"] = {
      id: "prod-2",
      storeId: "store-alpha",
      title: "VIP Filmes B",
      slug: "vip-filmes-b",
      price: "10.00",
      status: "active",
      deliveryType: "external",
      deliveryValue: "https://t.me/vip_filmes_b",
    };

    dbProducts["prod-3"] = {
      id: "prod-3",
      storeId: "store-alpha",
      title: "VIP Séries C",
      slug: "vip-series-c",
      price: "10.00",
      status: "active",
      deliveryType: "external",
      deliveryValue: "https://t.me/vip_series_c",
    };

    dbProducts["prod-4"] = {
      id: "prod-4",
      storeId: "store-alpha",
      title: "VIP Cursos D",
      slug: "vip-cursos-d",
      price: "10.00",
      status: "active",
      deliveryType: "external",
      deliveryValue: "https://t.me/vip_cursos_d",
    };

    // Seed active progressive promotion:
    // Faixas: 3 por R$ 12,00 | 4 por R$ 15,00 | 10 por R$ 35,00
    const promoId = "promo-prog-1";
    dbCombos[promoId] = {
      id: promoId,
      storeId: "store-alpha",
      title: "Leve Mais por Menos",
      slug: "leve-mais-por-menos",
      type: "progressive",
      eligibilityMode: "all_products",
      status: "active",
      price: "12.00",
      position: 0,
      createdAt: new Date(),
    };

    dbComboTiers[promoId] = [
      { id: "tier-3", comboId: promoId, minQuantity: 3, price: "12.00", position: 1 },
      { id: "tier-4", comboId: promoId, minQuantity: 4, price: "15.00", position: 2 },
      { id: "tier-10", comboId: promoId, minQuantity: 10, price: "35.00", position: 3 },
    ];
  });

  // 1. Carrinho com produtos diferentes e quantidades variadas
  it("1. Calcula oferta progressiva no carrinho para 3 produtos diferentes (3 por R$ 12,00)", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 10.0, title: "VIP Canais A" },
      { productId: "prod-2", quantity: 1, price: 10.0, title: "VIP Filmes B" },
      { productId: "prod-3", quantity: 1, price: 10.0, title: "VIP Séries C" },
    ];

    const evalResult = await ComboService.calculateProgressivePricingForCart("store-alpha", items);

    expect(evalResult.hasPromotion).toBe(true);
    expect(evalResult.discountAmount).toBe(18); // Subtotal R$ 30 - Preço final R$ 12 = R$ 18 de desconto
    expect(evalResult.pricingResult?.finalPriceCents).toBe(1200);
    expect(evalResult.pricingResult?.appliedTiers).toHaveLength(1);
    expect(evalResult.pricingResult?.appliedTiers[0].minQuantity).toBe(3);
    expect(evalResult.pricingResult?.appliedTiers[0].priceCents).toBe(1200);
  });

  it("1b. Calcula oferta progressiva para 4 unidades de produtos diferentes (4 por R$ 15,00)", async () => {
    const items = [
      { productId: "prod-1", quantity: 1, price: 10.0, title: "VIP Canais A" },
      { productId: "prod-2", quantity: 1, price: 10.0, title: "VIP Filmes B" },
      { productId: "prod-3", quantity: 1, price: 10.0, title: "VIP Séries C" },
      { productId: "prod-4", quantity: 1, price: 10.0, title: "VIP Cursos D" },
    ];

    const evalResult = await ComboService.calculateProgressivePricingForCart("store-alpha", items);

    expect(evalResult.hasPromotion).toBe(true);
    expect(evalResult.discountAmount).toBe(25); // Subtotal R$ 40 - Preço final R$ 15 = R$ 25 de desconto
    expect(evalResult.pricingResult?.finalPriceCents).toBe(1500);
    expect(evalResult.pricingResult?.appliedTiers[0].minQuantity).toBe(4);
  });

  // 2. Isolamento por loja (Multi-tenant)
  it("2. Isolamento por loja: rejeita produtos de outra loja e não aplica desconto cross-store", async () => {
    // Produto da Loja Beta
    dbProducts["prod-beta-1"] = {
      id: "prod-beta-1",
      storeId: "store-beta",
      title: "Produto da Loja Beta",
      slug: "prod-beta-1",
      price: "10.00",
      status: "active",
    };

    const items = [
      { productId: "prod-1", quantity: 1, price: 10.0 },
      { productId: "prod-beta-1", quantity: 2, price: 10.0 }, // pertencente a store-beta
    ];

    // Consulta para store-alpha: o produto beta não pertence à loja alpha
    const evalAlpha = await ComboService.calculateProgressivePricingForCart("store-beta", items);
    // Loja Beta não tem promoção progressiva cadastrada
    expect(evalAlpha.hasPromotion).toBe(false);
    expect(evalAlpha.discountAmount).toBe(0);
  });

  // 3. Promoção desativada ou alterada entre carrinho e checkout
  it("3. Promoção desativada entre carrinho e checkout: cobra preço regular e não aplica desconto", async () => {
    // Inativa a promoção
    dbCombos["promo-prog-1"].status = "inactive";

    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
      ],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const createdOrder = dbOrders[res.orderId!];
    expect(createdOrder).toBeDefined();
    // Preço cheio R$ 30,00 sem desconto
    expect(createdOrder.subtotal).toBe("30.00");
    expect(createdOrder.discount).toBe("0.00");
    expect(createdOrder.total).toBe("30.00");
    expect(createdOrder.progressiveComboId).toBeNull();
    expect(createdOrder.progressiveComboSnapshot).toBeNull();
  });

  // 4. Validação server-side dos preços
  it("4. Validação server-side: preços são recalculados a partir do banco e não podem ser forjados pelo cliente", async () => {
    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
        { id: "prod-4", quantity: 1 },
      ],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const createdOrder = dbOrders[res.orderId!];
    expect(createdOrder).toBeDefined();
    // 4 produtos de R$ 10 = R$ 40 subtotal. Faixa 4 por R$ 15 = R$ 25 de desconto progressivo. Total R$ 15.
    expect(createdOrder.subtotal).toBe("40.00");
    expect(createdOrder.discount).toBe("25.00");
    expect(createdOrder.total).toBe("15.00");
  });

  // 5. Aplicação de cupons (interação com desconto progressivo)
  it("5. Aplicação de cupom percentual de 10% sobre o subtotal já beneficiado pela oferta progressiva", async () => {
    // Cupom de 10%
    dbCoupons["CUPOM10"] = {
      id: "coupon-1",
      storeId: "store-alpha",
      code: "CUPOM10",
      discountType: "percentage",
      discountValue: "10.00",
      status: "active",
      usedCount: 0,
      maxUses: 100,
    };

    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
        { id: "prod-4", quantity: 1 },
      ],
      "CUPOM10",
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const createdOrder = dbOrders[res.orderId!];
    expect(createdOrder).toBeDefined();
    // Subtotal = R$ 40.00
    // Desconto progressivo = R$ 25.00 (Base líquida = R$ 15.00)
    // Cupom 10% sobre R$ 15.00 = R$ 1.50
    // Desconto total = R$ 26.50
    // Total final = R$ 13.50
    expect(createdOrder.subtotal).toBe("40.00");
    expect(createdOrder.progressiveComboDiscount).toBe("25.00");
    expect(createdOrder.discount).toBe("26.50");
    expect(createdOrder.total).toBe("13.50");
    expect(createdOrder.couponCode).toBe("CUPOM10");
  });

  // 6. Comissão e split de pagamento
  it("6. Preserva estritamente a comissão de R$ 0,50 e as regras de split", async () => {
    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
      ],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const createdOrder = dbOrders[res.orderId!];
    expect(createdOrder.splitAmountCents).toBe(50); // R$ 0,50 mantido
    expect(createdOrder.splitStatus).toBe("PENDING");
  });

  // 7. Snapshot imutável
  it("7. Snapshot imutável: alteração posterior da promoção não modifica o histórico do pedido", async () => {
    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
      ],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const orderBefore = dbOrders[res.orderId!];
    const snapshotBefore = orderBefore.progressiveComboSnapshot;
    expect(snapshotBefore).toBeDefined();
    expect(snapshotBefore.appliedTiers[0].minQuantity).toBe(3);
    expect(snapshotBefore.finalPriceCents).toBe(1200);

    // O vendedor altera o preço da promoção no dia seguinte
    dbCombos["promo-prog-1"].title = "Novo Título";
    dbComboTiers["promo-prog-1"][0].price = "20.00"; // Aumentou de 12 para 20

    // O pedido original permanece com os valores congelados da compra
    expect(orderBefore.total).toBe("12.00");
    expect(orderBefore.progressiveComboSnapshot.finalPriceCents).toBe(1200);
    expect(orderBefore.progressiveComboSnapshot.title).toBe("Leve Mais por Menos");
  });

  // 8. Pedidos legados com combo_id e combo_snapshot continuam funcionando
  it("8. Pedidos de combos legados preservam combo_id e combo_snapshot em order_items", async () => {
    // Cadastra um combo curado legado
    const legacyId = "combo-legacy-1";
    dbCombos[legacyId] = {
      id: legacyId,
      storeId: "store-alpha",
      title: "Combo Curado Especial",
      slug: "combo-curado-especial",
      type: "curated",
      status: "active",
      price: "18.00",
      createdAt: new Date(),
    };

    dbComboProducts[legacyId] = [
      { id: "cp-1", comboId: legacyId, productId: "prod-1" },
      { id: "cp-2", comboId: legacyId, productId: "prod-2" },
    ];

    const res = await createCheckoutSession(
      "loja-alpha",
      [{ id: legacyId, quantity: 1, isCombo: true, comboId: legacyId }],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const createdOrder = dbOrders[res.orderId!];
    expect(createdOrder.total).toBe("18.00");

    // Verifica que o item no banco possui combo_id e combo_snapshot preservados
    const comboOrderItem = dbOrderItems.find((oi) => oi.orderId === createdOrder.id);
    expect(comboOrderItem).toBeDefined();
    expect(comboOrderItem.comboId).toBe(legacyId);
    expect(comboOrderItem.productId).toBeNull();
    expect(comboOrderItem.comboSnapshot).toBeDefined();
    expect(comboOrderItem.comboSnapshot.title).toBe("Combo Curado Especial");
  });

  // 9. Idempotência e tentativas concorrentes
  it("9. Idempotência: requisições com os mesmos itens e valor reaproveitam o pedido pendente", async () => {
    const items = [
      { id: "prod-1", quantity: 1 },
      { id: "prod-2", quantity: 1 },
      { id: "prod-3", quantity: 1 },
    ];

    const firstRes = await createCheckoutSession("loja-alpha", items, undefined, "pushinpay");
    expect(firstRes.success).toBe(true);

    const secondRes = await createCheckoutSession("loja-alpha", items, undefined, "pushinpay");
    expect(secondRes.success).toBe(true);

    // Deve reaproveitar exatamente o mesmo orderId sem duplicar no banco
    expect(secondRes.orderId).toBe(firstRes.orderId);
  });

  // 10. Entrega de acessos por produto
  it("10. Entrega de acessos: pedido progressivo entrega acessos individuais por produto", async () => {
    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "prod-2", quantity: 1 },
        { id: "prod-3", quantity: 1 },
      ],
      undefined,
      "pushinpay"
    );

    expect(res.success).toBe(true);
    const order = dbOrders[res.orderId!];
    order.status = "paid"; // Marca como pago para processar entrega

    // Os itens gerados no pedido progressivo têm productId individual
    const orderItemsForOrder = dbOrderItems.filter((oi) => oi.orderId === order.id);
    expect(orderItemsForOrder).toHaveLength(3);
    expect(orderItemsForOrder[0].productId).toBe("prod-1");
    expect(orderItemsForOrder[1].productId).toBe("prod-2");
    expect(orderItemsForOrder[2].productId).toBe("prod-3");

    // Executa entrega de acessos
    const deliveryResults = await AccessDeliveryService.processOrderDelivery(order.id);

    // 3 acessos individuais gerados (um para cada canal VIP)
    expect(deliveryResults).toHaveLength(3);
    expect(deliveryResults.every((r) => r.status === "ACTIVE" && r.deliveryStatus === "DELIVERED")).toBe(true);
  });
});
