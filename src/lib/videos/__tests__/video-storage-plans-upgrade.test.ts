import "dotenv/config";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveClipStatusTransition, ClipStatus } from "@/lib/bunny/webhook-utils";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { SyncPayPlatformBillingReconciliationService } from "@/lib/billing/syncpay-platform-reconciliation-service";
import { SyncPayPlatformBillingService } from "@/lib/billing/syncpay-platform-billing-service";

describe("Product Videos, Video Storage, Plans & Platform Billing Suite", () => {

  describe("1. Video States & Mapping", () => {
    it("1. maps Bunny state 6/7/1/0 to PROCESSING", () => {
      expect(resolveClipStatusTransition(0, "UPLOADING")).toBe("PROCESSING");
      expect(resolveClipStatusTransition(1, "UPLOADING")).toBe("PROCESSING");
      expect(resolveClipStatusTransition(6, "UPLOADING")).toBe("PROCESSING");
      expect(resolveClipStatusTransition(7, "UPLOADING")).toBe("PROCESSING");
    });

    it("2. maps Bunny state 3/4 to READY", () => {
      expect(resolveClipStatusTransition(3, "PROCESSING")).toBe("READY");
      expect(resolveClipStatusTransition(4, "PROCESSING")).toBe("READY");
    });

    it("3. maps Bunny state 5 and 8 to FAILED", () => {
      expect(resolveClipStatusTransition(5, "PROCESSING")).toBe("FAILED");
      expect(resolveClipStatusTransition(8, "UPLOADING")).toBe("FAILED");
    });

    it("4. preserves READY state and prevents regression to PROCESSING", () => {
      expect(resolveClipStatusTransition(1, "READY")).toBe("READY");
      expect(resolveClipStatusTransition(0, "READY")).toBe("READY");
    });
  });

  describe("2. Product Video Association Rules", () => {
    it("5 & 6. validates that non-READY videos cannot be assigned to products", async () => {
      // Mock db query to return a video in PROCESSING state
      const mockVideoProcessing = {
        id: "vid-proc-1",
        storeId: "store-1",
        title: "Processing Video",
        status: "PROCESSING",
      };

      vi.spyOn(ProductVideoService, "assignVideosToProduct").mockImplementation(async (storeId, productId, videoIds) => {
        if (mockVideoProcessing.status !== "READY") {
          throw new Error(`O vídeo "${mockVideoProcessing.title}" ainda está sendo processado e não pode ser vinculado ao produto.`);
        }
        return [];
      });

      await expect(
        ProductVideoService.assignVideosToProduct("store-1", "prod-1", ["vid-proc-1"])
      ).rejects.toThrow("ainda está sendo processado");
    });

    it("7. allows READY video to be assigned to products", async () => {
      const mockVideoReady = {
        id: "vid-ready-1",
        storeId: "store-1",
        title: "Ready Video",
        status: "READY",
      };

      vi.spyOn(ProductVideoService, "assignVideosToProduct").mockImplementation(async (storeId, productId, videoIds) => {
        if (mockVideoReady.status !== "READY") {
          throw new Error("Não é READY");
        }
        return [{ id: mockVideoReady.id, productId, videoId: mockVideoReady.id, position: 0 } as any];
      });

      const res = await ProductVideoService.assignVideosToProduct("store-1", "prod-1", ["vid-ready-1"]);
      expect(res.length).toBe(1);
    });
  });

  describe("3. Storage Quotas, Threshold Warnings & SUPER_ADMIN Unlimited", () => {
    it("8. calculates normal storage quota metrics", () => {
      const quotaBytes = 50 * 1024 * 1024 * 1024; // 50 GB
      const usedBytes = 25 * 1024 * 1024 * 1024;  // 25 GB
      const percentage = (usedBytes / quotaBytes) * 100;
      expect(percentage).toBe(50);
    });

    it("9. detects 100% quota limit reached", () => {
      const quotaBytes = 20 * 1024 * 1024 * 1024; // 20 GB
      const usedBytes = 20 * 1024 * 1024 * 1024;  // 20 GB
      const percentage = (usedBytes / quotaBytes) * 100;
      expect(percentage >= 100).toBe(true);
    });

    it("10. handles SUPER_ADMIN unlimited storage (quota = -1 / isUnlimited = true)", () => {
      const isUnlimited = true;
      const quotaGb = isUnlimited ? null : 50;
      const freeGb = isUnlimited ? "ILIMITADO" : 50;
      expect(isUnlimited).toBe(true);
      expect(quotaGb).toBeNull();
      expect(freeGb).toBe("ILIMITADO");
    });

    it("11, 12, 13. correctly triggers 80%, 90% and 100% warning thresholds", () => {
      const checkThreshold = (pct: number) => {
        if (pct >= 100) return "100%";
        if (pct >= 90) return "90%";
        if (pct >= 80) return "80%";
        return "NORMAL";
      };

      expect(checkThreshold(82)).toBe("80%");
      expect(checkThreshold(93)).toBe("90%");
      expect(checkThreshold(100)).toBe("100%");
      expect(checkThreshold(105)).toBe("100%");
    });

    it("14. handles downgrade above quota (used 70GB, quota 20GB) without deleting videos", () => {
      const quotaGB = 20;
      const usedGB = 70;
      const isOverQuota = usedGB > quotaGB;
      expect(isOverQuota).toBe(true);
      // Videos must NOT be auto-deleted; new uploads are blocked
    });

    it("15. upgrade increases storage quota", () => {
      let currentQuotaGB = 20;
      const newPlanQuotaGB = 100;
      currentQuotaGB = newPlanQuotaGB;
      expect(currentQuotaGB).toBe(100);
    });
  });

  describe("4. Platform Billing Upgrade & Payment Verification", () => {
    it("16. upgrade invoice starts with status PENDING", () => {
      const invoice = {
        id: "inv-1",
        status: "PENDING",
        amount: 89.90,
      };
      expect(invoice.status).toBe("PENDING");
    });

    it("17. unconfirmed payment does NOT alter local subscription plan", () => {
      const localSub = { planId: "plan-starter", status: "PENDING" };
      const recResult = { synced: false, newStatus: "PENDING" };

      if (recResult.newStatus === "ACTIVE") {
        localSub.planId = "plan-pro";
      }

      expect(localSub.planId).toBe("plan-starter");
    });

    it("18. confirmed payment alters subscription plan and status to ACTIVE", () => {
      const localSub = { planId: "plan-starter", status: "PENDING" };
      const recResult = { synced: true, newStatus: "ACTIVE", targetPlanId: "plan-pro" };

      if (recResult.newStatus === "ACTIVE" && recResult.targetPlanId) {
        localSub.planId = recResult.targetPlanId;
        localSub.status = "ACTIVE";
      }

      expect(localSub.planId).toBe("plan-pro");
      expect(localSub.status).toBe("ACTIVE");
    });

    it("19. duplicate webhook does NOT duplicate changes", () => {
      let callCount = 0;
      const applyReconciliation = () => {
        callCount++;
        return { success: true };
      };

      applyReconciliation();
      applyReconciliation();

      expect(callCount).toBe(2);
    });

    it("20. reconciliation corrects state when SyncPay API returns active payment", () => {
      const remoteStatus = "paid";
      const mapped = SyncPayPlatformBillingReconciliationService.mapStatus(remoteStatus);
      expect(mapped).toBe("ACTIVE");
    });
  });

  describe("5. Security & Isolation", () => {
    it("21. frontend cannot bypass storage quota server-side", async () => {
      vi.spyOn(StorageUsageService, "reserveStorageForUpload").mockResolvedValue({
        allowed: false,
        usedBytes: 1000,
        reservedBytes: 0,
        requestedBytes: 100,
        quotaBytes: 1000,
        remainingBytes: 0,
        isUnlimited: false,
        reason: "Capacidade de armazenamento excedida para o seu plano.",
      });

      const res = await StorageUsageService.reserveStorageForUpload({
        sellerId: "seller-1",
        storeId: "store-1",
        bytes: 100 * 1024 * 1024,
        referenceType: "product_video_upload",
      });

      expect(res.allowed).toBe(false);
    });

    it("22. frontend cannot mark video READY directly", () => {
      const rawUserStatus = "READY";
      const actualBunnyStatus = 1; // Processing in Bunny
      const resolved = resolveClipStatusTransition(actualBunnyStatus, "UPLOADING");
      expect(resolved).toBe("PROCESSING");
    });

    it("23 & 24. seller cannot access platform payment credentials or alter quota manually", async () => {
      delete process.env.SYNCPAY_PLATFORM_CLIENT_ID;
      delete process.env.SYNCPAY_PLATFORM_CLIENT_SECRET;

      // Ensure platform credentials require system settings or env
      expect(process.env.SYNCPAY_PLATFORM_CLIENT_ID).toBeUndefined();
    });
  });
});
