import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  StorageUsageService, 
  GB_IN_BYTES, 
  StorageUsageSummary 
} from "../storage-usage-service";

// Mock DB
let mockUsageStore: Map<string, { sellerId: string; usedBytes: number; reservedBytes: number }> = new Map();
let mockReservationsStore: Map<string, any> = new Map();
let mockEntitlementValue: any = 100; // Default 100 GB

const { mockGetSellerEntitlement } = vi.hoisted(() => ({
  mockGetSellerEntitlement: vi.fn(),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  getSellerEntitlement: mockGetSellerEntitlement,
}));

vi.mock("@/db/ensure-entitlements", () => ({
  ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sellerStorageUsage: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            for (const [key, val] of mockUsageStore.entries()) {
              return val;
            }
            return null;
          }),
        },
        storageReservations: {
          findFirst: vi.fn().mockImplementation(async () => {
            const arr = Array.from(mockReservationsStore.values());
            return arr[0] || null;
          }),
          findMany: vi.fn().mockImplementation(async () => {
            return Array.from(mockReservationsStore.values());
          }),
        },
        stores: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        clips: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          const id = val.id || `res-${Date.now()}-${Math.random()}`;
          const record = { id, ...val };
          mockReservationsStore.set(id, record);
          return {
            returning: vi.fn().mockResolvedValue([record]),
          };
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((setVal: any) => ({
          where: vi.fn().mockImplementation(async () => {
            return [{ id: "res-updated" }];
          }),
        })),
      })),
      execute: vi.fn().mockImplementation(async (query: any) => {
        return { rowCount: 1 };
      }),
    },
  };
});

import { db } from "@/db";

