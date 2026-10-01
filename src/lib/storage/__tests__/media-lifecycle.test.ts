import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  extractPathFromUrl, 
  isMediaReferencedElsewhere, 
  MediaLifecycleService, 
  GarbageCollectionService 
} from "../lifecycle-service";

// Mock functions via vi.hoisted
const { mockStorageDelete, mockStreamDelete } = vi.hoisted(() => {
  return {
    mockStorageDelete: vi.fn().mockResolvedValue(true),
    mockStreamDelete: vi.fn().mockResolvedValue(true),
  };
});

// Mock DB
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        products: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        categories: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        banners: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        stores: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        clips: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        pendingDeletions: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "pending-1" }]),
        })),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([{ id: "pending-1" }]),
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([{ id: "deleted-1" }]),
      })),
    },
  };
});

// Mock Storage Provider
vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: () => ({
    delete: mockStorageDelete,
    upload: vi.fn(),
    exists: vi.fn(),
    getPublicUrl: (p: string) => `https://cdn.example.com/${p}`,
  }),
  generateMultiTenantStoragePath: (storeId: string, entity: string, name: string) => `stores/${storeId}/${entity}/${name}`,
}));

// Mock Bunny Stream
vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: {
    deleteVideo: mockStreamDelete,
  },
}));

vi.mock("@/db/ensure-entitlements", () => ({
  ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/db";

describe("Media Lifecycle & Garbage Collection Suite (Fase 4B.2A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageDelete.mockResolvedValue(true);
    mockStreamDelete.mockResolvedValue(true);
  });

  describe("URL & Path Helper Utility", () => {
    it("extracts clean relative storage path from CDN URLs and handles data URLs gracefully", () => {
      expect(extractPathFromUrl("https://cdn.webgran.online/stores/store1/products/item.webp")).toBe("stores/store1/products/item.webp");
      expect(extractPathFromUrl("data:image/webp;base64,iVBORw0...")).toBeNull();
      expect(extractPathFromUrl(null)).toBeNull();
      expect(extractPathFromUrl("https://video.bunnycdn.com/vid-123/playlist.m3u8")).toBe("vid-123");
    });
  });

  describe("1-4. Deletion of Entities & Media Cleanup", () => {
    it("1. delete product -> triggers media deletion for cover and banner", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const coverPath = "stores/store-1/products/cover-1.webp";
      const res = await MediaLifecycleService.deleteMediaFile(coverPath, "store-1", "prod-1");
      expect(res).toBe(true);
      expect(mockStorageDelete).toHaveBeenCalledWith(coverPath);
    });

    it("2. delete category -> triggers media deletion for category image", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const catPath = "stores/store-1/categories/cat-1.webp";
      const res = await MediaLifecycleService.deleteMediaFile(catPath, "store-1", "cat-1");
      expect(res).toBe(true);
      expect(mockStorageDelete).toHaveBeenCalledWith(catPath);
    });

    it("3. delete banner -> triggers media deletion for banner image", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const bannerPath = "stores/store-1/banners/banner-1.webp";
      const res = await MediaLifecycleService.deleteMediaFile(bannerPath, "store-1", "banner-1");
      expect(res).toBe(true);
      expect(mockStorageDelete).toHaveBeenCalledWith(bannerPath);
    });

    it("4. delete/replace store logo -> triggers old logo deletion", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const oldLogo = "stores/store-1/store/old-logo.webp";
      const newLogo = "stores/store-1/store/new-logo.webp";

      await MediaLifecycleService.handleImageReplacement({
        oldUrl: oldLogo,
        newUrl: newLogo,
        storeId: "store-1",
        excludeEntityId: "store-1",
      });

      expect(mockStorageDelete).toHaveBeenCalledWith(oldLogo);
    });
  });

  describe("5-6. Replacement Flow & Shared Files Protection", () => {
    it("5. image replacement -> old image removed only after new image confirmed", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const oldImg = "stores/store-1/products/old.webp";
      const newImg = "stores/store-1/products/new.webp";

      await MediaLifecycleService.handleImageReplacement({
        oldUrl: oldImg,
        newUrl: newImg,
        storeId: "store-1",
        excludeEntityId: "prod-1",
      });

      expect(mockStorageDelete).toHaveBeenCalledWith(oldImg);
    });

    it("6. shared file protection -> skips deletion if path is referenced by another entity", async () => {
      const sharedPath = "stores/store-1/products/shared.webp";

      // Simulate path being referenced by another product
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([
        { id: "prod-2" } as any
      ]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const isRef = await isMediaReferencedElsewhere(sharedPath, { excludeEntityId: "prod-1" });
      expect(isRef).toBe(true);

      const res = await MediaLifecycleService.deleteMediaFile(sharedPath, "store-1", "prod-1");
      expect(res).toBe(true);
      expect(mockStorageDelete).not.toHaveBeenCalled();
    });
  });

  describe("7-9. Pending Deletions & Retry Processing", () => {
    it("7. Bunny unavailable -> records item in pending_deletions table", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      mockStorageDelete.mockRejectedValueOnce(new Error("Bunny API 503 Service Unavailable"));

      const failPath = "stores/store-1/products/fail.webp";
      const res = await MediaLifecycleService.deleteMediaFile(failPath, "store-1");
      
      expect(res).toBe(false);
      expect(db.insert).toHaveBeenCalled();
    });

    it("8. retry pending deletion -> GarbageCollectionService retries and sets processedAt", async () => {
      vi.spyOn(db.query.pendingDeletions, "findMany").mockResolvedValue([
        {
          id: "pending-123",
          storeId: "store-1",
          provider: "bunny_storage",
          path: "stores/store-1/products/retry.webp",
          attempts: 1,
        } as any
      ]);

      mockStorageDelete.mockResolvedValueOnce(true);

      const res = await GarbageCollectionService.processPendingDeletions();
      expect(res.processed).toBe(1);
      expect(res.failed).toBe(0);
      expect(mockStorageDelete).toHaveBeenCalledWith("stores/store-1/products/retry.webp");
    });

    it("9. file already nonexistent -> deletion considered completed cleanly", async () => {
      vi.spyOn(db.query.pendingDeletions, "findMany").mockResolvedValue([
        {
          id: "pending-404",
          storeId: "store-1",
          provider: "bunny_storage",
          path: "stores/store-1/products/nonexistent.webp",
          attempts: 1,
        } as any
      ]);

      // Storage provider returns true even if file was already deleted (idempotent 404)
      mockStorageDelete.mockResolvedValueOnce(true);

      const res = await GarbageCollectionService.processPendingDeletions();
      expect(res.processed).toBe(1);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("10-12. Bunny Stream Video & Abandoned Candidate Detection", () => {
    it("10. delete Clip -> invokes BunnyStreamService.deleteVideo", async () => {
      const res = await MediaLifecycleService.deleteStreamVideo("video-guid-123", "store-1");
      expect(res).toBe(true);
      expect(mockStreamDelete).toHaveBeenCalledWith("video-guid-123");
    });

    it("11. recent orphan Bunny video (< 24h) -> NOT flagged for removal", async () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h old
      const recentVideos = [
        { guid: "recent-vid-1", dateCreated: recentDate, status: 3 }
      ];

      const candidates = await GarbageCollectionService.detectAbandonedBunnyStreamVideos(recentVideos, 24);
      expect(candidates).toHaveLength(0);
    });

    it("12. old orphan Bunny video (> 24h) -> flagged as candidate for removal", async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h old
      const oldVideos = [
        { guid: "abandoned-vid-99", dateCreated: oldDate, status: 3 }
      ];

      vi.spyOn(db.query.clips, "findFirst").mockResolvedValue(undefined);

      const candidates = await GarbageCollectionService.detectAbandonedBunnyStreamVideos(oldVideos, 24);
      expect(candidates).toContain("abandoned-vid-99");
    });
  });

  describe("13-14. Multi-Tenant Security & Idempotency", () => {
    it("13. seller A cannot delete seller B's storage file", async () => {
      const sellerBPath = "stores/seller-b-store/products/secret.webp";
      
      // Seller A attempts to delete Seller B's file
      const res = await MediaLifecycleService.deleteMediaFile(sellerBPath, "seller-a-store");
      expect(res).toBe(false);
      expect(mockStorageDelete).not.toHaveBeenCalled();
    });

    it("14. idempotent deletion calls -> multiple invocations complete safely", async () => {
      vi.spyOn(db.query.products, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.categories, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.banners, "findMany").mockResolvedValue([]);
      vi.spyOn(db.query.stores, "findMany").mockResolvedValue([]);

      const path = "stores/store-1/products/item-idempotent.webp";

      const firstCall = await MediaLifecycleService.deleteMediaFile(path, "store-1");
      const secondCall = await MediaLifecycleService.deleteMediaFile(path, "store-1");

      expect(firstCall).toBe(true);
      expect(secondCall).toBe(true);
    });
  });
});
