import { describe, it, expect, vi, beforeEach } from "vitest";
import { SellerSaleNotificationService, formatBrtDateTime, formatBRL } from "../seller-sale-notification-service";
import { db } from "@/db";

const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 101 });

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      orderItems: { findMany: vi.fn() },
      products: { findFirst: vi.fn() },
      telegramBots: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
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

describe("SellerSaleNotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 101 });
  });

  it("formats BRL currency correctly", () => {
    expect(formatBRL(6)).toBe("R$ 6,00");
    expect(formatBRL(19.9)).toBe("R$ 19,90");
    expect(formatBRL(1500)).toBe("R$ 1.500,00");
  });

  it("formats BRT date time correctly", () => {
    // 2026-10-06 22:05 UTC = 2026-10-06 19:05 BRT
    const d = new Date("2026-10-06T22:05:00Z");
    const formatted = formatBrtDateTime(d);
    expect(formatted).toContain("06/10/2026 19:05 (BRT)");
  });

  it("sends formatted notification to seller when order is paid and Telegram ID is configured", async () => {
    const mockOrder = {
      id: "order-123",
      storeId: "store-seller-a",
      status: "paid",
      total: "6.00",
      sellerNotificationSentAt: null,
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
    };

    const mockStore = {
      id: "store-seller-a",
      ownerId: "user-seller-a",
      telegramNotificationId: "123456789",
    };

    const mockProduct = {
      id: "prod-1",
      title: "PERIGO E PAIXÃO",
      botId: "bot-1",
    };

    const mockBot = {
      id: "bot-1",
      displayName: "APP- NOSSA SÉRIE",
      tokenEncrypted: "encrypted_token_123",
    };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce(mockProduct as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBot as any);

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
  });

  it("skips notification without error if seller has no Telegram ID configured", async () => {
    const mockOrder = {
      id: "order-124",
      storeId: "store-seller-no-id",
      status: "paid",
      total: "19.90",
      sellerNotificationSentAt: null,
      customer: { firstName: "Carlos", telegramUserId: "999888" },
      items: [],
    };

    const mockStore = {
      id: "store-seller-no-id",
      telegramNotificationId: null,
    };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);

    const result = await SellerSaleNotificationService.notifySellerOfSale("order-124");

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("no Telegram notification ID");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("skips notification without sending second message if order already has sellerNotificationSentAt (idempotency)", async () => {
    const mockOrder = {
      id: "order-dup-1",
      storeId: "store-seller-a",
      status: "paid",
      sellerNotificationSentAt: new Date(),
    };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);

    const result = await SellerSaleNotificationService.notifySellerOfSale("order-dup-1");

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("Notification already sent");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("catches Telegram send error gracefully and does not throw or fail sale", async () => {
    const mockOrder = {
      id: "order-err-1",
      storeId: "store-seller-a",
      status: "paid",
      total: "10.00",
      sellerNotificationSentAt: null,
      customer: { firstName: "Julia", telegramUserId: "111222" },
      items: [],
    };

    const mockStore = {
      id: "store-seller-a",
      telegramNotificationId: "999999",
    };

    const mockBot = {
      id: "bot-1",
      displayName: "Bot Teste",
      tokenEncrypted: "encrypted_token",
    };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBot as any);

    mockSendMessage.mockRejectedValueOnce(new Error("Telegram API 403 Forbidden: bot was blocked"));

    const result = await SellerSaleNotificationService.notifySellerOfSale("order-err-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Telegram API 403");
  });

  it("ensures multi-tenant isolation: Seller A store does not notify Seller B Telegram ID", async () => {
    const mockOrderSellerA = {
      id: "order-seller-a",
      storeId: "store-seller-a",
      status: "paid",
      total: "50.00",
      sellerNotificationSentAt: null,
      customer: { firstName: "Mariana", telegramUserId: "444555" },
      items: [],
    };

    const mockStoreSellerA = {
      id: "store-seller-a",
      ownerId: "user-seller-a",
      telegramNotificationId: "seller_a_telegram_id",
    };

    const mockBotSellerA = {
      id: "bot-seller-a",
      displayName: "Bot Seller A",
      tokenEncrypted: "token_a",
    };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrderSellerA as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStoreSellerA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBotSellerA as any);

    await SellerSaleNotificationService.notifySellerOfSale("order-seller-a");

    const [sentChatId] = mockSendMessage.mock.calls[0];

    // Verify it sent strictly to Seller A's Telegram ID
    expect(sentChatId).toBe("seller_a_telegram_id");
    expect(sentChatId).not.toBe("seller_b_telegram_id");
  });
});
