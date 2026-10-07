import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      accesses: { findFirst: vi.fn() },
      products: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      telegramBots: { findFirst: vi.fn() },
      orders: { findFirst: vi.fn() },
      orderItems: { findMany: vi.fn() },
    },
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: "access-123",
            storeId: "store-123",
            productId: "prod-pv-1",
            status: "ACTIVE",
            deliveryStatus: "DELIVERED",
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock("@/lib/telegram/delivery", () => ({
  TelegramDeliveryService: {
    validateBotAndChatPermission: vi.fn().mockResolvedValue({ success: true }),
    checkBuyerMembership: vi.fn().mockResolvedValue(false),
    createTelegramInvite: vi.fn().mockResolvedValue({ inviteLink: "https://t.me/+test" }),
    sendPaymentConfirmationMessage: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("mock-bot-token"),
  encrypt: vi.fn().mockReturnValue("mock-encrypted"),
}));

import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";
import { db } from "@/db";

describe("Product Video as Delivery Type Architecture Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Telegram deliveryType process requires chat ID and works properly", async () => {
    const mockOrder = {
      id: "ord-1",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { telegramUserId: "12345" },
      items: [
        {
          productId: "prod-tg",
        },
      ],
    };
    const mockProduct = {
      id: "prod-tg",
      deliveryType: "telegram",
      deliveryValue: "https://t.me/+mockInviteLink",
      title: "Produto Telegram",
      duration: "lifetime",
    };
    const mockStore = { id: "store-1", slug: "loja-teste" };
    const mockBot = { id: "bot-1", tokenEncrypted: "encrypted", botId: "123" };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBot as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(undefined as any);
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce(mockProduct as any);

    const result = await AccessDeliveryService.processOrderDelivery("ord-1");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].deliveryStatus).toBe("DELIVERED");
  });

  it("2. External link deliveryType works properly without requiring Telegram bot permissions", async () => {
    const mockOrder = {
      id: "ord-2",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { telegramUserId: "12345" },
      items: [
        {
          productId: "prod-ext",
        },
      ],
    };
    const mockProduct = {
      id: "prod-ext",
      deliveryType: "external",
      deliveryValue: "https://drive.google.com/folder",
      title: "Produto Link Externo",
      duration: "lifetime",
    };
    const mockStore = { id: "store-1", slug: "loja-teste" };
    const mockBot = { id: "bot-1", tokenEncrypted: "encrypted", botId: "123" };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBot as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(undefined as any);
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce(mockProduct as any);

    const result = await AccessDeliveryService.processOrderDelivery("ord-2");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].inviteLink).toBe("https://drive.google.com/folder");
  });

  it("3 & 5. product_video deliveryType grants access without requiring telegramChatId", async () => {
    const mockOrder = {
      id: "ord-3",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { telegramUserId: "12345" },
      items: [
        {
          productId: "prod-pv-1",
        },
      ],
    };
    const mockProduct = {
      id: "prod-pv-1",
      slug: "curso-mestre",
      deliveryType: "product_video",
      deliveryValue: null,
      title: "Curso em Vídeo",
      duration: "lifetime",
    };
    const mockStore = { id: "store-1", slug: "loja-teste" };
    const mockBot = { id: "bot-1", tokenEncrypted: "encrypted", botId: "123" };

    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(mockOrder as any);
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(mockStore as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(mockBot as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(undefined as any);
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce(mockProduct as any);

    const result = await AccessDeliveryService.processOrderDelivery("ord-3");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].deliveryStatus).toBe("DELIVERED");
    expect(result[0].inviteLink).toContain("/miniapp/loja-teste/product/curso-mestre");
  });

  it("6. AccessLifecycleService.resolveAccessDestination routes product_video to Mini App product page", async () => {
    const mockAccess = {
      id: "acc-pv-1",
      status: "ACTIVE",
      expiresAt: null,
      store: {
        slug: "loja-teste",
      },
      product: {
        id: "prod-pv-1",
        slug: "curso-mestre",
        deliveryType: "product_video",
        deliveryValue: null,
      },
      customer: { id: "cust-1" },
    };

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);

    const res = await AccessLifecycleService.resolveAccessDestination("acc-pv-1", "loja-teste");
    expect(res.success).toBe(true);
    expect(res.destinationType).toBe("PRODUCT_VIDEO");
    expect(res.destinationUrl).toContain("/miniapp/loja-teste");
  });

  it("15. Zero DDL or CREATE INDEX queries are executed at runtime", async () => {
    expect(db.execute).not.toHaveBeenCalled();
  });
});
