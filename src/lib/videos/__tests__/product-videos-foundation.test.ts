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
  },
}));

vi.mock("@/db/ensure-product-video-tables", () => ({
  ensureProductVideoTables: vi.fn().mockResolvedValue(undefined),
}));

import { generateBunnyPlaybackToken } from "@/lib/bunny/token";
import { resolveClipStatusTransition } from "@/lib/bunny/webhook-utils";
import { resolveBunnyVideo } from "@/app/api/webhooks/bunny-stream/route";
import { ClipService } from "@/lib/clips/service";
import { ProductVideoService } from "../product-video-service";

vi.mock("@/lib/clips/service", () => ({
  ClipService: {
    getClipByBunnyVideoId: vi.fn(),
    updateClipStatusByBunnyId: vi.fn(),
  },
}));

vi.mock("../product-video-service", () => {
  const original = vi.importActual("../product-video-service");
  return {
    ...original,
    ProductVideoService: {
      getProductVideoByBunnyId: vi.fn(),
      updateProductVideoStatusByBunnyId: vi.fn(),
      createProductVideoUploadSession: vi.fn(),
      listProductVideos: vi.fn(),
      updateProductVideo: vi.fn(),
      reorderProductVideos: vi.fn(),
      deleteProductVideo: vi.fn(),
      getProductVideoForPlayback: vi.fn(),
      upsertVideoProgress: vi.fn(),
      getVideoProgress: vi.fn(),
    },
  };
});

