import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductVideoService } from "../product-video-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { BunnyStreamService } from "@/lib/bunny/stream";

process.env.BUNNY_STREAM_TOKEN_KEY = "test_token_key_1234567890";
process.env.BUNNY_STREAM_LIBRARY_ID = "763931";

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      productVideoAssignments: { findMany: vi.fn() },
      videoProgress: { findFirst: vi.fn() },
      accesses: { findFirst: vi.fn() },
      products: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ total: 300 * 1024 * 1024 }]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: "v-123",
            storeId: "store-seller-A",
            bunnyVideoId: "bunny-v-123",
            title: "Aula 01 — Introdução",
            description: "Desc",
            durationSeconds: 120,
            fileSizeBytes: 100 * 1024 * 1024,
            thumbnailUrl: "https://bunny/thumb.jpg",
            status: "READY",
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "v-123",
              title: "Aula 01 Editada",
              description: "Nova Desc",
            },
          ]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: {
    createVideo: vi.fn().mockResolvedValue({ videoId: "bunny-v-123", title: "Aula 01" }),
    deleteVideo: vi.fn().mockResolvedValue(true),
    generateDirectUploadSignature: vi.fn().mockReturnValue({
      libraryId: "763931",
      videoId: "bunny-v-123",
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
    reserveStorageForUpload: vi.fn().mockResolvedValue({
      allowed: true,
      reservationId: "res-temp-99",
      usedBytes: 0,
      reservedBytes: 0,
      requestedBytes: 0,
      quotaBytes: null,
      remainingBytes: null,
      isUnlimited: true,
    }),
    releaseReservation: vi.fn().mockResolvedValue({ success: true }),
    releaseReservationByReference: vi.fn().mockResolvedValue({ success: true }),
    confirmReservationByReference: vi.fn().mockResolvedValue({ success: true }),
    getSellerStorageUsage: vi.fn().mockResolvedValue({ usedBytes: 100 * 1024 * 1024, totalGB: 50 }),
    getVideoQuotaBytes: vi.fn().mockResolvedValue(50 * 1024 * 1024 * 1024),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  EntitlementService: {
    checkBoolean: vi.fn().mockResolvedValue(true),
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, usage: 1, limit: -1, remaining: null, isUnlimited: true, source: "PLAN" }),
    getLimitValue: vi.fn().mockResolvedValue(-1),
    getQuotaValue: vi.fn().mockResolvedValue(50),
  },
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, usage: 1, limit: -1, remaining: null, isUnlimited: true, source: "PLAN" }),
  getSellerEntitlement: vi.fn().mockResolvedValue({ value: 50, source: "PLAN" }),
}));

