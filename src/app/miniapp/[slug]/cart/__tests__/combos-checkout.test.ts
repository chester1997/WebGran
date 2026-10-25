import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCheckoutSession } from "../actions";

// Storage objects for our mock database
const dbStores: Record<string, any> = {};
const dbProducts: Record<string, any> = {};
const dbCombos: Record<string, any> = {};
const dbOrders: Record<string, any> = {};
const dbOrderItems: any[] = [];
const dbCoupons: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      stores: {
        findFirst: vi.fn().mockImplementation(async () => Object.values(dbStores)[0] || null),
      },
      products: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbProducts);
        }),
      },
      combos: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbCombos).filter((c) => c.status === "active");
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
    },
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((vals: any) => {
        const items = Array.isArray(vals) ? vals : [vals];
        return {
          returning: vi.fn().mockImplementation(async () => {
            const item = items[0];
            const id = item.id || `ord-${Date.now()}`;
            const record = { id, ...item };
            dbOrders[id] = record;
            return [record];
          }),
          then: vi.fn().mockImplementation((resolve: any) => {
            dbOrderItems.push(...items);
            return resolve ? resolve(items) : Promise.resolve(items);
          }),
        };
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          // If updating orders, apply to dbOrders
          for (const ord of Object.values(dbOrders)) {
            Object.assign(ord, updates);
          }
          return [updates];
        }),
      })),
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          return Object.values(dbCoupons);
        }),
      }),
    })),
  },
}));

