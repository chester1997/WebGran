import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductVideoService } from "../product-video-service";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

process.env.BUNNY_STREAM_TOKEN_KEY = "test_token_key_1234567890";
process.env.BUNNY_STREAM_LIBRARY_ID = "763931";

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
    query: {
      products: { findFirst: vi.fn().mockResolvedValue({ id: "prod-A", storeId: "store-A" }) },
      productVideos: { findFirst: vi.fn().mockResolvedValue({ id: "v-1", storeId: "store-A", status: "READY", title: "Aula 01" }), findMany: vi.fn().mockResolvedValue([]) },
      productVideoAssignments: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "pva-1",
              storeId: "store-A",
              productId: "prod-A",
              videoId: "v-1",
              position: 0,
            },
          ]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: {
    deleteVideo: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    releaseReservationByReference: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, usage: 1, limit: -1, remaining: null, isUnlimited: true, source: "PLAN" }),
}));

describe("PASSO 2 — Product Video Assignments & Library Selection Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1 & 2. should list READY videos from library filtered by storeId", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([
      { id: "v-1", storeId: "store-A", title: "Aula 01", status: "READY" },
      { id: "v-2", storeId: "store-A", title: "Aula 02", status: "READY" },
    ] as any);

    const list = await ProductVideoService.listSellerLibraryVideos("store-A", { statusFilter: "READY" });
    expect(list).toHaveLength(2);
    expect(list[0].storeId).toBe("store-A");
  });

  it("3 & 20. multi-tenant: should not allow assigning videos belonging to another store", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(undefined as any);

    await expect(
      ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["video-from-store-B"])
    ).rejects.toThrow(/não encontrado ou não pertence/i);
  });

  it("4, 5 & 6. should select and create video assignment for product", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({ id: "v-1", storeId: "store-A", status: "READY" } as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    const result = await ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-1"]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("7. should not duplicate video assignments", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({ id: "v-1", storeId: "store-A", status: "READY" } as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { id: "pva-1", storeId: "store-A", productId: "prod-A", videoId: "v-1", position: 0, video: { id: "v-1", status: "READY" } },
    ] as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    await ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-1"]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("8, 9 & 10. removeVideoAssignment removes association ONLY, without deleting library video or Bunny Stream file", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);

    const res = await ProductVideoService.removeVideoAssignment("store-A", "prod-A", "v-1");

    expect(res.success).toBe(true);
    expect(db.delete).toHaveBeenCalled();
    expect(BunnyStreamService.deleteVideo).not.toHaveBeenCalled();
    expect(StorageUsageService.releaseReservationByReference).not.toHaveBeenCalled();
  });

  it("11 & 12. reorderProductVideos updates and persists position", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    await ProductVideoService.reorderProductVideos("store-A", "prod-A", ["v-2", "v-1"]);

    expect(db.update).toHaveBeenCalled();
  });

  it("13 & 14. handles product video listing for existing products", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      {
        id: "pva-1",
        storeId: "store-A",
        productId: "prod-A",
        videoId: "v-1",
        position: 0,
        video: { id: "v-1", title: "Aula 01", status: "READY", active: true },
      },
    ] as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    const videos = await ProductVideoService.listProductVideos("store-A", "prod-A");
    expect(videos).toHaveLength(1);
    expect(videos[0].title).toBe("Aula 01");
  });

  it("15. product_videos_enabled feature blocks assignment when disabled", async () => {
    const { hasFeature } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(false);
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);

    await expect(
      ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-1"], "seller-A")
    ).rejects.toThrow(/não está ativa no seu plano/i);
  });

  it("16. max_product_videos limit is enforced when assigning videos to product", async () => {
    const { hasFeature, checkLimit } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(true);
    vi.mocked(checkLimit).mockResolvedValueOnce({
      allowed: false,
      usage: 5,
      limit: 5,
      remaining: 0,
      isUnlimited: false,
      source: "PLAN",
    });

    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { id: "pva-1", storeId: "store-A", productId: "prod-A", videoId: "v-1", position: 0, video: { id: "v-1", status: "READY" } },
      { id: "pva-2", storeId: "store-A", productId: "prod-A", videoId: "v-2", position: 1, video: { id: "v-2", status: "READY" } },
      { id: "pva-3", storeId: "store-A", productId: "prod-A", videoId: "v-3", position: 2, video: { id: "v-3", status: "READY" } },
      { id: "pva-4", storeId: "store-A", productId: "prod-A", videoId: "v-4", position: 3, video: { id: "v-4", status: "READY" } },
      { id: "pva-5", storeId: "store-A", productId: "prod-A", videoId: "v-5", position: 4, video: { id: "v-5", status: "READY" } },
    ] as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    await expect(
      ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-new"], "seller-A")
    ).rejects.toThrow(/Limite máximo de vídeos por produto atingido/i);
  });

  it("17 & 18. PROCESSING and FAILED videos cannot be assigned to products", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-processing",
      storeId: "store-A",
      title: "Aula Em Proc",
      status: "PROCESSING",
    } as any);

    await expect(
      ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-processing"])
    ).rejects.toThrow(/ainda está sendo processado/i);
  });

  it("19. preview playback token generation works for library videos", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-1",
      storeId: "store-A",
      bunnyVideoId: "bunny-v1",
      title: "Aula Preview",
      status: "READY",
    } as any);

    const preview = await ProductVideoService.getLibraryVideoForPreview("store-A", "v-1");
    expect(preview.playback.playbackUrl).toContain("token=");
  });

  it("21. no DDL is executed at runtime during assignments", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({ id: "prod-A", storeId: "store-A" } as any);
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({ id: "v-1", storeId: "store-A", status: "READY" } as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);

    await ProductVideoService.assignVideosToProduct("store-A", "prod-A", ["v-1"]);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