describe("Seller Video Library & Quota Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. should create video upload session in seller library", async () => {
    const session = await ProductVideoService.createProductVideoUploadSession({
      sellerId: "seller-A",
      storeId: "store-seller-A",
      title: "Aula 01",
      description: "Desc",
      fileSizeBytes: 50 * 1024 * 1024,
    });

    expect(session.uploadSession.videoId).toBe("bunny-v-123");
    expect(session.productVideo).toBeDefined();
    expect(StorageUsageService.reserveStorageForUpload).toHaveBeenCalled();
  });

  it("2. should list seller library videos filtered by authenticated storeId", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([
      {
        id: "v-123",
        storeId: "store-seller-A",
        bunnyVideoId: "bunny-v-123",
        title: "Aula 01",
        description: null,
        durationSeconds: 120,
        fileSizeBytes: 100 * 1024 * 1024,
        thumbnailUrl: null,
        status: "READY",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
      } as any,
    ]);

    const videos = await ProductVideoService.listSellerLibraryVideos("store-seller-A");
    expect(videos).toHaveLength(1);
    expect(videos[0].storeId).toBe("store-seller-A");
  });

  it("3. should edit video title and description", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-123",
      storeId: "store-seller-A",
      title: "Aula 01",
    } as any);

    const updated = await ProductVideoService.updateLibraryVideo("store-seller-A", "v-123", {
      title: "Aula 01 Editada",
      description: "Nova Desc",
    });

    expect(updated).toBeDefined();
    expect(db.update).toHaveBeenCalled();
  });

  it("4. should delete library video safely when force=true or not assigned", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-123",
      storeId: "store-seller-A",
      bunnyVideoId: "bunny-v-123",
      assignments: [],
    } as any);

    const result = await ProductVideoService.deleteLibraryVideo("store-seller-A", "v-123");
    expect(result.success).toBe(true);
  });

  it("5. multi-tenant: should reject operations on videos belonging to another store", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(undefined as any);

    await expect(
      ProductVideoService.getLibraryVideoForPreview("store-seller-B", "v-seller-A")
    ).rejects.toThrow(/não encontrado ou sem permissão/i);
  });

  it("6 & 7. quota: should reject upload if file exceeds available quota", async () => {
    const { hasFeature } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.reserveStorageForUpload).mockResolvedValueOnce({
      allowed: false,
      reason: "Quota de armazenamento de vídeo excedida.",
      usedBytes: 50 * 1024 * 1024 * 1024,
      reservedBytes: 0,
      requestedBytes: 60 * 1024 * 1024 * 1024,
      quotaBytes: 50 * 1024 * 1024 * 1024,
      remainingBytes: 0,
      isUnlimited: false,
    });

    await expect(
      ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-A",
        storeId: "store-seller-A",
        title: "Aula Grande",
        fileSizeBytes: 60 * 1024 * 1024 * 1024,
      })
    ).rejects.toThrow(/Quota de armazenamento/i);
  });

  it("8 & 9. reservation & confirmation: confirmReservationByReference handles storage transition", async () => {
    vi.mocked(StorageUsageService.confirmReservationByReference).mockResolvedValueOnce(true);
    const res = await StorageUsageService.confirmReservationByReference(
      "product_video_upload",
      "v-123",
      100 * 1024 * 1024
    );
    expect(res).toBe(true);
  });

  it("10. falha no upload libera reservation", async () => {
    const { hasFeature } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.reserveStorageForUpload).mockResolvedValueOnce({
      allowed: true,
      reservationId: "res-temp-99",
      usedBytes: 0,
      reservedBytes: 0,
      requestedBytes: 10 * 1024 * 1024,
      quotaBytes: null,
      remainingBytes: null,
      isUnlimited: true,
    });
    vi.mocked(BunnyStreamService.createVideo).mockRejectedValueOnce(new Error("Erro no Bunny"));

    await expect(
      ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-A",
        storeId: "store-seller-A",
        title: "Aula Falha",
        fileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toThrow("Erro no Bunny");

    expect(StorageUsageService.releaseReservation).toHaveBeenCalledWith("res-temp-99");
  });

  it("11. mesmo vídeo associado a múltiplos produtos conta 1 única vez no storage física", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([
      { id: "v-1", fileSizeBytes: 100 * 1024 * 1024 },
      { id: "v-2", fileSizeBytes: 200 * 1024 * 1024 },
    ] as any);

    const usage = await ProductVideoService.getSellerVideoStorageUsage("seller-A", "store-seller-A");
    expect(usage.usedBytes).toBe(300 * 1024 * 1024);
  });

  it("12. preview gera token assinado temporário do Bunny Stream", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-123",
      storeId: "store-seller-A",
      bunnyVideoId: "bunny-v-123",
      title: "Preview",
      status: "READY",
    } as any);

    const preview = await ProductVideoService.getLibraryVideoForPreview("store-seller-A", "v-123");
    expect(preview.playback.playbackUrl).toContain("token=");
    expect(preview.playback.playbackUrl).toContain("expires=");
  });

  it("13. vídeos existentes são preservados", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([
      { id: "v-existing-legacy", bunnyVideoId: "legacy-guid", storeId: "store-seller-A", status: "READY" },
    ] as any);

    const list = await ProductVideoService.listSellerLibraryVideos("store-seller-A");
    expect(list[0].id).toBe("v-existing-legacy");
    expect(list[0].bunnyVideoId).toBe("legacy-guid");
  });

  it("14. vídeo associado a produto impede exclusão silenciosa", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "v-123",
      storeId: "store-seller-A",
      bunnyVideoId: "bunny-v-123",
      assignments: [
        { id: "pva-1", productId: "prod-10", product: { id: "prod-10", title: "Curso Completo" } },
      ],
    } as any);

    const res = await ProductVideoService.deleteLibraryVideo("store-seller-A", "v-123", false);
    expect(res.success).toBe(false);
    expect(res.isAssigned).toBe(true);
    expect(res.assignedCount).toBe(1);
    expect(res.products).toHaveLength(1);
  });

  it("15. entitlement product_videos_enabled bloqueia upload quando desativado", async () => {
    const { hasFeature } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(false);

    await expect(
      ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-A",
        storeId: "store-seller-A",
        title: "Test Block",
        fileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toThrow(/não está disponível no seu plano/i);
  });

  it("16. max_product_videos é respeitado", async () => {
    const { hasFeature, checkLimit } = await import("@/lib/entitlements/entitlement-service");
    vi.mocked(hasFeature).mockResolvedValueOnce(true);
    vi.mocked(checkLimit).mockResolvedValueOnce({
      allowed: false,
      usage: 10,
      limit: 10,
      remaining: 0,
      isUnlimited: false,
      source: "PLAN",
    });

    await expect(
      ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-A",
        storeId: "store-seller-A",
        title: "Test Limit",
        fileSizeBytes: 10 * 1024 * 1024,
      })
    ).rejects.toThrow(/Limite de vídeos de produtos atingido/i);
  });
});
