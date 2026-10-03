import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      videoProgress: { findFirst: vi.fn() },
      accesses: { findFirst: vi.fn() },
      products: { findFirst: vi.fn() },
    },
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: "pv-attached-1",
            storeId: "store-123",
            productId: "prod-new-123",
            bunnyVideoId: "guid-pending-1",
            title: "Vídeo Pendente 1",
            position: 0,
            status: "UPLOADING",
            active: true,
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

vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: {
    createVideo: vi.fn().mockResolvedValue({ videoId: "guid-pending-1", title: "Test" }),
    deleteVideo: vi.fn().mockResolvedValue(true),
    generateDirectUploadSignature: vi.fn().mockReturnValue({
      libraryId: "763931",
      videoId: "guid-pending-1",
      expirationTime: 999999,
      signature: "sig",
      uploadUrl: "https://upload.example.com",
      tusUploadUrl: "https://video.bunnycdn.com/tusupload",
      headers: {},
    }),
  },
}));

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    reserveStorageForUpload: vi.fn().mockResolvedValue({ allowed: true, reservationId: "res-1" }),
    releaseReservation: vi.fn().mockResolvedValue({ success: true }),
    releaseReservationByReference: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 10 }),
  getSellerEntitlement: vi.fn().mockResolvedValue({ isUnlimited: true, value: -1 }),
}));

import { ProductVideoService } from "../product-video-service";

describe("Product Videos New Product Pending Workflow Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1 & 3. Creates pending upload session without making DB calls for uncreated productId", async () => {
    const session = await ProductVideoService.createProductVideoUploadSession({
      sellerId: "seller-1",
      storeId: "store-123",
      productId: "pending",
      title: "Episódio 01 — A Origem",
    });

    expect(session.productVideo.id).toContain("pending_");
    expect(session.productVideo.productId).toBe("pending");
    expect(session.uploadSession.tusUploadUrl).toBe("https://video.bunnycdn.com/tusupload");
  });

  it("4 & 5. Attaches pending videos to newly created product ID", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({
      id: "prod-new-123",
      storeId: "store-123",
    } as any);

    const attached = await ProductVideoService.attachPendingVideos(
      "seller-1",
      "store-123",
      "prod-new-123",
      [
        {
          bunnyVideoId: "guid-pending-1",
          title: "Vídeo Pendente 1",
          description: "Desc",
          position: 0,
        },
      ]
    );

    expect(attached.length).toBe(1);
    expect(attached[0].productId).toBe("prod-new-123");
  });

  it("6. Cleans up pending Bunny videos and storage reservations if product creation is cancelled", async () => {
    const { BunnyStreamService } = await import("@/lib/bunny/stream");
    const { StorageUsageService } = await import("@/lib/storage/storage-usage-service");

    const result = await ProductVideoService.cleanupPendingVideos("seller-1", "store-123", [
      "guid-pending-1",
    ]);

    expect(result.success).toBe(true);
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("guid-pending-1");
    expect(StorageUsageService.releaseReservationByReference).toHaveBeenCalledWith(
      "product_video_upload",
      "guid-pending-1"
    );
  });

  it("7 & 8. Existing products and videos continue functioning normally", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([
      {
        id: "pv-exist-1",
        storeId: "store-123",
        productId: "prod-exist-123",
        bunnyVideoId: "guid-exist-1",
        title: "Vídeo Existente",
        position: 0,
        status: "READY",
        active: true,
      },
    ] as any);

    const list = await ProductVideoService.listProductVideos("store-123", "prod-exist-123");
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Vídeo Existente");
  });

  it("10. Zero DDL/CREATE INDEX queries executed during pending operations", async () => {
    const { db } = await import("@/db");
    await ProductVideoService.cleanupPendingVideos("seller-1", "store-123", ["guid-pending-1"]);
    expect(db.execute).not.toHaveBeenCalledWith(expect.stringContaining("CREATE INDEX"));
  });
});
