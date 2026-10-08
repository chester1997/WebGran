import { describe, it, expect, vi, beforeEach } from "vitest";
import { SellerSaleNotificationService, formatBrtDateTime, formatBRL } from "../seller-sale-notification-service";
import { db } from "@/db";

const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 101 });

let dbOrdersStore: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn().mockImplementation(async () => {
          return dbOrdersStore["order-123"] || null;
        }),
      },
      stores: { findFirst: vi.fn() },
      orderItems: { findMany: vi.fn() },
      products: { findFirst: vi.fn() },
      telegramBots: { findFirst: vi.fn() },
    },
    execute: vi.fn().mockImplementation(async (queryParam: any) => {
      // Stringify Drizzle SQL object
      const queryStr = typeof queryParam === "string" 
        ? queryParam 
        : (queryParam?.sql || JSON.stringify(queryParam) || "");
      
      const order = dbOrdersStore["order-123"];

      if (queryStr.includes("seller_notification_claimed_at = NOW()")) {
        if (order && !order.sellerNotificationSentAt && !order.sellerNotificationClaimedAt) {
          order.sellerNotificationClaimedAt = new Date();
          order.sellerNotificationClaimToken = "token-123";
          return [{ id: order.id }];
        }
        return [];
      }

      if (queryStr.includes("seller_notification_sent_at = NOW()")) {
        if (order) {
          order.sellerNotificationSentAt = new Date();
          order.sellerNotificationClaimedAt = null;
          order.sellerNotificationClaimToken = null;
        }
        return [{ id: order?.id }];
      }

      if (queryStr.includes("seller_notification_claimed_at = NULL")) {
        if (order) {
          order.sellerNotificationClaimedAt = null;
          order.sellerNotificationClaimToken = null;
        }
        return [{ id: order?.id }];
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

describe("SellerSaleNotificationService & Tokenized Concurrent Idempotency Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 101 });

    dbOrdersStore = {
      "order-123": {
        id: "order-123",
        storeId: "store-seller-a",
        status: "paid",
        total: "6.00",
        sellerNotificationSentAt: null,
        sellerNotificationClaimedAt: null,
        sellerNotificationClaimToken: null,
        paidAt: new Date("2026-10-06T22:05:00Z"),
        customer: {
          firstName: "Andriele",
          lastName: null,
          telegramUserId: "7112951709",
        },
        items: [
          {
            productId: "prod-1",
          },
        ],
      },
    };

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-seller-a",
      ownerId: "user-seller-a",
      telegramNotificationId: "123456789",
    } as any);

    vi.mocked(db.query.products.findFirst).mockResolvedValue({
      id: "prod-1",
      title: "PERIGO E PAIXÃO",
      botId: "bot-1",
    } as any);

    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({
      id: "bot-1",
      displayName: "APP- NOSSA SÉRIE",
      tokenEncrypted: "encrypted_token_123",
    } as any);
  });

  it("formats BRL currency correctly", () => {
    expect(formatBRL(6)).toBe("R$ 6,00");
    expect(formatBRL(19.9)).toBe("R$ 19,90");
    expect(formatBRL(1500)).toBe("R$ 1.500,00");
  });

  it("formats BRT date time correctly", () => {
    const d = new Date("2026-10-06T22:05:00Z");
    const formatted = formatBrtDateTime(d);
    expect(formatted).toContain("06/10/2026 19:05 (BRT)");
  });

  it("sends formatted notification to seller when order is paid and Telegram ID is configured", async () => {
    const result = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    expect(result.success).toBe(true);
    expect(result.notified).toBe(true);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const [sentChatId, sentMessage] = mockSendMessage.mock.calls[0];
    expect(sentChatId).toBe("123456789");
    expect(sentMessage).toBe(
`🛒 Nova venda realizada!

📦 Produto: PERIGO E PAIXÃO
👤 Cliente: Andriele (ID: 7112951709)
💰 Valor: R$ 6,00
🤖 Bot: APP- NOSSA SÉRIE
📅 Data: 06/10/2026 19:05 (BRT)`
    );

    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).not.toBeNull();
  });

  it("handles CONCURRENT EXECUTIONS (Promise.all): sends EXACTLY ONE Telegram notification", async () => {
    const [res1, res2] = await Promise.all([
      SellerSaleNotificationService.notifySellerOfSale("order-123"),
      SellerSaleNotificationService.notifySellerOfSale("order-123"),
    ]);

    const notifiedCount = [res1, res2].filter((r) => r.notified).length;
    const skippedCount = [res1, res2].filter((r) => r.skipped).length;

    expect(notifiedCount).toBe(1);
    expect(skippedCount).toBe(1);

    // EXACTLY 1 Telegram call was performed
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).not.toBeNull();
  });

  it("preserves RETRY capability when Telegram API fails on first attempt", async () => {
    // Attempt 1: Telegram fails
    mockSendMessage.mockRejectedValueOnce(new Error("Telegram API 500 Network Error"));

    const res1 = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    expect(res1.success).toBe(false);
    expect(res1.error).toContain("Telegram API 500");

    // sellerNotificationSentAt must still be NULL and claim lock must be released (NULL)
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).toBeNull();
    expect(dbOrdersStore["order-123"].sellerNotificationClaimedAt).toBeNull();

    // Attempt 2: Telegram succeeds
    mockSendMessage.mockResolvedValueOnce({ message_id: 202 });

    const res2 = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    expect(res2.success).toBe(true);
    expect(res2.notified).toBe(true);
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).not.toBeNull();
  });

  it("skips notification without error if seller has no Telegram ID configured", async () => {
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce({
      id: "store-seller-a",
      telegramNotificationId: null,
    } as any);

    const result = await SellerSaleNotificationService.notifySellerOfSale("order-123");

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("no Telegram notification ID");
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(dbOrdersStore["order-123"].sellerNotificationSentAt).toBeNull();
  });

  it("ensures multi-tenant isolation: Seller A store does not notify Seller B Telegram ID", async () => {
    await SellerSaleNotificationService.notifySellerOfSale("order-123");

    const [sentChatId] = mockSendMessage.mock.calls[0];

    // Verify it sent strictly to Seller A's Telegram ID
    expect(sentChatId).toBe("123456789");
    expect(sentChatId).not.toBe("seller_b_telegram_id");
  });
});
