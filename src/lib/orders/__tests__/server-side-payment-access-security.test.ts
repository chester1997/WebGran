import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";
import { AccessService } from "@/lib/orders/access-service";
import { createCheckoutSession } from "@/app/miniapp/[slug]/cart/actions";

// Mock DB
const dbOrders: Record<string, any> = {};
const dbAccesses: Record<string, any> = {};
const dbStores: Record<string, any> = {};
const dbProducts: Record<string, any> = {};
const dbCustomers: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          for (const ord of Object.values(dbOrders)) {
            return ord;
          }
          return null;
        }),
        findMany: vi.fn().mockImplementation(async () => Object.values(dbOrders)),
      },
      accesses: {
        findFirst: vi.fn().mockImplementation(async () => Object.values(dbAccesses)[0] || null),
        findMany: vi.fn().mockImplementation(async () => Object.values(dbAccesses)),
      },
      stores: {
        findFirst: vi.fn().mockImplementation(async () => Object.values(dbStores)[0] || null),
      },
      products: {
        findFirst: vi.fn().mockImplementation(async () => Object.values(dbProducts)[0] || null),
        findMany: vi.fn().mockImplementation(async () => Object.values(dbProducts)),
      },
      telegramBots: {
        findFirst: vi.fn().mockResolvedValue({
          id: "bot-1",
          storeId: "store-1",
          status: "active",
          tokenEncrypted: "enc_token",
        }),
      },
      telegramCustomers: {
        findFirst: vi.fn().mockImplementation(async () => Object.values(dbCustomers)[0] || null),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: "seller-1",
          role: "ADMIN",
        }),
      },
      sellerPaymentConnections: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      sellerEntitlements: {
        findFirst: vi.fn().mockResolvedValue({
          maxOrdersPerMonth: 9999,
          status: "active",
        }),
      },
      sellerSubscriptions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((vals: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const item = Array.isArray(vals) ? vals[0] : vals;
          const id = item.id || `gen-${Date.now()}`;
          const record = { id, ...item };
          if (table._?.name === "orders" || item.total !== undefined) {
            dbOrders[id] = record;
          } else {
            dbAccesses[id] = record;
          }
          return [record];
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          return [updates];
        }),
      })),
    })),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted_token"),
}));

vi.mock("@/lib/delivery/telegram-delivery-service", () => ({
  TelegramDeliveryService: {
    validateBotAndChatPermission: vi.fn().mockResolvedValue({
      success: true,
      canInviteUsers: true,
      botUsername: "test_bot",
    }),
    checkBuyerMembership: vi.fn().mockResolvedValue(false),
    createTelegramInvite: vi.fn().mockResolvedValue({
      inviteLink: "https://t.me/+mock_invite",
    }),
    generateProductInvite: vi.fn().mockResolvedValue({
      success: true,
      inviteLink: "https://t.me/+mock_invite",
    }),
    checkMemberStatus: vi.fn().mockResolvedValue({
      success: true,
      isMember: true,
    }),
    sendAccessGrantedNotification: vi.fn().mockResolvedValue({
      success: true,
    }),
  },
}));

