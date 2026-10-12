import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductVideoService } from "../product-video-service";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { GarbageCollectionService } from "@/lib/storage/lifecycle-service";

process.env.BUNNY_STREAM_TOKEN_KEY = "test_token_key_1234567890";
process.env.BUNNY_STREAM_LIBRARY_ID = "763931";
process.env.BUNNY_STREAM_API_KEY = "test_api_key";
process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-test.b-cdn.net";

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
        productVideoAssignments: { findMany: vi.fn() },
        accesses: { findFirst: vi.fn(), findMany: vi.fn() },
        storageReservations: { findFirst: vi.fn(), findMany: vi.fn() },
        pendingDeletions: { findFirst: vi.fn(), findMany: vi.fn() },
        stores: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue([]),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    },
  };
});

vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: {
    deleteVideo: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    releaseReservationForVideoUpload: vi.fn().mockResolvedValue({ success: true, released: true, status: "RELEASED" }),
    releaseReservationByReference: vi.fn().mockResolvedValue(true),
  },
}));

describe("Bulk Video Deletion & Commercial Protection Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Batch valid deletion: successfully deletes multiple videos", async () => {
    const { db } = await import("@/db");

    // Video 1 & Video 2 in store
    vi.mocked(db.query.productVideos.findFirst)
      .mockResolvedValueOnce({
        id: "vid-1",
        storeId: "store-1",
        bunnyVideoId: "bunny-1",
        product: null,
        assignments: [],
      } as any)
      .mockResolvedValueOnce({
        id: "vid-2",
        storeId: "store-1",
        bunnyVideoId: "bunny-2",
        product: null,
        assignments: [],
      } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValue(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValue({ success: true, released: true, status: "RELEASED" });

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-1", "vid-2"]
    );

    expect(result.success).toBe(true);
    expect(result.totalRequested).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("bunny-1");
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("bunny-2");
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-1"
    );
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-2"
    );
  });

  it("2. Validation: rejects empty selection or > 50 videos", async () => {
    await expect(
      ProductVideoService.bulkDeleteLibraryVideos("seller-1", "store-1", [])
    ).rejects.toThrow(/Nenhum vídeo selecionado/i);

    const over50 = Array.from({ length: 51 }, (_, i) => `vid-${i}`);
    await expect(
      ProductVideoService.bulkDeleteLibraryVideos("seller-1", "store-1", over50)
    ).rejects.toThrow(/Limite máximo de 50 vídeos/i);
  });

  it("3. Multi-tenant isolation: rejects videos not belonging to store", async () => {
    const { db } = await import("@/db");

    // Not found in store-1
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(undefined as any);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-alien"]
    );

    expect(result.success).toBe(false);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].id).toBe("vid-alien");
    expect(result.results[0].code).toBe("NOT_FOUND");
    expect(result.results[0].message).toMatch(/não encontrado ou sem permissão/i);
    expect(BunnyStreamService.deleteVideo).not.toHaveBeenCalled();
  });

  it("4. Mandatory Commercial Protection: BLOCKS deletion when product has ACTIVE buyer access, even if force=true", async () => {
    const { db } = await import("@/db");

    // Video assigned to product-1
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-active-product",
      storeId: "store-1",
      bunnyVideoId: "bunny-active",
      product: { id: "prod-1", title: "Curso de Cripto", slug: "curso-cripto" },
      assignments: [],
    } as any);

    // Active buyer accesses query returns count = 3
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      })),
    } as any);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-active-product"],
      { force: true } // force=true MUST NOT bypass active access protection!
    );

    expect(result.success).toBe(false);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].code).toBe("BLOCKED_ACTIVE_ACCESSES");
    expect(result.results[0].activeAccessCount).toBe(3);
    expect(result.results[0].message).toMatch(/acesso\(s\) ativo\(s\) de compradores/i);
    // Bunny and DB deletion must NOT be called
    expect(BunnyStreamService.deleteVideo).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("5. Allows deletion of product-assigned video when ACTIVE buyer accesses = 0 and force=true", async () => {
    const { db } = await import("@/db");

    // Video assigned to product-2
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-inactive-product",
      storeId: "store-1",
      bunnyVideoId: "bunny-inactive",
      product: { id: "prod-2", title: "Curso Antigo", slug: "curso-antigo" },
      assignments: [],
    } as any);

    // Active buyer accesses query returns count = 0
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      })),
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-inactive-product"],
      { force: true }
    );

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("bunny-inactive");
  });

  it("6. Bunny Stream failure: preserves Neon DB record and does not delete DB data", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-bunny-fail",
      storeId: "store-1",
      bunnyVideoId: "bunny-fail",
      product: null,
      assignments: [],
    } as any);

    // Bunny returns false (5xx or connection error)
    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(false);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-bunny-fail"]
    );

    expect(result.success).toBe(false);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].code).toBe("BUNNY_DELETE_FAILED");
    expect(result.results[0].message).toMatch(/preservado no sistema/i);
    // DB delete must NOT have been called
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("7. Neon DB failure after Bunny deletion: records recoverable entry in pendingDeletions", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-neon-fail",
      storeId: "store-1",
      bunnyVideoId: "bunny-neon-fail",
      product: null,
      assignments: [],
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // Neon delete throws an error
    vi.mocked(db.delete).mockImplementationOnce(() => {
      throw new Error("Neon connection terminated unexpectedly");
    });

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-neon-fail"]
    );

    expect(result.success).toBe(false);
    expect(result.results[0].code).toBe("NEON_CLEANUP_FAILED");
    expect(db.insert).toHaveBeenCalled();
  });

  it("8. Bunny 404 idempotency: treats 404 as success and completes deletion", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-404",
      storeId: "store-1",
      bunnyVideoId: "bunny-404",
      product: null,
      assignments: [],
    } as any);

    // BunnyStreamService deleteVideo returns true for 404 (already deleted)
    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-404"]
    );

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(db.delete).toHaveBeenCalled();
  });

  it("9. Partial batch failure: accurately reports successes and failures per video", async () => {
    const { db } = await import("@/db");

    // Vid 1 succeeds, Vid 2 fails at Bunny
    vi.mocked(db.query.productVideos.findFirst)
      .mockResolvedValueOnce({
        id: "vid-ok",
        storeId: "store-1",
        bunnyVideoId: "bunny-ok",
        product: null,
        assignments: [],
      } as any)
      .mockResolvedValueOnce({
        id: "vid-bad",
        storeId: "store-1",
        bunnyVideoId: "bunny-bad",
        product: null,
        assignments: [],
      } as any);

    vi.mocked(BunnyStreamService.deleteVideo)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-ok", "vid-bad"]
    );

    expect(result.success).toBe(false);
    expect(result.totalRequested).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);

    const resOk = result.results.find((r) => r.id === "vid-ok");
    const resBad = result.results.find((r) => r.id === "vid-bad");
    expect(resOk?.success).toBe(true);
    expect(resBad?.success).toBe(false);
    expect(resBad?.code).toBe("BUNNY_DELETE_FAILED");
  });

  it("10. Specific reservation release: releases reservation with exact sellerId and storeId", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-res",
      storeId: "store-99",
      bunnyVideoId: "bunny-res-99",
      product: null,
      assignments: [],
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);

    await ProductVideoService.deleteLibraryVideo(
      "store-99",
      "vid-res",
      false,
      "seller-owner-99"
    );

    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-owner-99",
      "store-99",
      "bunny-res-99"
    );
  });

  it("11. Reservation release failure: records pendingDeletions and leaves reservation trackable for retry", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-res-fail",
      storeId: "store-1",
      bunnyVideoId: "bunny-res-fail",
      product: null,
      assignments: [],
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // Neon delete succeeds
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    } as any);

    // Reservation release throws
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockRejectedValueOnce(
      new Error("Storage service connection timeout")
    );

    const result = await ProductVideoService.deleteLibraryVideo(
      "store-1",
      "vid-res-fail",
      false,
      "seller-1"
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("RESERVATION_RELEASE_FAILED");
    expect(db.insert).toHaveBeenCalled();
  });

  it("12. GarbageCollectionService handles provider bunny_stream_synced idempotently", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-1",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-vid-synced-1",
        resourceId: "vid-db-1",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({ success: true, released: true, status: "RELEASED" });

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(1);
    expect(gcResult.failed).toBe(0);
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("bunny-vid-synced-1");
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-vid-synced-1"
    );
    expect(db.update).toHaveBeenCalled();
  });

  it("13. Handles duplicate and invalid IDs in batch without falsely treating them as successful", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-valid",
      storeId: "store-1",
      bunnyVideoId: "bunny-valid",
      product: null,
      assignments: [],
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      "seller-1",
      "store-1",
      ["vid-valid", "vid-valid", "", "   "]
    );

    expect(result.success).toBe(false);
    expect(result.totalRequested).toBe(4);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(3);

    const validItem = result.results.find((r) => r.id === "vid-valid" && r.success);
    const duplicateItem = result.results.find((r) => r.id === "vid-valid" && !r.success);
    const emptyItems = result.results.filter((r) => r.code === "INVALID_ID");

    expect(validItem?.code).toBe("SUCCESS");
    expect(duplicateItem?.code).toBe("DUPLICATE_ID");
    expect(emptyItems.length).toBe(2);
  });

  it("14. Worker preserves Neon records and reservation when Bunny returns 5xx error or fails", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-bunny-err",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-err-500",
        resourceId: "vid-db-preserve",
        attempts: 1,
      } as any,
    ]);

    // Bunny returns false on 5xx or HTTP error
    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(false);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(0);
    expect(gcResult.failed).toBe(1);
    expect(BunnyStreamService.deleteVideo).toHaveBeenCalledWith("bunny-err-500");
    // Neon records must NOT be deleted
    expect(db.delete).not.toHaveBeenCalled();
    // Reservation must NOT be released
    expect(StorageUsageService.releaseReservationForVideoUpload).not.toHaveBeenCalled();
    expect(StorageUsageService.releaseReservationByReference).not.toHaveBeenCalled();
    // pendingDeletions must record attempt increment and NOT set processedAt
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: expect.stringContaining("Provider returned false"),
      })
    );
    expect(updateSetSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        processedAt: expect.anything(),
      })
    );
  });

  it("15. Worker preserves retryability when storage reservation release fails, and subsequent retry succeeds even if product_videos is already removed", async () => {
    const { db } = await import("@/db");

    // Attempt 1: Bunny succeeds, Neon DB deleted, but reservation release throws an error
    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-res-fail",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-res-retry",
        resourceId: "vid-db-res",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockRejectedValueOnce(
      new Error("Storage service connection timeout during reservation release")
    );

    const updateSetSpy1 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy1 } as any);

    const gcResult1 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult1.processed).toBe(0);
    expect(gcResult1.failed).toBe(1);
    // Neon records delete was called in first run
    expect(db.delete).toHaveBeenCalled();
    // pending_deletions must NOT set processedAt, but record attempt increment and error
    expect(updateSetSpy1).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: "Storage service connection timeout during reservation release",
      })
    );
    expect(updateSetSpy1).not.toHaveBeenCalledWith(
      expect.objectContaining({
        processedAt: expect.anything(),
      })
    );

    // Attempt 2 (Retry): product_videos is already gone in Neon, Bunny returns 404 (handled as true by BunnyStreamService)
    vi.clearAllMocks();

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-res-fail",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-res-retry",
        resourceId: "vid-db-res",
        attempts: 2,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    // Bunny returns true (already 404)
    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // Idempotent Neon delete succeeds
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    } as any);
    // Storage reservation release now succeeds
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({ success: true, released: true, status: "RELEASED" });

    const updateSetSpy2 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy2 } as any);

    const gcResult2 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult2.processed).toBe(1);
    expect(gcResult2.failed).toBe(0);
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-res-retry"
    );
    expect(updateSetSpy2).toHaveBeenCalledWith(
      expect.objectContaining({
        processedAt: expect.any(Date),
      })
    );
  });

  it("16. Worker conclui com sucesso idempotente quando loja é inexistente e não há reserva ativa órfã", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-no-store",
        storeId: "store-deleted",
        provider: "bunny_stream_synced",
        path: "bunny-no-store",
        resourceId: "vid-db-no-store",
        attempts: 1,
      } as any,
    ]);

    // Store is null / deleted
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(null as any);
    // No active orphan reservation exists
    vi.mocked(db.query.storageReservations.findFirst).mockResolvedValueOnce(null as any);
    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(1);
    expect(gcResult.failed).toBe(0);
    // Neon delete runs
    expect(db.delete).toHaveBeenCalled();
    // Reservation release is not called because no active reservation exists
    expect(StorageUsageService.releaseReservationForVideoUpload).not.toHaveBeenCalled();
    expect(StorageUsageService.releaseReservationByReference).not.toHaveBeenCalled();
    // Marked processed
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    );
  });

  it("17. Worker completes idempotently when reservation is not found or already released", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-res-missing",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-res-missing",
        resourceId: "vid-db-res-missing",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // releaseReservationForVideoUpload returns ALREADY_RELEASED_OR_NOT_FOUND (idempotent safe)
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: true,
      released: false,
      status: "ALREADY_RELEASED_OR_NOT_FOUND",
    } as any);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(1);
    expect(gcResult.failed).toBe(0);
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-res-missing"
    );
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    );
  });

  it("18. Worker strictly scopes reservation release to store owner, never affecting reservations of another seller", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-tenant-check",
        storeId: "store-seller-A",
        provider: "bunny_stream_synced",
        path: "bunny-shared-path-123",
        resourceId: "vid-db-seller-A",
        attempts: 1,
      } as any,
    ]);

    // Store belongs strictly to seller-A
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce({
      id: "store-seller-A",
      ownerId: "seller-A",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: true,
      released: true,
      status: "RELEASED",
    } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(1);
    expect(gcResult.failed).toBe(0);
    // Must be called with seller-A and store-seller-A ONLY
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-A",
      "store-seller-A",
      "bunny-shared-path-123"
    );
    // Must NOT be called with any other seller
    expect(StorageUsageService.releaseReservationForVideoUpload).not.toHaveBeenCalledWith(
      "seller-B",
      expect.anything(),
      expect.anything()
    );
    // Un-scoped releaseReservationByReference must NEVER be called
    expect(StorageUsageService.releaseReservationByReference).not.toHaveBeenCalled();
  });

  it("19. Worker keeps task pending for retry when active reservation release fails operationally", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-res-op-fail",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-res-op-fail",
        resourceId: "vid-db-op-fail",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // Active reservation exists but could not be released
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: false,
      released: false,
      status: "FAILED",
      error: "Active video storage reservation could not be released",
    } as any);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(0);
    expect(gcResult.failed).toBe(1);
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-1",
      "store-1",
      "bunny-res-op-fail"
    );
    // Must record attempt increment and error, and NOT set processedAt
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: "Active video storage reservation could not be released",
      })
    );
    expect(updateSetSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.anything() })
    );
  });

  it("20. Worker keeps task pending on DB exception during reservation release, and subsequent retry succeeds", async () => {
    const { db } = await import("@/db");

    // Attempt 1: DB connection failure during reservation release
    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-db-err",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-db-err",
        resourceId: "vid-db-err",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockRejectedValueOnce(
      new Error("Neon connection terminated during reservation release")
    );

    const updateSetSpy1 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy1 } as any);

    const gcResult1 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult1.processed).toBe(0);
    expect(gcResult1.failed).toBe(1);
    expect(updateSetSpy1).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: "Neon connection terminated during reservation release",
      })
    );
    expect(updateSetSpy1).not.toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.anything() })
    );

    // Attempt 2 (Retry): Reservation release succeeds
    vi.clearAllMocks();

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-db-err",
        storeId: "store-1",
        provider: "bunny_stream_synced",
        path: "bunny-db-err",
        resourceId: "vid-db-err",
        attempts: 2,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: "store-1",
      ownerId: "seller-1",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: true,
      released: true,
      status: "RELEASED",
    } as any);

    const updateSetSpy2 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy2 } as any);

    const gcResult2 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult2.processed).toBe(1);
    expect(gcResult2.failed).toBe(0);
    expect(updateSetSpy2).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    );
  });

  it("21. Loja inexistente com reserva ativa órfã: recupera identidade do proprietário original e libera com sucesso", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-orphan-1",
        storeId: "store-deleted-orphan",
        provider: "bunny_stream_synced",
        path: "bunny-orphan-video",
        resourceId: "vid-orphan-db",
        attempts: 1,
      } as any,
    ]);

    // Store does not exist in stores table
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(null as any);
    // Active orphaned reservation found with original owner identity
    vi.mocked(db.query.storageReservations.findFirst).mockResolvedValueOnce({
      id: "res-orphan-1",
      sellerId: "seller-original-owner",
      storeId: "store-deleted-orphan",
      referenceType: "product_video_upload",
      referenceId: "bunny-orphan-video",
      status: "ACTIVE",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: true,
      released: true,
      status: "RELEASED",
    } as any);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(1);
    expect(gcResult.failed).toBe(0);
    // Verified: releaseReservationForVideoUpload is called with the original owner and storeId
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-original-owner",
      "store-deleted-orphan",
      "bunny-orphan-video"
    );
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    );
  });

  it("22. Loja inexistente com reserva ativa órfã: falha na liberação mantém tarefa pendente para retentativa", async () => {
    const { db } = await import("@/db");

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-orphan-fail",
        storeId: "store-deleted-fail",
        provider: "bunny_stream_synced",
        path: "bunny-orphan-fail",
        resourceId: "vid-orphan-fail",
        attempts: 1,
      } as any,
    ]);

    // Store is null
    vi.mocked(db.query.stores.findFirst).mockResolvedValueOnce(null as any);
    // Active orphaned reservation found
    vi.mocked(db.query.storageReservations.findFirst).mockResolvedValueOnce({
      id: "res-orphan-fail",
      sellerId: "seller-original-owner",
      storeId: "store-deleted-fail",
      referenceType: "product_video_upload",
      referenceId: "bunny-orphan-fail",
      status: "ACTIVE",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    // Release fails operationally
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: false,
      released: false,
      status: "FAILED",
      error: "Active video storage reservation could not be released",
    } as any);

    const updateSetSpy = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy } as any);

    const gcResult = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult.processed).toBe(0);
    expect(gcResult.failed).toBe(1);
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: "Active video storage reservation could not be released",
      })
    );
    expect(updateSetSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.anything() })
    );
  });

  it("23. Loja inexistente com reserva ativa órfã: retentativa bem-sucedida após falha prévia", async () => {
    const { db } = await import("@/db");

    // Attempt 1: Loja inexistente, falha de rede/timeout durante a liberação da reserva órfã
    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-orphan-retry",
        storeId: "store-deleted-retry",
        provider: "bunny_stream_synced",
        path: "bunny-orphan-retry",
        resourceId: "vid-orphan-retry",
        attempts: 1,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue(null as any);
    vi.mocked(db.query.storageReservations.findFirst).mockResolvedValue({
      id: "res-orphan-retry",
      sellerId: "seller-retry-owner",
      storeId: "store-deleted-retry",
      referenceType: "product_video_upload",
      referenceId: "bunny-orphan-retry",
      status: "ACTIVE",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockRejectedValueOnce(
      new Error("Timeout during orphan reservation release")
    );

    const updateSetSpy1 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy1 } as any);

    const gcResult1 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult1.processed).toBe(0);
    expect(gcResult1.failed).toBe(1);
    expect(updateSetSpy1).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 2,
        lastError: "Timeout during orphan reservation release",
      })
    );
    expect(updateSetSpy1).not.toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.anything() })
    );

    // Attempt 2 (Retry): Sucesso na liberação da reserva órfã
    vi.clearAllMocks();

    vi.mocked(db.query.pendingDeletions.findMany).mockResolvedValueOnce([
      {
        id: "pd-orphan-retry",
        storeId: "store-deleted-retry",
        provider: "bunny_stream_synced",
        path: "bunny-orphan-retry",
        resourceId: "vid-orphan-retry",
        attempts: 2,
      } as any,
    ]);

    vi.mocked(db.query.stores.findFirst).mockResolvedValue(null as any);
    vi.mocked(db.query.storageReservations.findFirst).mockResolvedValue({
      id: "res-orphan-retry",
      sellerId: "seller-retry-owner",
      storeId: "store-deleted-retry",
      referenceType: "product_video_upload",
      referenceId: "bunny-orphan-retry",
      status: "ACTIVE",
    } as any);

    vi.mocked(BunnyStreamService.deleteVideo).mockResolvedValueOnce(true);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(StorageUsageService.releaseReservationForVideoUpload).mockResolvedValueOnce({
      success: true,
      released: true,
      status: "RELEASED",
    } as any);

    const updateSetSpy2 = vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(db.update).mockReturnValue({ set: updateSetSpy2 } as any);

    const gcResult2 = await GarbageCollectionService.processPendingDeletions(10);

    expect(gcResult2.processed).toBe(1);
    expect(gcResult2.failed).toBe(0);
    expect(StorageUsageService.releaseReservationForVideoUpload).toHaveBeenCalledWith(
      "seller-retry-owner",
      "store-deleted-retry",
      "bunny-orphan-retry"
    );
    expect(updateSetSpy2).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    );
  });
});


