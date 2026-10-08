import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductVideoService } from "../product-video-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { BunnyStreamService } from "@/lib/bunny/stream";

process.env.BUNNY_STREAM_LIBRARY_ID = "123456";
process.env.BUNNY_STREAM_API_KEY = "test_api_key";
process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-1234.b-cdn.net";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ value: 0 }]),
    query: {
      products: { findFirst: vi.fn() },
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      productVideoAssignments: { findMany: vi.fn() },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "pv-123", bunnyVideoId: "bunny-123" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100, remaining: 100, isUnlimited: false, source: "PLAN" }),
  getSellerEntitlement: vi.fn().mockResolvedValue({ featureKey: "max_video_size_mb", type: "NUMERIC", value: 500, isUnlimited: false, source: "PLAN" }),
}));

describe("No per-file video MB size limit verification (FASE 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testFileSizes = [
    { name: "499 MB file", sizeBytes: 499 * 1024 * 1024 },
    { name: "500 MB file", sizeBytes: 500 * 1024 * 1024 },
    { name: "1 GB file", sizeBytes: 1024 * 1024 * 1024 },
    { name: "1.5 GB file", sizeBytes: 1.5 * 1024 * 1024 * 1024 },
    { name: "2 GB file", sizeBytes: 2 * 1024 * 1024 * 1024 },
  ];

  testFileSizes.forEach(({ name, sizeBytes }) => {
    it(`accepts ${name} when total plan storage quota is available`, async () => {
      vi.spyOn(StorageUsageService, "reserveStorageForUpload").mockResolvedValueOnce({
        allowed: true,
        usedBytes: 0,
        reservedBytes: 0,
        requestedBytes: sizeBytes,
        quotaBytes: 20 * 1024 * 1024 * 1024, // 20 GB quota
        remainingBytes: 20 * 1024 * 1024 * 1024,
        isUnlimited: false,
        reservationId: "res-test",
      });

      vi.spyOn(BunnyStreamService, "createVideo").mockResolvedValueOnce({
        videoId: "bunny-v-999",
        title: "Test Large Video",
      } as any);

      const session = await ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-test",
        storeId: "store-test",
        title: "Test Large Video",
        productId: "pending",
        fileSize: sizeBytes,
      });

      expect(session).toBeDefined();
      expect(session.productVideo.bunnyVideoId).toBe("bunny-v-999");
    });
  });

  it("rejects video upload when total storage quota is exceeded", async () => {
    const fileSize15GB = 1.5 * 1024 * 1024 * 1024;
    vi.spyOn(StorageUsageService, "reserveStorageForUpload").mockResolvedValueOnce({
      allowed: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      usedBytes: 19 * 1024 * 1024 * 1024,
      reservedBytes: 0,
      requestedBytes: fileSize15GB,
      quotaBytes: 20 * 1024 * 1024 * 1024,
      remainingBytes: 1 * 1024 * 1024 * 1024,
      isUnlimited: false,
      reason: "Capacidade de armazenamento insuficiente. Quota: 20.0GB.",
    });

    await expect(
      ProductVideoService.createProductVideoUploadSession({
        sellerId: "seller-test",
        storeId: "store-test",
        title: "Test 1.5GB Video Exceeding Quota",
        productId: "pending",
        fileSize: fileSize15GB,
      })
    ).rejects.toThrow(/Capacidade de armazenamento insuficiente/i);
  });
});
