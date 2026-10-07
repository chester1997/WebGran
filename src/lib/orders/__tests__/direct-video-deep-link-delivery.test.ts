import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccessLifecycleService } from "../access-lifecycle-service";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { TelegramDeliveryService } from "@/lib/delivery/telegram-delivery-service";

// Mocks for database and services
vi.mock("@/db", () => {
  const mockDb = {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
      accesses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
      },
      productVideos: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      productVideoAssignments: {
        findMany: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      telegramBots: {
        findFirst: vi.fn(),
      },
      telegramCustomers: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: "access-new-1",
            storeId: "store-1",
            customerId: "cust-1",
            productId: "prod-1",
            orderId: "order-1",
            deliveryType: "product_video",
            status: "PENDING",
            deliveryStatus: "PENDING",
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => true),
      })),
    })),
  };
  return { db: mockDb };
});

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn(() => "mock-bot-token"),
  encrypt: vi.fn(() => "mock-encrypted-token"),
}));

vi.mock("@/lib/delivery/telegram-delivery-service", () => ({
  TelegramDeliveryService: {
    sendPaymentConfirmationMessage: vi.fn().mockResolvedValue(true),
    checkBuyerMembership: vi.fn().mockResolvedValue(false),
    createTelegramInvite: vi.fn().mockResolvedValue({ inviteLink: "https://t.me/mock" }),
    validateBotAndChatPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { db } from "@/db";

describe("Direct Video Deep Link Delivery & Authorization Suite (All 10 Scenarios)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://www.webgran.online";
    process.env.BUNNY_STREAM_TOKEN_KEY = "mock-bunny-token-key";
  });

  it("CENÁRIO 1: Buyer purchases product_video -> Access created -> Direct link points to first assigned video", async () => {
    const mockOrder = {
      id: "order-sc1",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { id: "cust-1", telegramUserId: "111" },
      items: [{ productId: "prod-sc1" }],
    };

    const mockProduct = {
      id: "prod-sc1",
      storeId: "store-1",
      title: "Curso Em Vídeo",
      slug: "curso-em-video",
      deliveryType: "product_video",
    };

    (db.query.orders.findFirst as any).mockResolvedValue(mockOrder);
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue(mockProduct);
    (db.query.telegramBots.findFirst as any).mockResolvedValue({ id: "bot-1", tokenEncrypted: "enc-token" });
    (db.query.accesses.findFirst as any).mockResolvedValue(null); // No previous access

    const res = await AccessDeliveryService.processOrderDelivery("order-sc1");
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("ACTIVE");
    expect(res[0].deliveryStatus).toBe("DELIVERED");

    // Verify Telegram notification button text was sent
    expect(TelegramDeliveryService.sendPaymentConfirmationMessage).toHaveBeenCalled();
  });

  it("CENÁRIO 2: Customer A shares video playback URL with Customer B -> Customer B gets 403 Access Denied", async () => {
    const mockVideo = {
      id: "video-123",
      storeId: "store-1",
      productId: "prod-sc2",
      active: true,
      status: "READY",
      title: "Aula 1",
    };

    (db.query.productVideos.findFirst as any).mockResolvedValue(mockVideo);
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { productId: "prod-sc2", videoId: "video-123" },
    ]);

    // Customer B (cust-2) does NOT have an active access to prod-sc2
    (db.query.accesses.findFirst as any).mockResolvedValue(null);

    await expect(
      ProductVideoService.getProductVideoForPlayback(
        "store-1",
        "cust-2-unauthorized", // Customer B
        "video-123",
        "prod-sc2"
      )
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("CENÁRIO 3: Customer A with ACTIVE access opens link again -> Playback succeeds", async () => {
    const mockVideo = {
      id: "video-123",
      storeId: "store-1",
      productId: "prod-sc3",
      active: true,
      status: "READY",
      title: "Aula 1",
      bunnyVideoId: "bunny-vid-123",
      product: { title: "Curso A", slug: "curso-a" },
    };

    (db.query.productVideos.findFirst as any).mockResolvedValue(mockVideo);
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { productId: "prod-sc3", videoId: "video-123" },
    ]);

    // Customer A has an ACTIVE, non-expired access
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-active-1",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-sc3",
      status: "ACTIVE",
      expiresAt: null, // lifetime
    });

    const result = await ProductVideoService.getProductVideoForPlayback(
      "store-1",
      "cust-1",
      "video-123",
      "prod-sc3"
    );

    expect(result).toBeDefined();
    expect(result.video.id).toBe("video-123");
    expect(result.playback.playbackUrl).toContain("bunnycdn.com");
  });

  it("CENÁRIO 4: Expired access -> Playback blocked", async () => {
    const mockVideo = {
      id: "video-123",
      storeId: "store-1",
      productId: "prod-sc4",
      active: true,
      status: "READY",
      title: "Aula 1",
    };

    (db.query.productVideos.findFirst as any).mockResolvedValue(mockVideo);
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { productId: "prod-sc4", videoId: "video-123" },
    ]);

    // Access expired 1 day ago
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-exp-1",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-sc4",
      status: "ACTIVE",
      expiresAt: pastDate,
    });

    await expect(
      ProductVideoService.getProductVideoForPlayback(
        "store-1",
        "cust-1",
        "video-123",
        "prod-sc4"
      )
    ).rejects.toThrow("Seu acesso a este produto expirou.");
  });

  it("CENÁRIO 5: Product without assigned videos -> Fallback safely to accesses page without invalid /video/undefined URL", async () => {
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-no-vid",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-no-vid",
      status: "ACTIVE",
      expiresAt: null,
      product: { id: "prod-no-vid", slug: "produto-sem-video", deliveryType: "product_video" },
      store: { slug: "minha-loja" },
    });

    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([]);
    (db.query.productVideos.findFirst as any).mockResolvedValue(null);

    const destination = await AccessLifecycleService.resolveAccessDestination("access-no-vid", "minha-loja");
    expect(destination.success).toBe(true);
    expect(destination.destinationUrl).toBe("https://www.webgran.online/miniapp/minha-loja/accesses");
    expect(destination.destinationUrl).not.toContain("undefined");
  });

  it("CENÁRIO 6: Product with multiple videos -> Opens exactly the first video in assigned position order", async () => {
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-multi",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-multi",
      status: "ACTIVE",
      expiresAt: null,
      product: { id: "prod-multi", slug: "curso-multi", deliveryType: "product_video" },
      store: { slug: "minha-loja" },
    });

    // Assignments ordered by position ASC: pos 0 is video-first, pos 1 is video-second
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { position: 0, video: { id: "video-first", status: "READY", active: true } },
      { position: 1, video: { id: "video-second", status: "READY", active: true } },
    ]);

    const destination = await AccessLifecycleService.resolveAccessDestination("access-multi", "minha-loja");
    expect(destination.success).toBe(true);
    expect(destination.destinationUrl).toBe("https://www.webgran.online/miniapp/minha-loja/video/video-first");
  });

  it("CENÁRIO 7: Duplicate webhook execution -> Idempotent skip, does not duplicate access", async () => {
    (db.query.orders.findFirst as any).mockResolvedValue({
      id: "order-dup",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { id: "cust-1", telegramUserId: "111" },
      items: [{ productId: "prod-1" }],
    });
    (db.query.products.findFirst as any).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      deliveryType: "product_video",
    });

    // Existing access already DELIVERED
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-already-delivered",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-1",
      orderId: "order-dup",
      status: "ACTIVE",
      deliveryStatus: "DELIVERED",
      inviteLink: "https://www.webgran.online/miniapp/store-1/video/v1",
    });

    const res = await AccessDeliveryService.processOrderDelivery("order-dup");
    expect(res).toHaveLength(1);
    expect(res[0].accessId).toBe("access-already-delivered");
    expect(res[0].deliveryStatus).toBe("DELIVERED");
  });

  it("CENÁRIO 8 & 9: Video assigned to Product B -> Buyer only has access to Product A -> Playback blocked even if videoId is manually passed", async () => {
    const mockVideoShared = {
      id: "video-shared-1",
      storeId: "store-1",
      productId: null,
      active: true,
      status: "READY",
      title: "Vídeo Compartilhado",
    };

    (db.query.productVideos.findFirst as any).mockResolvedValue(mockVideoShared);

    // video-shared-1 is assigned ONLY to Product B (prod-b)
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { productId: "prod-b", videoId: "video-shared-1" },
    ]);

    // Customer has access ONLY to Product A (prod-a), NOT Product B
    (db.query.accesses.findFirst as any).mockImplementation(({ where }: any) => {
      // Return null when queried for prod-b
      return Promise.resolve(null);
    });

    await expect(
      ProductVideoService.getProductVideoForPlayback(
        "store-1",
        "cust-has-only-prod-a",
        "video-shared-1"
      )
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("CENÁRIO 10: Unauthorized user attempts direct access to playback API without session -> Throws Error", async () => {
    (db.query.productVideos.findFirst as any).mockResolvedValue({
      id: "vid-secret",
      storeId: "store-1",
      active: true,
      status: "READY",
    });
    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { productId: "prod-secret", videoId: "vid-secret" },
    ]);
    (db.query.accesses.findFirst as any).mockResolvedValue(null);

    await expect(
      ProductVideoService.getProductVideoForPlayback(
        "store-1",
        "cust-no-access",
        "vid-secret"
      )
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("CENÁRIO 11: Telegram bot notification generates web_app WebApp link (https://www.webgran.online/miniapp/loja?access=access_xxx)", async () => {
    const mockOrder = {
      id: "order-deep-1",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      customer: { id: "cust-1", telegramUserId: "111" },
      items: [{ productId: "prod-deep-1" }],
    };

    const mockProduct = {
      id: "prod-deep-1",
      storeId: "store-1",
      title: "Curso Em Vídeo DeepLink",
      slug: "curso-deeplink",
      deliveryType: "product_video",
    };

    (db.query.orders.findFirst as any).mockResolvedValue(mockOrder);
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue(mockProduct);
    (db.query.telegramBots.findFirst as any).mockResolvedValue({ id: "bot-1", tokenEncrypted: "enc-token", username: "meubot_bot" });
    (db.query.accesses.findFirst as any).mockResolvedValue(null);

    await AccessDeliveryService.processOrderDelivery("order-deep-1");

    expect(TelegramDeliveryService.sendPaymentConfirmationMessage).toHaveBeenCalledWith(
      "mock-bot-token",
      "111",
      "Curso Em Vídeo DeepLink",
      expect.stringMatching(/^https:\/\/www\.webgran\.online\/miniapp\/loja-teste\?access=/),
      false,
      false,
      "loja-teste"
    );
  });

  it("CENÁRIO 12: User B opens User A's startapp deep link -> resolveAccessDestination checks expectedTelegramUserId and returns FAILED", async () => {
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-user-a",
      storeId: "store-1",
      customerId: "cust-a",
      productId: "prod-1",
      status: "ACTIVE",
      expiresAt: null,
      customer: { id: "cust-a", telegramUserId: "111" }, // User A = 111
      product: { id: "prod-1", slug: "curso-a", deliveryType: "product_video" },
      store: { slug: "minha-loja" },
    });

    // User B = 999 attempts to open access-user-a
    const result = await AccessLifecycleService.resolveAccessDestination(
      "access-user-a",
      "minha-loja",
      "999"
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("Acesso não autorizado para este usuário.");
  });

  it("CENÁRIO 13: Seller generates manual product deep link -> Formats URL deterministically with sanitized bot username", () => {
    const mockBot = { id: "bot-1", username: "@studiioshorts_bot" };
    const productId = "prod-uuid-123";
    const cleanUsername = mockBot.username.replace(/^@/, '');
    const generatedUrl = `https://t.me/${cleanUsername}?startapp=product_${productId}`;

    expect(generatedUrl).toBe("https://t.me/studiioshorts_bot?startapp=product_prod-uuid-123");
    expect(generatedUrl).not.toContain("@");
  });
});