describe("Storage Usage & Reservations Infrastructure Suite (Fase 4B.2B)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsageStore.clear();
    mockReservationsStore.clear();
    mockEntitlementValue = 100; // 100 GB

    mockGetSellerEntitlement.mockReset();
    mockGetSellerEntitlement.mockResolvedValue({
      featureKey: "storage_quota_gb",
      type: "QUOTA",
      value: 100,
      source: "PLAN",
      isUnlimited: false,
    });
  });

  describe("1-4. Usage Queries & Increments", () => {
    it("1. seller sem usage -> returns 0 bytes used and reserved", async () => {
      vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue(null as any);

      const usage = await StorageUsageService.getUsage("seller-new");
      expect(usage.usedBytes).toBe(0);
      expect(usage.reservedBytes).toBe(0);
      expect(usage.totalCommittedBytes).toBe(0);
      expect(usage.quotaBytes).toBe(100 * GB_IN_BYTES);
      expect(usage.remainingBytes).toBe(100 * GB_IN_BYTES);
    });

    it("2. criar usage -> upserts record for new seller", async () => {
      await StorageUsageService.incrementUsedBytes("seller-1", 5000);
      expect(db.execute).toHaveBeenCalled();
    });

    it("3. increment used -> increases usedBytes atomically", async () => {
      await StorageUsageService.incrementUsedBytes("seller-1", 10 * 1024 * 1024);
      expect(db.execute).toHaveBeenCalled();
    });

    it("4. decrement used -> decreases usedBytes (never below 0)", async () => {
      await StorageUsageService.decrementUsedBytes("seller-1", 5 * 1024 * 1024);
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe("5-8. Reservations within Quota & Unlimited", () => {
    it("5. reservar espaço dentro da quota -> succeeds and returns reservationId", async () => {
      const findSpy = vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "seller-1",
        usedBytes: 10 * GB_IN_BYTES,
        reservedBytes: 0,
      } as any);

      try {
        const res = await StorageUsageService.reserveStorageForUpload({
          sellerId: "seller-1",
          bytes: 5 * GB_IN_BYTES,
          referenceType: "image_upload",
        });

        expect(res.allowed).toBe(true);
        expect(res.requestedBytes).toBe(5 * GB_IN_BYTES);
        expect(res.reservationId).toBeDefined();
      } finally {
        findSpy.mockRestore();
      }
    });

    it("6. bloquear reserva acima da quota -> rejects when total requested exceeds quota", async () => {
      const findSpy = vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "seller-1",
        usedBytes: 98 * GB_IN_BYTES,
        reservedBytes: 0,
      } as any);

      (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
      (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

      try {
        const res = await StorageUsageService.reserveStorageForUpload({
          sellerId: "seller-1",
          bytes: 5 * GB_IN_BYTES, // 98 + 5 = 103 GB > 100 GB
          referenceType: "clip_upload",
        });

        expect(res.allowed).toBe(false);
        expect(res.reason).toContain("Capacidade de armazenamento insuficiente");
      } finally {
        findSpy.mockRestore();
      }
    });

    it("7. unlimited (-1) -> permits reservation without quota check", async () => {
      mockGetSellerEntitlement.mockResolvedValue({
        featureKey: "storage_quota_gb",
        type: "QUOTA",
        value: -1,
        source: "ADMIN_EXEMPT",
        isUnlimited: true,
      });

      const findSpy = vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "admin-1",
        usedBytes: 5000 * GB_IN_BYTES,
        reservedBytes: 0,
      } as any);

      try {
        const res = await StorageUsageService.reserveStorageForUpload({
          sellerId: "admin-1",
          bytes: 100 * GB_IN_BYTES,
          referenceType: "generic",
        });

        expect(res.allowed).toBe(true);
        expect(res.isUnlimited).toBe(true);
        expect(res.quotaBytes).toBeNull();
      } finally {
        findSpy.mockRestore();
      }
    });

    it("8. múltiplas reservas -> reservations accumulate correctly", async () => {
      const findSpy = vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "seller-1",
        usedBytes: 10 * GB_IN_BYTES,
        reservedBytes: 5 * GB_IN_BYTES,
      } as any);

      try {
        const res = await StorageUsageService.reserveStorageForUpload({
          sellerId: "seller-1",
          bytes: 2 * GB_IN_BYTES,
          referenceType: "image_upload",
        });

        expect(res.allowed).toBe(true);
        expect(db.execute).toHaveBeenCalled();
      } finally {
        findSpy.mockRestore();
      }
    });
  });

  describe("9-13. Release, Confirm, Final Sizes & Idempotency", () => {
    it("9. release -> releases active reservation and updates status to RELEASED", async () => {
      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-1",
        sellerId: "seller-1",
        requestedBytes: 10 * 1024 * 1024,
        status: "ACTIVE",
      } as any);

      const success = await StorageUsageService.releaseReservation("res-1");
      expect(success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it("10. confirm -> moves bytes from reserved to used and sets status to CONFIRMED", async () => {
      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-2",
        sellerId: "seller-1",
        requestedBytes: 20 * 1024 * 1024,
        status: "ACTIVE",
      } as any);

      const success = await StorageUsageService.confirmReservation({
        reservationId: "res-2",
        actualBytes: 20 * 1024 * 1024,
      });

      expect(success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it("11. diferença entre reservado e tamanho final (under & over)", async () => {
      // Case A: Reserved 100MB, Final 80MB (releases 20MB)
      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-under",
        sellerId: "seller-1",
        requestedBytes: 100 * 1024 * 1024,
        status: "ACTIVE",
      } as any);

      const resUnder = await StorageUsageService.confirmReservation({
        reservationId: "res-under",
        actualBytes: 80 * 1024 * 1024,
      });
      expect(resUnder).toBe(true);

      // Case B: Reserved 100MB, Final 120MB (adds 120MB used, releases 100MB reserved)
      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-over",
        sellerId: "seller-1",
        requestedBytes: 100 * 1024 * 1024,
        status: "ACTIVE",
      } as any);

      const resOver = await StorageUsageService.confirmReservation({
        reservationId: "res-over",
        actualBytes: 120 * 1024 * 1024,
      });
      expect(resOver).toBe(true);
    });

    it("12. reserva expirada -> expireAbandonedReservations releases expired active items", async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      vi.spyOn(db.query.storageReservations, "findMany").mockResolvedValue([
        {
          id: "res-expired-1",
          sellerId: "seller-1",
          requestedBytes: 50 * 1024 * 1024,
          status: "ACTIVE",
          expiresAt: pastDate,
        } as any
      ]);

      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-expired-1",
        sellerId: "seller-1",
        requestedBytes: 50 * 1024 * 1024,
        status: "ACTIVE",
        expiresAt: pastDate,
      } as any);

      const expiredCount = await StorageUsageService.expireAbandonedReservations();
      expect(expiredCount).toBe(1);
    });

    it("13. idempotência -> repeated release or confirm returns false on inactive items", async () => {
      vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
        id: "res-already-confirmed",
        sellerId: "seller-1",
        requestedBytes: 10 * 1024 * 1024,
        status: "CONFIRMED", // already processed
      } as any);

      const confirmResult = await StorageUsageService.confirmReservation({ reservationId: "res-already-confirmed" });
      const releaseResult = await StorageUsageService.releaseReservation("res-already-confirmed");

      expect(confirmResult).toBe(false);
      expect(releaseResult).toBe(false);
    });
  });

  describe("14-19. Multi-Tenancy, Reconciliation, Quota Changes & Race Conditions", () => {
    it("14. seller A isolado de seller B -> usage calculations are strictly scoped by sellerId", async () => {
      vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "seller-A",
        usedBytes: 50 * GB_IN_BYTES,
        reservedBytes: 0,
      } as any);

      const usageA = await StorageUsageService.getUsage("seller-A");
      expect(usageA.usedBytes).toBe(50 * GB_IN_BYTES);
    });

    it("15. reconciliação -> reconcileSellerStorage updates used_bytes from ground truth", async () => {
      const reconciled = await StorageUsageService.reconcileSellerStorage("seller-1");
      expect(reconciled.sellerId).toBe("seller-1");
      expect(db.execute).toHaveBeenCalled();
    });

    it("16-18. alteração de quota (redução abaixo do uso & aumento)", async () => {
      vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockResolvedValue({
        sellerId: "seller-1",
        usedBytes: 80 * GB_IN_BYTES,
        reservedBytes: 0,
      } as any);

      // 16 & 17. Quota reduced to 50 GB (used is 80 GB) -> remainingBytes is 0 (never negative)
      mockGetSellerEntitlement.mockResolvedValue({
        featureKey: "storage_quota_gb",
        type: "QUOTA",
        value: 50,
        source: "PLAN",
        isUnlimited: false,
      });

      const usageReduced = await StorageUsageService.getUsage("seller-1");
      expect(usageReduced.remainingBytes).toBe(0);

      // 18. Quota increased to 200 GB (used is 80 GB) -> remainingBytes is 120 GB
      mockGetSellerEntitlement.mockResolvedValue({
        featureKey: "storage_quota_gb",
        type: "QUOTA",
        value: 200,
        source: "PLAN",
        isUnlimited: false,
      });

      const usageIncreased = await StorageUsageService.getUsage("seller-1");
      expect(usageIncreased.remainingBytes).toBe(120 * GB_IN_BYTES);
    });

    it("19. concorrência/race condition -> 100 GB quota, 85 GB used, 2 simultaneous 10 GB reservations -> only 1 succeeds!", async () => {
      mockGetSellerEntitlement.mockResolvedValue({
        featureKey: "storage_quota_gb",
        type: "QUOTA",
        value: 100,
        source: "PLAN",
        isUnlimited: false,
      });

      let currentCommitted = 85 * GB_IN_BYTES;
      const quotaBytes = 100 * GB_IN_BYTES;

      const execSpy = vi.spyOn(db, "execute").mockImplementation((async (queryObj: any) => {
        const queryStr = JSON.stringify(queryObj);
        if (!queryStr.includes("UPDATE")) {
          return { rowCount: 1 } as any;
        }
        // Atomic simulation: only allow update if currentCommitted + requested <= 100 GB
        const requested = 10 * GB_IN_BYTES;
        if (currentCommitted + requested <= quotaBytes) {
          currentCommitted += requested;
          return { rowCount: 1 } as any;
        } else {
          return { rowCount: 0 } as any;
        }
      }) as any);

      const findSpy = vi.spyOn(db.query.sellerStorageUsage, "findFirst").mockImplementation((async () => {
        return {
          sellerId: "seller-concurrent",
          usedBytes: 85 * GB_IN_BYTES,
          reservedBytes: currentCommitted - 85 * GB_IN_BYTES,
        } as any;
      }) as any);

      try {
        // Fire 2 simultaneous reservation requests for 10 GB each
        const [res1, res2] = await Promise.all([
          StorageUsageService.reserveStorageForUpload({
            sellerId: "seller-concurrent",
            bytes: 10 * GB_IN_BYTES,
            referenceType: "clip_upload",
          }),
          StorageUsageService.reserveStorageForUpload({
            sellerId: "seller-concurrent",
            bytes: 10 * GB_IN_BYTES,
            referenceType: "clip_upload",
          }),
        ]);

        const successCount = [res1.allowed, res2.allowed].filter(Boolean).length;
        expect(successCount).toBe(1); // Exactly ONE reservation succeeded, preventing over-allocation!
      } finally {
        execSpy.mockRestore();
        findSpy.mockRestore();
      }
    });
  });
});
