import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      productVideoAssignments: { findMany: vi.fn() },
      accesses: { findFirst: vi.fn() },
      products: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      telegramBots: { findFirst: vi.fn() },
      videoProgress: { findFirst: vi.fn() },
    },
    execute: vi.fn(),
  },
}));

import { ProductVideoService } from "@/lib/videos/product-video-service";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";
import { db } from "@/db";

describe("Meus Acessos & Product Video Delivery UI Navigation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUNNY_STREAM_TOKEN_KEY = "test-token-key-mock";
  });

  it("1. External link product resolves destinationType DIRECT_CHAT for Telegram button", async () => {
    const mockAccess = {
      id: "acc-ext-1",
      status: "ACTIVE",
      expiresAt: null,
      store: { slug: "minha-loja" },
      product: {
        id: "prod-ext-1",
        slug: "link-telegram",
        deliveryType: "external",
        deliveryValue: "https://t.me/+joinGroup",
      },
      customer: { id: "cust-1" },
    };

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);

    const res = await AccessLifecycleService.resolveAccessDestination("acc-ext-1", "minha-loja");
    expect(res.success).toBe(true);
    expect(res.destinationType).toBe("DIRECT_CHAT");
    expect(res.destinationUrl).toBe("https://t.me/+joinGroup");
  });

  it("2 & 3. product_video deliveryType resolves destinationType PRODUCT_VIDEO pointing to Mini App product page", async () => {
    const mockAccess = {
      id: "acc-pv-1",
      status: "ACTIVE",
      expiresAt: null,
      store: { slug: "minha-loja" },
      product: {
        id: "prod-pv-1",
        slug: "a-loba-negra-rejeitada",
        deliveryType: "product_video",
        deliveryValue: null,
      },
      customer: { id: "cust-1" },
    };

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);

    const res = await AccessLifecycleService.resolveAccessDestination("acc-pv-1", "minha-loja");
    expect(res.success).toBe(true);
    expect(res.destinationType).toBe("PRODUCT_VIDEO");
    expect(res.destinationUrl).toContain("/miniapp/minha-loja/product/a-loba-negra-rejeitada");
  });

  it("4 & 6 & 10. Product page with valid access lists READY videos with correct order and metadata", async () => {
    const mockAccess = {
      id: "acc-1",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-1",
      status: "ACTIVE",
      expiresAt: null,
    };

    const mockAssignments = [
      {
        position: 0,
        video: {
          id: "vid-1",
          title: "Episódio 1 - O Início",
          description: "Primeiro episódio",
          position: 0,
          durationSeconds: 2333,
          thumbnailUrl: "https://bunny.net/thumb1.jpg",
          status: "READY",
          active: true,
        },
      },
      {
        position: 1,
        video: {
          id: "vid-2",
          title: "Episódio 2 - A Revelação",
          description: "Segundo episódio",
          position: 1,
          durationSeconds: 1800,
          thumbnailUrl: "https://bunny.net/thumb2.jpg",
          status: "READY",
          active: true,
        },
      },
    ];

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignments as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValue(null as any);

    const videos = await ProductVideoService.listCustomerProductVideos("store-1", "cust-1", "prod-1");
    expect(videos).toHaveLength(2);
    expect(videos[0].title).toBe("Episódio 1 - O Início");
    expect(videos[0].durationSeconds).toBe(2333);
    expect(videos[1].title).toBe("Episódio 2 - A Revelação");
  });

  it("5. Client without valid access receives access denied error when attempting to fetch product videos", async () => {
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(undefined as any);

    await expect(
      ProductVideoService.listCustomerProductVideos("store-1", "cust-unauthorized", "prod-1")
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("7. PROCESSING video is NOT released to buyer for playback", async () => {
    const mockVideoProcessing = {
      id: "vid-proc",
      storeId: "store-1",
      productId: "prod-1",
      status: "PROCESSING",
      active: true,
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockVideoProcessing as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-proc")
    ).rejects.toThrow("Este vídeo ainda está em processamento e não pode ser reproduzido.");
  });

  it("8 & 9. Clicking Assistir for READY video authorizes playback with signed Bunny URL and existing progress", async () => {
    const mockReadyVideo = {
      id: "vid-ready-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-vid-999",
      status: "READY",
      active: true,
    };

    const mockAssignment = [{ productId: "prod-1", videoId: "vid-ready-1", storeId: "store-1" }];
    const mockAccess = { status: "ACTIVE", expiresAt: null };
    const mockProgress = {
      positionSeconds: 120,
      durationSeconds: 1800,
      progressPercent: "6.67",
      completed: false,
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockReadyVideo as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignment as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(mockProgress as any);

    const result = await ProductVideoService.getProductVideoForPlayback(
      "store-1",
      "cust-1",
      "vid-ready-1",
      "prod-1"
    );

    expect(result.video.id).toBe("vid-ready-1");
    expect(result.playback.playbackUrl).toContain("bunny-vid-999");
    expect(result.progress?.positionSeconds).toBe(120);
  });
});