vi.mock("@/lib/telegram/session", () => ({
  getMiniAppSession: vi.fn().mockResolvedValue({
    storeId: "store-alpha-id",
    customerId: "cust-1",
    telegramId: 123456,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/lib/orders/order-usage-service", () => ({
  getMonthlyOrderUsage: vi.fn().mockResolvedValue(5),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));

vi.mock("@/lib/payments/payment-service", () => ({
  paymentService: {
    getSellerConnection: vi.fn().mockResolvedValue(null),
    pushinPayProvider: {
      getPushinPayConnection: vi.fn().mockResolvedValue({
        id: "conn-pushin",
        status: "active",
      }),
    },
    syncPayProvider: {
      getSyncPayConnection: vi.fn().mockResolvedValue(null),
    },
    createPushinPayPix: vi.fn().mockImplementation(async (params: any) => ({
      paymentId: "pix-tx-123",
      qrCode: "00020126580014BR.GOV.BCB.PIX0136mock-qr",
      qrCodeBase64: "data:image/png;base64,mockqr",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    })),
  },
}));

describe("Combos Checkout & Order Creation Suite (Phase 4 — Etapa 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(dbStores)) delete dbStores[key];
    for (const key of Object.keys(dbProducts)) delete dbProducts[key];
    for (const key of Object.keys(dbCombos)) delete dbCombos[key];
    for (const key of Object.keys(dbOrders)) delete dbOrders[key];
    for (const key of Object.keys(dbCoupons)) delete dbCoupons[key];
    dbOrderItems.length = 0;

    // Default valid store
    dbStores["store-alpha-id"] = {
      id: "store-alpha-id",
      name: "Loja Alpha",
      slug: "loja-alpha",
      ownerId: "seller-owner-id",
    };

    // Default products
    dbProducts["prod-1"] = {
      id: "prod-1",
      storeId: "store-alpha-id",
      title: "Canal VIP",
      slug: "canal-vip",
      price: "50.00",
      status: "active",
      deliveryType: "telegram",
      deliveryValue: "-100123456",
      botId: "bot-1",
    };

    dbProducts["prod-2"] = {
      id: "prod-2",
      storeId: "store-alpha-id",
      title: "Grupo Network",
      slug: "grupo-network",
      price: "40.00",
      status: "active",
      deliveryType: "telegram",
      deliveryValue: "-100789012",
      botId: "bot-1",
    };

    // Default combo: Canal VIP + Grupo Network (R$ 50 + R$ 40 = R$ 90) for R$ 69.90
    dbCombos["combo-1"] = {
      id: "combo-1",
      storeId: "store-alpha-id",
      title: "Super Combo VIP",
      slug: "super-combo-vip",
      description: "Acesso total aos dois grupos",
      coverUrl: "https://cdn.example.com/cover.jpg",
      price: "69.90",
      status: "active",
      products: [
        { product: dbProducts["prod-1"], position: 0 },
        { product: dbProducts["prod-2"], position: 1 },
      ],
    };
  });

  // 1. Compra de um produto avulso, sem regressões
  it("1. Compra de um produto avulso, sem regressões", async () => {
    const res = await createCheckoutSession("loja-alpha", [
      { id: "prod-1", quantity: 1 },
    ]);

    expect(res.success).toBe(true);
    expect(res.orderId).toBeDefined();
    expect(res.pix).toBeDefined();

    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("50.00");
    expect(order.total).toBe("50.00");
    expect(order.status).toBe("pending");

    expect(dbOrderItems).toHaveLength(1);
    expect(dbOrderItems[0].productId).toBe("prod-1");
    expect(dbOrderItems[0].comboId).toBeNull();
    expect(dbOrderItems[0].comboSnapshot).toBeNull();
    expect(dbOrderItems[0].unitPrice).toBe("50.00");
    expect(dbOrderItems[0].total).toBe("50.00");
    expect(dbOrderItems[0].quantity).toBe(1);
  });

  // 2. Compra de um combo isolado
  it("2. Compra de um combo isolado", async () => {
    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    expect(res.orderId).toBeDefined();

    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("69.90");
    expect(order.total).toBe("69.90");

    expect(dbOrderItems).toHaveLength(1);
    expect(dbOrderItems[0].productId).toBeNull();
    expect(dbOrderItems[0].comboId).toBe("combo-1");
    expect(dbOrderItems[0].unitPrice).toBe("69.90");
    expect(dbOrderItems[0].total).toBe("69.90");
    expect(dbOrderItems[0].quantity).toBe(1);
  });

  // 3. Carrinho misto com produtos avulsos e combos
  it("3. Carrinho misto com produtos avulsos e combos", async () => {
    // prod-1 (R$ 50) + combo-1 (R$ 69.90) = R$ 119.90
    const res = await createCheckoutSession("loja-alpha", [
      { id: "prod-1", quantity: 1 },
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("119.90");
    expect(order.total).toBe("119.90");

    expect(dbOrderItems).toHaveLength(2);
    const prodItem = dbOrderItems.find((i) => i.productId === "prod-1");
    const comboItem = dbOrderItems.find((i) => i.comboId === "combo-1");

    expect(prodItem).toBeDefined();
    expect(prodItem.unitPrice).toBe("50.00");
    expect(prodItem.comboSnapshot).toBeNull();

    expect(comboItem).toBeDefined();
    expect(comboItem.unitPrice).toBe("69.90");
    expect(comboItem.comboSnapshot).toBeDefined();
  });

  // 4. Quantidade maior que um para um combo
  it("4. Quantidade maior que um para um combo, respeitando a semântica atual do carrinho", async () => {
    // 2 x R$ 69.90 = R$ 139.80
    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 2, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("139.80");
    expect(order.total).toBe("139.80");

    expect(dbOrderItems).toHaveLength(1);
    expect(dbOrderItems[0].quantity).toBe(2);
    expect(dbOrderItems[0].unitPrice).toBe("69.90");
    expect(dbOrderItems[0].total).toBe("139.80");
  });

  // 5. Combo inativo ou inexistente
  it("5. Rejeita combo inativo ou inexistente", async () => {
    // Inactive combo
    dbCombos["combo-inactive"] = {
      id: "combo-inactive",
      storeId: "store-alpha-id",
      title: "Combo Antigo",
      price: "30.00",
      status: "inactive",
      products: [
        { product: dbProducts["prod-1"], position: 0 },
        { product: dbProducts["prod-2"], position: 1 },
      ],
    };

    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-inactive", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Combo inexistente, inativo ou pertencente a outra loja/);
    expect(Object.keys(dbOrders)).toHaveLength(0);
  });

  // 6. Produto componente inativo, removido ou pertencente a outra loja
  it("6. Rejeita combo com produto componente inativo ou de outra loja", async () => {
    // Combo where one product is inactive
    dbProducts["prod-inactive"] = {
      id: "prod-inactive",
      storeId: "store-alpha-id",
      title: "Produto Desativado",
      price: "20.00",
      status: "inactive",
    };

    dbCombos["combo-broken"] = {
      id: "combo-broken",
      storeId: "store-alpha-id",
      title: "Combo Quebrado",
      price: "45.00",
      status: "active",
      products: [
        { product: dbProducts["prod-1"], position: 0 },
        { product: dbProducts["prod-inactive"], position: 1 },
      ],
    };

    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-broken", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/possui produtos indisponíveis ou pertencentes a outra loja/);
    expect(Object.keys(dbOrders)).toHaveLength(0);
  });

  // 7. Alteração do preço entre a inclusão no carrinho e o checkout
  it("7. Alteração do preço entre a inclusão e o checkout: cobra o preço atual do banco", async () => {
    // Seller updated combo price from 69.90 to 79.90 in DB
    dbCombos["combo-1"].price = "79.90";

    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("79.90");
    expect(order.total).toBe("79.90");

    expect(dbOrderItems[0].unitPrice).toBe("79.90");
    expect(dbOrderItems[0].comboSnapshot.priceAtPurchase).toBe("79.90");
  });

  // 8. Cupom aplicado a carrinho misto, conforme as regras comerciais existentes
  it("8. Cupom aplicado a carrinho misto (prod-1 R$ 50 + combo-1 R$ 69.90 = R$ 119.90 - R$ 19.90 desc = R$ 100.00)", async () => {
    dbCoupons["cupom-top"] = {
      id: "cup-1",
      storeId: "store-alpha-id",
      code: "DESCONTO19",
      discountType: "fixed",
      discountValue: "19.90",
      minOrderValue: "50.00",
      maxUses: 10,
      usedCount: 0,
      status: "active",
      expiresAt: null,
    };

    const res = await createCheckoutSession(
      "loja-alpha",
      [
        { id: "prod-1", quantity: 1 },
        { id: "combo-1", quantity: 1, isCombo: true },
      ],
      "DESCONTO19"
    );

    expect(res.success).toBe(true);
    const order = Object.values(dbOrders)[0];
    expect(order.subtotal).toBe("119.90");
    expect(order.discount).toBe("19.90");
    expect(order.total).toBe("100.00");
    expect(order.couponCode).toBe("DESCONTO19");
  });

  // 9. Cálculo correto do total, comissão e split
  it("9. Garante envio exato do total validado ao gateway sem interferir no split de R$ 0,50", async () => {
    const { paymentService } = await import("@/lib/payments/payment-service");

    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    expect(paymentService.createPushinPayPix).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: expect.any(String),
        amount: 69.90, // Exactly R$ 69.90
        sellerId: "seller-owner-id",
      })
    );
  });

  // 10. Snapshot preservado com os dados da compra
  it("10. Snapshot preservado com os dados da compra e detalhes de entrega de cada produto", async () => {
    const res = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(res.success).toBe(true);
    expect(dbOrderItems).toHaveLength(1);

    const snapshot = dbOrderItems[0].comboSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot.comboId).toBe("combo-1");
    expect(snapshot.title).toBe("Super Combo VIP");
    expect(snapshot.priceAtPurchase).toBe("69.90");
    expect(snapshot.calculatedNormalPrice).toBe("90.00");
    expect(snapshot.savings).toBe("20.10");
    expect(snapshot.savingsPercentage).toBe(22);
    expect(snapshot.products).toHaveLength(2);

    expect(snapshot.products[0]).toEqual({
      id: "prod-1",
      title: "Canal VIP",
      slug: "canal-vip",
      price: "50.00",
      deliveryType: "telegram",
      deliveryValue: "-100123456",
      botId: "bot-1",
    });

    expect(snapshot.products[1]).toEqual({
      id: "prod-2",
      title: "Grupo Network",
      slug: "grupo-network",
      price: "40.00",
      deliveryType: "telegram",
      deliveryValue: "-100789012",
      botId: "bot-1",
    });
  });

  // 11. Tentativas repetidas e idempotência da criação do pedido
  it("11. Tentativas repetidas e idempotência: reutiliza PIX pendente ativo sem criar novo pedido duplicado", async () => {
    // 1st call creates order
    const firstRes = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(firstRes.success).toBe(true);
    const orderId1 = firstRes.orderId;
    expect(Object.keys(dbOrders)).toHaveLength(1);

    // 2nd call with identical cart
    const secondRes = await createCheckoutSession("loja-alpha", [
      { id: "combo-1", quantity: 1, isCombo: true },
    ]);

    expect(secondRes.success).toBe(true);
    expect(secondRes.orderId).toBe(orderId1);
    expect(secondRes.pix?.qrCode).toBe(firstRes.pix?.qrCode);
    // Should NOT have created a second order
    expect(Object.keys(dbOrders)).toHaveLength(1);
  });

  // 12. Falha na validação sem criação de pedido ou cobrança
  it("12. Falha na validação não cria pedido nem chama o gateway de pagamento", async () => {
    const { paymentService } = await import("@/lib/payments/payment-service");

    const res = await createCheckoutSession("loja-alpha", [
      { id: "prod-inexistente", quantity: 1 },
    ]);

    expect(res.success).toBe(false);
    expect(Object.keys(dbOrders)).toHaveLength(0);
    expect(dbOrderItems).toHaveLength(0);
    expect(paymentService.createPushinPayPix).not.toHaveBeenCalled();
  });
});
