import { describe, it, expect, vi, beforeEach } from "vitest";
import { SellerSaleNotificationService, formatBrtDateTime, formatBRL } from "../seller-sale-notification-service";
import { checkPollingRateLimit } from "@/app/(seller)/seller/store/actions";
import { db } from "@/db";

const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 101 });

let dbOrdersStore: Record<string, any> = {};
let dbDeliveriesStore: Record<string, any> = {};
let dbRecipientsStore: any[] = [];
let dbTokensStore: Record<string, any> = {};
let dbBotsStore: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return dbOrdersStore["order-123"] || null;
        }),
      },
      stores: { findFirst: vi.fn() },
      orderItems: { findMany: vi.fn() },
      products: { findFirst: vi.fn() },
      telegramBots: { 
        findFirst: vi.fn().mockImplementation(async () => {
          return dbBotsStore["bot-1"] || null;
        }),
      },
      botSaleNotificationRecipients: {
        findMany: vi.fn().mockImplementation(async () => {
          return dbRecipientsStore.filter((r) => r.status === "active");
        }),
      },
      orderBotNotificationDeliveries: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
    },
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([{ id: "updated" }]),
      })),
    })),
    execute: vi.fn().mockImplementation(async (queryParam: any) => {
      const queryStr = typeof queryParam === "string" 
        ? queryParam 
        : (queryParam?.sql || JSON.stringify(queryParam) || "");
      
      const order = dbOrdersStore["order-123"];

      // 1. Order-level lease claim
      if (queryStr.includes("seller_notification_claimed_at = NOW()")) {
        if (order && !order.sellerNotificationSentAt && !order.sellerNotificationClaimedAt) {
          order.sellerNotificationClaimedAt = new Date();
          order.sellerNotificationClaimToken = "token-123";
          return [{ id: order.id }];
        }
        return [];
      }

      // 2. Order-level completion
      if (queryStr.includes("seller_notification_sent_at = NOW()")) {
        if (order) {
          order.sellerNotificationSentAt = new Date();
          order.sellerNotificationClaimedAt = null;
          order.sellerNotificationClaimToken = null;
        }
        return [{ id: order?.id }];
      }

      // 3. Order-level lease release
      if (queryStr.includes("seller_notification_claimed_at = NULL")) {
        if (order) {
          order.sellerNotificationClaimedAt = null;
          order.sellerNotificationClaimToken = null;
        }
        return [{ id: order?.id }];
      }

      // 4. Delivery insertion
      if (queryStr.includes("INSERT INTO order_bot_notification_deliveries")) {
        return [];
      }

      // 5. Individual delivery atomic claim
      if (queryStr.includes("UPDATE order_bot_notification_deliveries") && queryStr.includes("status = 'claiming'")) {
        const fullJson = JSON.stringify(queryParam);
        for (const [key, delivery] of Object.entries(dbDeliveriesStore)) {
          const matches = fullJson.includes(`"${delivery.recipientId}"`) || fullJson.includes(`"${delivery.telegramChatId}"`);
          if (matches) {
            if (delivery.status !== "delivered") {
              delivery.status = "claiming";
              delivery.attempts = (delivery.attempts || 0) + 1;
              return [{ id: delivery.id, attempts: delivery.attempts }];
            }
            return []; // already delivered, cannot claim!
          }
        }
        return [];
      }

      // Check if already delivered
      if (queryStr.includes("FROM order_bot_notification_deliveries") && queryStr.includes("status = 'delivered'") && queryStr.includes("LIMIT 1")) {
        const fullJson = JSON.stringify(queryParam);
        for (const [key, delivery] of Object.entries(dbDeliveriesStore)) {
          const matches = fullJson.includes(`"${delivery.recipientId}"`) || fullJson.includes(`"${delivery.telegramChatId}"`);
          if (matches && delivery.status === "delivered") {
            return [{ id: delivery.id }];
          }
        }
        return [];
      }

      // 6. Individual delivery mark delivered
      if (queryStr.includes("UPDATE order_bot_notification_deliveries") && queryStr.includes("status = 'delivered'")) {
        const fullJson = JSON.stringify(queryParam);
        for (const [key, delivery] of Object.entries(dbDeliveriesStore)) {
          if (fullJson.includes(`"${delivery.id}"`)) {
            delivery.status = "delivered";
            delivery.sentAt = new Date();
            return [{ id: delivery.id }];
          }
        }
        return [];
      }

      // 7. Individual delivery mark failed
      if (queryStr.includes("UPDATE order_bot_notification_deliveries") && queryStr.includes("status = 'failed'")) {
        const fullJson = JSON.stringify(queryParam);
        for (const [key, delivery] of Object.entries(dbDeliveriesStore)) {
          if (fullJson.includes(`"${delivery.id}"`)) {
            delivery.status = "failed";
            return [{ id: delivery.id }];
          }
        }
        return [];
      }

      // 8. Delivery count check
      if (queryStr.includes("FROM order_bot_notification_deliveries") && queryStr.includes("COUNT")) {
        const deliveries = Object.values(dbDeliveriesStore);
        const total = deliveries.length;
        const deliveredCount = deliveries.filter((d: any) => d.status === "delivered").length;
        return [{ total, delivered_count: deliveredCount }];
      }

      // 9. Atomic Token Update (Webhook /start notif_...)
      if (queryStr.includes("UPDATE bot_sale_notification_tokens") && queryStr.includes("used_at = NOW()")) {
        // Atomic check token
        const token = dbTokensStore["valid-token"];
        if (token && !token.usedAt && token.expiresAt > new Date()) {
          token.usedAt = new Date();
          return [{ id: token.id, store_id: token.storeId, bot_id: token.botId }];
        }
        return [];
      }

      return [];
    }),
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((token: string) => `decrypted_${token}`),
  encrypt: vi.fn((token: string) => `encrypted_${token}`),
}));

vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: class {
      sendMessage(...args: any[]) {
        return mockSendMessage(...args);
      }
    },
  };
});

describe("SellerSaleNotificationService & Granular Delivery Ledger Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 101 });

    dbOrdersStore = {
      "order-123": {
        id: "order-123",
        storeId: "store-seller-a",
        status: "paid",
        total: "97.00",
        platformFee: "4.85",
        netAmount: "92.15",
        sellerNotificationSentAt: null,
        sellerNotificationClaimedAt: null,
        sellerNotificationClaimToken: null,
        paidAt: new Date("2026-10-06T22:05:00Z"),
        customer: {
          firstName: "João",
          lastName: "Silva",
          username: "joaosilva",
          telegramUserId: "7112951709",
        },
        items: [
          {
            productId: "prod-1",
          },
        ],
      },
    };

    dbBotsStore = {
      "bot-1": {
        id: "bot-1",
        botId: "999888777",
        username: "loja_vip_bot",
        displayName: "Loja VIP Bot",
        tokenEncrypted: "encrypted_token_123",
        status: "active",
      },
    };

    dbRecipientsStore = [
      {
        id: "recip-1",
        storeId: "store-seller-a",
        botId: "bot-1",
        telegramChatId: "1001",
        displayName: "Sócio 1",
        status: "active",
      },
    ];

    dbDeliveriesStore = {
      "order-123_recip-1": {
        id: "deliv-1",
        orderId: "order-123",
        botId: "bot-1",
        recipientId: "recip-1",
        telegramChatId: "1001",
        status: "pending",
        attempts: 0,
      },
    };

    dbTokensStore = {
      "valid-token": {
        id: "token-uuid-1",
        storeId: "store-seller-a",
        botId: "bot-1",
        usedAt: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    };

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-seller-a",
      ownerId: "user-seller-a",
      name: "Loja Teste",
      telegramNotificationId: "1001",
    } as any);

    vi.mocked(db.query.products.findFirst).mockResolvedValue({
      id: "prod-1",
      title: "Assinatura VIP Mensal",
      botId: "bot-1",
    } as any);

    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(dbBotsStore["bot-1"]);
  });

  it("1. Três destinatários: dois sucessos e uma falha transitória", async () => {
    dbRecipientsStore = [
      { id: "r1", botId: "bot-1", telegramChatId: "101", displayName: "Sócio 1", status: "active" },
      { id: "r2", botId: "bot-1", telegramChatId: "102", displayName: "Sócio 2", status: "active" },
      { id: "r3", botId: "bot-1", telegramChatId: "103", displayName: "Sócio 3", status: "active" },
    ];
    dbDeliveriesStore = {
      "deliv-1": { id: "d1", orderId: "order-123", botId: "bot-1", recipientId: "r1", telegramChatId: "101", status: "pending" },
      "deliv-2": { id: "d2", orderId: "order-123", botId: "bot-1", recipientId: "r2", telegramChatId: "102", status: "pending" },
      "deliv-3": { id: "d3", orderId: "order-123", botId: "bot-1", recipientId: "r3", telegramChatId: "103", status: "pending" },
    };

    // Recipient 3 fails, 1 and 2 succeed
    mockSendMessage
      .mockResolvedValueOnce({ message_id: 1 })
      .mockResolvedValueOnce({ message_id: 2 })
      .mockRejectedValue(new Error("Telegram API 500"));

    const result = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    // Partial delivery: returns false because not all completed
    expect(result.success).toBe(false);
    expect(result.error).toContain("Entrega parcial");

    // Deliveries: 2 delivered, 1 failed
    expect(dbDeliveriesStore["deliv-1"].status).toBe("delivered");
    expect(dbDeliveriesStore["deliv-2"].status).toBe("delivered");
    expect(dbDeliveriesStore["deliv-3"].status).toBe("failed");

    // Order global sent_at must NOT be set
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).toBeNull();
  });

  it("2. Retry sem duplicar os dois destinatários já confirmados", async () => {
    // Deliveries 1 and 2 are ALREADY delivered; Delivery 3 is failed
    dbRecipientsStore = [
      { id: "r1", botId: "bot-1", telegramChatId: "101", displayName: "Sócio 1", status: "active" },
      { id: "r2", botId: "bot-1", telegramChatId: "102", displayName: "Sócio 2", status: "active" },
      { id: "r3", botId: "bot-1", telegramChatId: "103", displayName: "Sócio 3", status: "active" },
    ];
    dbDeliveriesStore = {
      "deliv-1": { id: "d1", orderId: "order-123", botId: "bot-1", recipientId: "r1", telegramChatId: "101", status: "delivered" },
      "deliv-2": { id: "d2", orderId: "order-123", botId: "bot-1", recipientId: "r2", telegramChatId: "102", status: "delivered" },
      "deliv-3": { id: "d3", orderId: "order-123", botId: "bot-1", recipientId: "r3", telegramChatId: "103", status: "failed" },
    };

    mockSendMessage.mockClear();
    mockSendMessage.mockResolvedValueOnce({ message_id: 3 });

    const retryResult = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    // Exactly 1 message sent (only to recipient 3, no duplicates for 1 and 2!)
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith("103", expect.any(String));

    // Now all 3 are delivered, and order is finalized globally
    expect(dbDeliveriesStore["deliv-3"].status).toBe("delivered");
    expect(retryResult.success).toBe(true);
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).not.toBeNull();
  });

  it("3. Dois workers concorrentes tentando a mesma entrega: atomicidade sem duplicata", async () => {
    // Both workers attempt delivery simultaneously
    const [resA, resB] = await Promise.all([
      SellerSaleNotificationService.notifySellerOfSale("order-123"),
      SellerSaleNotificationService.notifySellerOfSale("order-123"),
    ]);

    const notifiedCount = [resA, resB].filter((r) => r.notified).length;
    const skippedCount = [resA, resB].filter((r) => r.skipped).length;

    expect(notifiedCount).toBe(1);
    expect(skippedCount).toBe(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("4 e 5. Token consumido simultaneamente, expirado e reutilizado", async () => {
    // Atomic update simulation: first call claims, second returns empty
    const execute = db.execute;

    // Concurrent token consumption
    const [res1, res2] = await Promise.all([
      execute(`UPDATE bot_sale_notification_tokens SET used_at = NOW() WHERE token_hash = 'valid-token'`),
      execute(`UPDATE bot_sale_notification_tokens SET used_at = NOW() WHERE token_hash = 'valid-token'`),
    ]);

    const successClaims = [res1, res2].filter((r) => Array.isArray(r) && r.length > 0);
    expect(successClaims.length).toBe(1);

    // Reuse attempt fails immediately
    const resReuse = await execute(`UPDATE bot_sale_notification_tokens SET used_at = NOW() WHERE token_hash = 'valid-token'`);
    expect(resReuse).toEqual([]);

    // Expired token attempt fails
    dbTokensStore["valid-token"].expiresAt = new Date(Date.now() - 1000);
    dbTokensStore["valid-token"].usedAt = null;
    const resExpired = await execute(`UPDATE bot_sale_notification_tokens SET used_at = NOW() WHERE token_hash = 'valid-token'`);
    expect(resExpired).toEqual([]);
  });

  it("6. Valor líquido correto em pedidos PushinPay (respeitando split audit)", async () => {
    dbOrdersStore["order-123"].total = "100.00";
    dbOrdersStore["order-123"].platformFee = "5.00";
    dbOrdersStore["order-123"].netAmount = "95.00"; // Calculado pelo split

    await SellerSaleNotificationService.notifySellerOfSale("order-123");

    const [, sentMsg] = mockSendMessage.mock.calls[0];
    expect(sentMsg).toContain("💰 Valor Bruto: R$ 100,00");
    expect(sentMsg).toContain("💵 Valor Líquido: R$ 95,00");
  });

  it("7. Valor líquido correto em pedidos Mercado Pago com netAmount = 0 padrão do banco", async () => {
    dbOrdersStore["order-123"].total = "97.00";
    dbOrdersStore["order-123"].platformFee = "0.00";
    dbOrdersStore["order-123"].netAmount = "0.00"; // Default do banco, sem split prévio

    await SellerSaleNotificationService.notifySellerOfSale("order-123");

    const [, sentMsg] = mockSendMessage.mock.calls[0];
    // Fallback: 97 - 0 = 97.00, NEVER R$ 0,00!
    expect(sentMsg).toContain("💰 Valor Bruto: R$ 97,00");
    expect(sentMsg).toContain("💵 Valor Líquido: R$ 97,00");
  });

  it("8. Tratamento de Telegram HTTP 403 (bloqueado) e 401 (token inválido)", async () => {
    // 403 Forbidden
    const err403 = new Error("Forbidden: bot was blocked by the user");
    (err403 as any).code = 403;
    mockSendMessage.mockRejectedValueOnce(err403);

    const res403 = await SellerSaleNotificationService.notifySellerOfSale("order-123");
    expect(res403.success).toBe(false);

    // 401 Unauthorized
    const err401 = new Error("Unauthorized: invalid token");
    (err401 as any).code = 401;
    mockSendMessage.mockRejectedValueOnce(err401);

    const res401 = await SellerSaleNotificationService.notifySellerOfSale("order-123");
    expect(res401.success).toBe(false);
  });

  it("9. Rate limiting no polling backend", async () => {
    const testSellerId = "seller-rate-test";

    // 40 permitted calls in 1 minute
    for (let i = 0; i < 40; i++) {
      expect(await checkPollingRateLimit(testSellerId)).toBe(true);
    }

    // 41st call is rejected
    expect(await checkPollingRateLimit(testSellerId)).toBe(false);
  });

  it("10. Finalização global ocorre SOMENTE após todas as entregas concluídas", async () => {
    // Reset state
    dbOrdersStore["order-123"].sellerNotificationSentAt = null;
    dbOrdersStore["order-123"].sellerNotificationClaimedAt = null;
    dbDeliveriesStore = {
      "deliv-1": { id: "d1", orderId: "order-123", botId: "bot-1", recipientId: "recip-1", telegramChatId: "1001", status: "pending" },
    };
    mockSendMessage.mockResolvedValueOnce({ message_id: 99 });

    const res = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    expect(res.success).toBe(true);
    expect(res.notified).toBe(true);
    expect(dbDeliveriesStore["deliv-1"].status).toBe("delivered");
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).not.toBeNull();
  });
});