vi.mock("@/lib/notifications/seller-sale-notification-service", () => ({
  SellerSaleNotificationService: {
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/telegram/session", () => ({
  getMiniAppSession: vi.fn().mockResolvedValue({
    storeId: "store-1",
    customerId: "cust-1",
    telegramId: 111222,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe("Server-Side Payment Verification & Access Security Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(dbOrders)) delete dbOrders[key];
    for (const key of Object.keys(dbAccesses)) delete dbAccesses[key];
    for (const key of Object.keys(dbStores)) delete dbStores[key];
    for (const key of Object.keys(dbProducts)) delete dbProducts[key];
    for (const key of Object.keys(dbCustomers)) delete dbCustomers[key];

    dbStores["store-1"] = {
      id: "store-1",
      slug: "loja-teste",
      ownerId: "seller-1",
      bots: [{ id: "bot-1", status: "active" }],
    };

    dbProducts["prod-1"] = {
      id: "prod-1",
      storeId: "store-1",
      title: "Curso VIP",
      slug: "curso-vip",
      price: "10.00",
      status: "active",
      deliveryType: "telegram",
      deliveryValue: "-100123456789",
    };

    dbCustomers["cust-1"] = {
      id: "cust-1",
      storeId: "store-1",
      telegramUserId: "111222",
    };
  });

  // 1. Pedido criado: acesso negado
  it("denies access delivery when order is just created (status pending)", async () => {
    dbOrders["ord-1"] = {
      id: "ord-1",
      storeId: "store-1",
      customerId: "cust-1",
      status: "pending",
      paymentMethod: null,
      paymentId: null,
      items: [{ productId: "prod-1" }],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-1");
    expect(results).toHaveLength(0);
    expect(Object.keys(dbAccesses)).toHaveLength(0);
  });

  // 2. Pix pendente: acesso negado
  it("denies access when Pix payment is still pending in the gateway", async () => {
    dbOrders["ord-pix-pending"] = {
      id: "ord-pix-pending",
      storeId: "store-1",
      customerId: "cust-1",
      status: "pending",
      paymentMethod: "pushinpay",
      paymentId: "tx-pix-123",
      items: [{ productId: "prod-1" }],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-pix-pending");
    expect(results).toHaveLength(0);
  });

  // 3. Checkout aberto ou retorno de sucesso falso no cliente: acesso negado
  it("denies access if checkout session has no active gateway (no demo mode auto-approval)", async () => {
    const checkoutRes = await createCheckoutSession("loja-teste", [{ id: "prod-1", quantity: 1 }]);

    expect(checkoutRes.success).toBe(false);
    expect(checkoutRes.error).toContain("não possui nenhum meio de pagamento ativo");
    expect((checkoutRes as any).isDemoPaid).toBeUndefined();
    expect(Object.keys(dbAccesses)).toHaveLength(0);
  });

  // 4. Pagamento recusado, cancelado ou expirado: acesso negado
  it("denies access when order status is cancelled or failed", async () => {
    dbOrders["ord-cancelled"] = {
      id: "ord-cancelled",
      storeId: "store-1",
      customerId: "cust-1",
      status: "cancelled",
      paymentMethod: "syncpay",
      paymentId: "sync-tx-failed",
      items: [{ productId: "prod-1" }],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-cancelled");
    expect(results).toHaveLength(0);
  });

  // 5. Tentativa de entrega de pedido marcado como pago mas sem paymentMethod ou paymentId: bloqueado
  it("strictly blocks delivery if order has status paid but lacks paymentMethod or paymentId", async () => {
    dbOrders["ord-fake-paid"] = {
      id: "ord-fake-paid",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: null,
      paymentId: null,
      items: [{ productId: "prod-1" }],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-fake-paid");
    expect(results).toHaveLength(0);
    expect(Object.keys(dbAccesses)).toHaveLength(0);
  });

  // 6. Pagamento confirmado validamente pelo gateway: acesso concedido
  it("grants access when order has verified payment from gateway (status paid + paymentMethod + paymentId)", async () => {
    dbOrders["ord-legit"] = {
      id: "ord-legit",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "tx-legit-777",
      customer: dbCustomers["cust-1"],
      items: [{ productId: "prod-1" }],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-legit");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("ACTIVE");
    expect(results[0].deliveryStatus).toBe("DELIVERED");
  });

  // 7. Webhook duplicado: nenhuma duplicação de acesso (idempotência)
  it("ensures strict idempotency: repeated delivery does not duplicate access", async () => {
    dbOrders["ord-legit"] = {
      id: "ord-legit",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "tx-legit-777",
      customer: dbCustomers["cust-1"],
      items: [{ productId: "prod-1" }],
    };

    const first = await AccessDeliveryService.processOrderDelivery("ord-legit");
    expect(first).toHaveLength(1);

    // Simulated duplicate webhook
    const second = await AccessDeliveryService.processOrderDelivery("ord-legit");
    expect(second).toHaveLength(1);
    expect(second[0].status).toBe("ACTIVE");
  });

  // 8. Eventos fora de ordem ou acesso consultado antes da confirmação: bloqueado no AccessLifecycleService
  it("blocks access resolution in AccessLifecycleService if order is not paid", async () => {
    dbOrders["ord-unpaid"] = {
      id: "ord-unpaid",
      storeId: "store-1",
      customerId: "cust-1",
      status: "pending",
      paymentMethod: null,
      paymentId: null,
    };

    dbAccesses["acc-1"] = {
      id: "acc-1",
      orderId: "ord-unpaid",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-1",
      product: dbProducts["prod-1"],
      customer: dbCustomers["cust-1"],
      store: dbStores["store-1"],
      status: "PENDING",
      expiresAt: null,
    };

    const res = await AccessLifecycleService.resolveAccessDestination("acc-1", "loja-teste", "111222");
    expect(res.success).toBe(false);
    expect(res.status).toBe("FAILED");
    expect(res.error).toContain("Acesso bloqueado: o pagamento deste pedido não foi aprovado");
  });

  // 9. Usuário tentando acessar produto de outra loja: acesso negado
  it("denies access resolution when store slug does not match the access store", async () => {
    dbOrders["ord-legit"] = {
      id: "ord-legit",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "tx-legit-777",
    };

    dbAccesses["acc-store-1"] = {
      id: "acc-store-1",
      orderId: "ord-legit",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-1",
      product: dbProducts["prod-1"],
      customer: dbCustomers["cust-1"],
      store: dbStores["store-1"],
      status: "ACTIVE",
      expiresAt: null,
    };

    const res = await AccessLifecycleService.resolveAccessDestination("acc-store-1", "outra-loja-hacker", "111222");
    expect(res.success).toBe(false);
    expect(res.error).toContain("não pertence a esta loja");
  });

  // 10. getCustomerAccesses filtra acessos de pedidos sem confirmação legítima
  it("getCustomerAccesses hides any access tied to an order without verified payment", async () => {
    dbAccesses["acc-free"] = {
      id: "acc-free",
      storeId: "store-1",
      customerId: "cust-1",
      status: "ACTIVE",
      orderId: "ord-unpaid",
      order: {
        id: "ord-unpaid",
        status: "pending",
        paymentMethod: null,
        paymentId: null,
      },
      product: dbProducts["prod-1"],
    };

    const customerAccesses = await AccessService.getCustomerAccesses("store-1", "cust-1");
    expect(customerAccesses).toHaveLength(0);
  });
});