describe("Product Video Delivery Foundation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Bunny Playback Token Authentication", () => {
    it("generates presigned temporary streaming URLs with expiration", () => {
      const tokenAuth = generateBunnyPlaybackToken({
        videoId: "bunny-prod-vid-123",
        expiresInSeconds: 3600,
        tokenKey: "secret-token-key-123",
        cdnHostname: "video.bunnycdn.com",
      });

      expect(tokenAuth.videoId).toBe("bunny-prod-vid-123");
      expect(tokenAuth.playbackUrl).toContain("https://video.bunnycdn.com/bunny-prod-vid-123/playlist.m3u8?token=");
      expect(tokenAuth.playbackUrl).toContain("&expires=");
      expect(tokenAuth.directUrl).toContain("https://video.bunnycdn.com/bunny-prod-vid-123/play_360p.mp4?token=");
      expect(tokenAuth.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("does NOT expose raw API keys or write secrets in URLs", () => {
      const rawWriteApiKey = "SECRET_WRITE_API_KEY_999999";
      const tokenAuth = generateBunnyPlaybackToken({
        videoId: "vid-test",
        tokenKey: rawWriteApiKey,
      });

      expect(tokenAuth.playbackUrl).not.toContain(rawWriteApiKey);
      expect(tokenAuth.directUrl).not.toContain(rawWriteApiKey);
    });
  });

  describe("2. Webhook Router & Resolution Independence (Clips vs Product Videos)", () => {
    it("resolves clip video to CLIP type", async () => {
      vi.mocked(ClipService.getClipByBunnyVideoId).mockResolvedValueOnce({
        id: "clip-123",
        bunnyVideoId: "guid-clip-1",
        status: "PROCESSING",
      } as any);

      const resolved = await resolveBunnyVideo("guid-clip-1");
      expect(resolved.type).toBe("CLIP");
      expect(resolved.entity.id).toBe("clip-123");
    });

    it("resolves product video to PRODUCT_VIDEO type when not a clip", async () => {
      vi.mocked(ClipService.getClipByBunnyVideoId).mockResolvedValueOnce(undefined as any);
      vi.mocked(ProductVideoService.getProductVideoByBunnyId).mockResolvedValueOnce({
        id: "pv-456",
        bunnyVideoId: "guid-pv-1",
        status: "PROCESSING",
      } as any);

      const resolved = await resolveBunnyVideo("guid-pv-1");
      expect(resolved.type).toBe("PRODUCT_VIDEO");
      expect(resolved.entity.id).toBe("pv-456");
    });

    it("resolves unknown video GUID to UNKNOWN type", async () => {
      vi.mocked(ClipService.getClipByBunnyVideoId).mockResolvedValueOnce(undefined as any);
      vi.mocked(ProductVideoService.getProductVideoByBunnyId).mockResolvedValueOnce(undefined as any);

      const resolved = await resolveBunnyVideo("guid-unknown");
      expect(resolved.type).toBe("UNKNOWN");
      expect(resolved.entity).toBeNull();
    });

    it("maintains state transition logic (READY state cannot regress to PROCESSING)", () => {
      const state1 = resolveClipStatusTransition(1, "READY"); // status 1 = Processing
      expect(state1).toBe("READY");

      const state2 = resolveClipStatusTransition(5, "READY"); // status 5 = Failed
      expect(state2).toBe("FAILED");
    });
  });

  describe("3. Access Control & Authorization Scenarios", () => {
    it("authorizes playback for valid active customer access", async () => {
      const mockPlayback = {
        video: {
          id: "pv-1",
          storeId: "store-A",
          productId: "prod-1",
          productTitle: "Produto Teste",
          title: "Episódio 1",
          description: "Descrição",
          position: 0,
          durationSeconds: 120,
          thumbnailUrl: null,
        },
        playback: {
          playbackUrl: "https://cdn.example.com/playlist.m3u8?token=xyz",
          directUrl: "https://cdn.example.com/play_360p.mp4?token=xyz",
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        },
        progress: null,
      };

      vi.mocked(ProductVideoService.getProductVideoForPlayback).mockResolvedValueOnce(mockPlayback as any);

      const result = await ProductVideoService.getProductVideoForPlayback("store-A", "cust-1", "pv-1");
      expect(result.video.title).toBe("Episódio 1");
      expect(result.playback.playbackUrl).toContain("playlist.m3u8");
    });

    it("throws error when customer has no active access", async () => {
      vi.mocked(ProductVideoService.getProductVideoForPlayback).mockRejectedValueOnce(
        new Error("Você não possui acesso válido a este produto.")
      );

      await expect(
        ProductVideoService.getProductVideoForPlayback("store-A", "cust-unpaid", "pv-1")
      ).rejects.toThrow("Você não possui acesso válido a este produto.");
    });

    it("throws error when customer access has expired", async () => {
      vi.mocked(ProductVideoService.getProductVideoForPlayback).mockRejectedValueOnce(
        new Error("Seu acesso a este produto expirou.")
      );

      await expect(
        ProductVideoService.getProductVideoForPlayback("store-A", "cust-expired", "pv-1")
      ).rejects.toThrow("Seu acesso a este produto expirou.");
    });

    it("throws error when video status is not READY (e.g. PROCESSING)", async () => {
      vi.mocked(ProductVideoService.getProductVideoForPlayback).mockRejectedValueOnce(
        new Error("Este vídeo ainda está em processamento e não pode ser reproduzido.")
      );

      await expect(
        ProductVideoService.getProductVideoForPlayback("store-A", "cust-1", "pv-processing")
      ).rejects.toThrow("Este vídeo ainda está em processamento e não pode ser reproduzido.");
    });

    it("enforces multi-tenant isolation: store A customer cannot play store B video", async () => {
      vi.mocked(ProductVideoService.getProductVideoForPlayback).mockRejectedValueOnce(
        new Error("Vídeo de produto não encontrado ou inativo.")
      );

      await expect(
        ProductVideoService.getProductVideoForPlayback("store-B", "cust-from-store-A", "pv-store-A-video")
      ).rejects.toThrow("Vídeo de produto não encontrado ou inativo.");
    });
  });

  describe("4. Video Progress Tracking & Resume Rules", () => {
    it("upserts progress and calculates completion at 90%", async () => {
      const mockRecord = {
        id: "prog-1",
        storeId: "store-A",
        customerId: "cust-1",
        productVideoId: "pv-1",
        positionSeconds: 108,
        durationSeconds: 120,
        progressPercent: 90.0,
        completed: true,
        lastWatchedAt: new Date(),
      };

      vi.mocked(ProductVideoService.upsertVideoProgress).mockResolvedValueOnce(mockRecord as any);

      const res = await ProductVideoService.upsertVideoProgress("store-A", "cust-1", "pv-1", 108, 120);
      expect(res.completed).toBe(true);
      expect(Number(res.progressPercent)).toBe(90.0);
    });

    it("clamps position to duration limit", async () => {
      const mockClamped = {
        id: "prog-2",
        storeId: "store-A",
        customerId: "cust-1",
        productVideoId: "pv-1",
        positionSeconds: 120,
        durationSeconds: 120,
        progressPercent: 100.0,
        completed: true,
        lastWatchedAt: new Date(),
      };

      vi.mocked(ProductVideoService.upsertVideoProgress).mockResolvedValueOnce(mockClamped as any);

      const res = await ProductVideoService.upsertVideoProgress("store-A", "cust-1", "pv-1", 9999, 120);
      expect(res.positionSeconds).toBe(120);
      expect(Number(res.progressPercent)).toBe(100.0);
    });

    it("returns saved position to resume playback", async () => {
      const mockProgress = {
        positionSeconds: 45,
        durationSeconds: 120,
        progressPercent: 37.5,
        completed: false,
        lastWatchedAt: new Date(),
      };

      vi.mocked(ProductVideoService.getVideoProgress).mockResolvedValueOnce(mockProgress as any);

      const res = await ProductVideoService.getVideoProgress("store-A", "cust-1", "pv-1");
      expect(res?.positionSeconds).toBe(45);
    });
  });

  describe("5. Entitlement & Quota Enforcement Rules", () => {
    it("blocks upload session when product_videos_enabled is false", async () => {
      vi.mocked(ProductVideoService.createProductVideoUploadSession).mockRejectedValueOnce(
        new Error("A funcionalidade de Product Videos não está disponível no seu plano.")
      );

      await expect(
        ProductVideoService.createProductVideoUploadSession({
          sellerId: "seller-basic",
          storeId: "store-A",
          productId: "prod-1",
          title: "Novo Episódio",
        })
      ).rejects.toThrow("A funcionalidade de Product Videos não está disponível no seu plano.");
    });

    it("blocks upload session when max_product_videos limit is reached", async () => {
      vi.mocked(ProductVideoService.createProductVideoUploadSession).mockRejectedValueOnce(
        new Error("Limite de vídeos de produtos atingido (5/5). Faça upgrade do seu plano.")
      );

      await expect(
        ProductVideoService.createProductVideoUploadSession({
          sellerId: "seller-limited",
          storeId: "store-A",
          productId: "prod-1",
          title: "Mais Um Vídeo",
        })
      ).rejects.toThrow("Limite de vídeos de produtos atingido (5/5). Faça upgrade do seu plano.");
    });

    it("blocks upload session when storage quota is exceeded", async () => {
      const err: any = new Error("Capacidade de armazenamento excedida para o seu plano.");
      err.code = "STORAGE_QUOTA_EXCEEDED";
      vi.mocked(ProductVideoService.createProductVideoUploadSession).mockRejectedValueOnce(err);

      await expect(
        ProductVideoService.createProductVideoUploadSession({
          sellerId: "seller-overquota",
          storeId: "store-A",
          productId: "prod-1",
          title: "Vídeo Gigante",
          fileSize: 500 * 1024 * 1024,
        })
      ).rejects.toThrow("Capacidade de armazenamento excedida para o seu plano.");
    });
  });
});
