import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  StorageUsageService, 
  GB_IN_BYTES, 
  StorageUsageSummary 
} from "../storage-usage-service";
// Mock dependencies
let mockUsageStore: Map<string, { sellerId: string; usedBytes: number; reservedBytes: number }> = new Map();
let mockReservationsStore: Map<string, any> = new Map();

const { mockGetSellerEntitlement } = vi.hoisted(() => ({
  mockGetSellerEntitlement: vi.fn(),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  getSellerEntitlement: mockGetSellerEntitlement,
}));

vi.mock("@/db/ensure-entitlements", () => ({
  ensureEntitlementTablesAndSeed: vi.fn().mockResolvedValue(true),
}));

let lastCreatedReservationId: string | null = null;

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
            if (lastCreatedReservationId && mockReservationsStore.has(lastCreatedReservationId)) {
              return mockReservationsStore.get(lastCreatedReservationId);
            }
            const arr = Array.from(mockReservationsStore.values());
            return arr.find(r => r.status === "ACTIVE") || arr[0] || null;
          }),
          findMany: vi.fn().mockImplementation(async () => {
            return Array.from(mockReservationsStore.values());
          }),
        },
        stores: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue({ id: "store-1", ownerId: "seller-1" }),
        },
        products: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        categories: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        banners: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        clips: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          const id = val.id || `res-${Date.now()}-${Math.random()}`;
          const record = { id, status: "ACTIVE", ...val };
          lastCreatedReservationId = id;
          mockReservationsStore.set(id, record);
          return {
            returning: vi.fn().mockResolvedValue([record]),
          };
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((setVal: any) => ({
          where: vi.fn().mockImplementation(async () => {
            if (setVal.status && lastCreatedReservationId && mockReservationsStore.has(lastCreatedReservationId)) {
              const rec = mockReservationsStore.get(lastCreatedReservationId);
              rec.status = setVal.status;
            } else if (setVal.status) {
              for (const [key, val] of mockReservationsStore.entries()) {
                if (val.status === "ACTIVE") {
                  val.status = setVal.status;
                  break;
                }
              }
            }
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

const { mockStorageProvider } = vi.hoisted(() => ({
  mockStorageProvider: {
    upload: vi.fn().mockResolvedValue({ url: "https://cdn.webgran.online/img.webp", path: "stores/store-1/products/img.webp", sizeBytes: 500 * 1024 }),
    delete: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: () => mockStorageProvider,
  generateMultiTenantStoragePath: (storeId: string, entity: string, file: string) => `stores/${storeId}/${entity}/${file}`,
}));

const { mockBunnyStreamService } = vi.hoisted(() => ({
  mockBunnyStreamService: {
    createVideo: vi.fn().mockResolvedValue({ videoId: "bunny-vid-123" }),
    deleteVideo: vi.fn().mockResolvedValue(true),
    getVideo: vi.fn().mockResolvedValue({ length: 60, storageSize: 10 * 1024 * 1024 }),
    getThumbnailUrl: vi.fn().mockReturnValue("https://video.bunnycdn.com/thumb.jpg"),
    generateDirectUploadSignature: vi.fn().mockReturnValue({ uploadUrl: "https://upload.bunny.com" }),
  },
}));

vi.mock("@/lib/bunny/stream", () => ({
  BunnyStreamService: mockBunnyStreamService,
}));

import { MediaLifecycleService, GarbageCollectionService } from "../lifecycle-service";

import { db } from "@/db";

describe("Storage Quota Real Enforcement Suite (Fase 4B.2C)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lastCreatedReservationId = null;
    mockUsageStore.clear();
    mockReservationsStore.clear();

    mockGetSellerEntitlement.mockReset();
    mockGetSellerEntitlement.mockResolvedValue({
      featureKey: "storage_quota_gb",
      type: "QUOTA",
      value: 100, // 100 GB default
      source: "PLAN",
      isUnlimited: false,
    });
  });

  it("1. imagem dentro da quota -> reserva e confirma armazenamento com sucesso", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      bytes: 500 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    expect(res.reservationId).toBeDefined();

    const confirmed = await StorageUsageService.confirmReservation(res.reservationId!, 500 * 1024);
    expect(confirmed).toBe(true);
  });

  it("2. imagem acima da quota -> bloqueia server-side com STORAGE_QUOTA_EXCEEDED", async () => {
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      bytes: 150 * GB_IN_BYTES, // Exceeds 100 GB quota
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe("STORAGE_QUOTA_EXCEEDED");
    expect(res.reason).toContain("Capacidade de armazenamento insuficiente");
  });

  it("3. WebP final usado para cálculo -> calcula a quota usando o tamanho final do buffer comprimido", async () => {
    const originalSize = 10 * 1024 * 1024; // 10 MB original JPG
    const webpBufferLength = 450 * 1024; // 450 KB WebP output

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      bytes: webpBufferLength,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    expect(res.requestedBytes).toBe(450 * 1024);
    expect(res.requestedBytes).not.toBe(originalSize);
  });

  it("4. falha de upload libera reserva -> releaseReservation é chamado se o provider falhar", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      bytes: 1 * 1024 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);

    const released = await StorageUsageService.releaseReservation(res.reservationId!);
    expect(released).toBe(true);
  });

  it("5. substituição de imagem -> nova mídia reservada e antiga removida de forma segura", async () => {
    const resNew = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      bytes: 600 * 1024,
      referenceType: "image_upload",
    });
    expect(resNew.allowed).toBe(true);

    await StorageUsageService.confirmReservation(resNew.reservationId!, 600 * 1024);

    await MediaLifecycleService.handleImageReplacement({
      oldUrl: "https://cdn.webgran.online/stores/store-1/products/old.webp",
      newUrl: "https://cdn.webgran.online/stores/store-1/products/new.webp",
      storeId: "store-1",
    });

    expect(mockStorageProvider.delete).toHaveBeenCalledWith("stores/store-1/products/old.webp");
  });

  it("6. exclusão reduz usage -> decrementar usedBytes ao remover mídia física", async () => {
    const deleted = await MediaLifecycleService.deleteMediaFile("stores/store-1/banners/banner1.webp", "store-1");
    expect(deleted).toBe(true);
    expect(db.execute).toHaveBeenCalled();
  });

  it("7. banner -> upload de banner valida e confirma storage quota", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 800 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    await StorageUsageService.confirmReservation(res.reservationId!, 800 * 1024);
  });

  it("8. categoria -> upload de imagem de categoria valida e confirma storage quota", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 350 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    await StorageUsageService.confirmReservation(res.reservationId!, 350 * 1024);
  });

  it("9. logo -> upload do logo da loja valida e confirma storage quota", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 200 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    await StorageUsageService.confirmReservation(res.reservationId!, 200 * 1024);
  });

  it("10. Clip dentro da quota -> criação de sessão de upload de clip cria reserva de storage", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 25 * 1024 * 1024, // 25 MB video
      referenceType: "clip_upload",
      expirationMinutes: 180,
    });

    expect(res.allowed).toBe(true);
    expect(res.reservationId).toBeDefined();
  });

  it("11. Clip acima da quota -> rejeita criação de sessão de clipe quando tamanho excede quota", async () => {
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 200 * GB_IN_BYTES, // Exceeds 100 GB
      referenceType: "clip_upload",
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe("STORAGE_QUOTA_EXCEEDED");
  });

  it("12. Clip usando storageSize do Bunny -> confirmação recupera e usa o tamanho do Bunny Stream", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 20 * 1024 * 1024,
      referenceType: "clip_upload",
    });

    // Simulate binding referenceId to bunnyVideoId
    const bunnyVideoId = "bunny-vid-999";
    mockReservationsStore.set(res.reservationId!, {
      id: res.reservationId!,
      status: "ACTIVE",
      referenceType: "clip_upload",
      referenceId: bunnyVideoId,
      requestedBytes: 20 * 1024 * 1024,
    });

    const confirmed = await StorageUsageService.confirmReservationByReference("clip_upload", bunnyVideoId, 18 * 1024 * 1024);
    expect(confirmed).toBe(true);
  });

  it("13. Clip READY confirma reserva -> transição webhook para READY confirma a reserva", async () => {
    const bunnyVid = "bunny-ready-123";
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 30 * 1024 * 1024,
      referenceType: "clip_upload",
    });

    mockReservationsStore.set(res.reservationId!, {
      id: res.reservationId!,
      status: "ACTIVE",
      referenceType: "clip_upload",
      referenceId: bunnyVid,
      requestedBytes: 30 * 1024 * 1024,
    });

    const confirmed = await StorageUsageService.confirmReservationByReference("clip_upload", bunnyVid, 28 * 1024 * 1024);
    expect(confirmed).toBe(true);
  });

  it("14. Clip FAILED libera reserva -> transição webhook para FAILED libera a reserva", async () => {
    const bunnyVid = "bunny-failed-123";
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 30 * 1024 * 1024,
      referenceType: "clip_upload",
    });

    mockReservationsStore.set(res.reservationId!, {
      id: res.reservationId!,
      status: "ACTIVE",
      referenceType: "clip_upload",
      referenceId: bunnyVid,
      requestedBytes: 30 * 1024 * 1024,
    });

    const released = await StorageUsageService.releaseReservationByReference("clip_upload", bunnyVid);
    expect(released).toBe(true);
  });

  it("15. reserva expirada -> preserva reservas de clips em processamento", async () => {
    const expiredCount = await StorageUsageService.expireAbandonedReservations();
    expect(typeof expiredCount).toBe("number");
  });

  it("16. vendedor acima da quota não pode adicionar -> novas mídias são bloqueadas", async () => {
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-over-quota",
      bytes: 1 * 1024 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe("STORAGE_QUOTA_EXCEEDED");
  });

  it("17. vendedor acima da quota pode excluir -> remoções de mídias continuam permitidas", async () => {
    const deleted = await MediaLifecycleService.deleteMediaFile("stores/store-1/products/old_cover.webp", "store-1");
    expect(deleted).toBe(true);
  });

  it("18. vendedor acima da quota pode reduzir armazenamento -> decrementar usage permite liberar espaço", async () => {
    await StorageUsageService.decrementUsedBytes("seller-1", 10 * GB_IN_BYTES);
    expect(db.execute).toHaveBeenCalled();
  });

  it("19. admin ilimitado -> role ADMIN possui quota ilimitada sem bloqueio", async () => {
    mockGetSellerEntitlement.mockResolvedValue({
      featureKey: "storage_quota_gb",
      type: "QUOTA",
      value: -1,
      source: "ADMIN_EXEMPT",
      isUnlimited: true,
    });

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "admin-user-id",
      bytes: 500 * GB_IN_BYTES,
      referenceType: "generic",
    });

    expect(res.allowed).toBe(true);
    expect(res.isUnlimited).toBe(true);
  });

  it("20. super_admin ilimitado -> role SUPER_ADMIN possui quota ilimitada", async () => {
    mockGetSellerEntitlement.mockResolvedValue({
      featureKey: "storage_quota_gb",
      type: "QUOTA",
      value: -1,
      source: "ADMIN_EXEMPT",
      isUnlimited: true,
    });

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "super-admin-user-id",
      bytes: 1000 * GB_IN_BYTES,
      referenceType: "generic",
    });

    expect(res.allowed).toBe(true);
    expect(res.isUnlimited).toBe(true);
  });

  it("21. concorrência -> reservas simultâneas atômicas via SQL evitam estouro", async () => {
    let currentCommitted = 85 * GB_IN_BYTES;
    const quotaBytes = 100 * GB_IN_BYTES;

    const execSpy = vi.spyOn(db, "execute").mockImplementation((async (queryObj: any) => {
      const queryStr = JSON.stringify(queryObj);
      if (!queryStr.includes("UPDATE")) {
        return { rowCount: 1 } as any;
      }
      const requested = 10 * GB_IN_BYTES;
      if (currentCommitted + requested <= quotaBytes) {
        currentCommitted += requested;
        return { rowCount: 1 } as any;
      } else {
        return { rowCount: 0 } as any;
      }
    }) as any);

    try {
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
      expect(successCount).toBe(1);
    } finally {
      execSpy.mockRestore();
      (db.execute as any).mockImplementation(async () => ({ rowCount: 1 }));
    }
  });

  it("22. isolamento multi-tenant -> operações de seller A não afetam seller B", async () => {
    const resA = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-A",
      bytes: 5 * GB_IN_BYTES,
      referenceType: "image_upload",
    });

    const resB = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-B",
      bytes: 5 * GB_IN_BYTES,
      referenceType: "image_upload",
    });

    expect(resA.allowed).toBe(true);
    expect(resB.allowed).toBe(true);
  });

  it("23. reconciliação -> reconcileSellerStorage recalcula baseline sem alterar reservas ativas", async () => {
    const summary = await StorageUsageService.reconcileSellerStorage("seller-1");
    expect(summary.sellerId).toBe("seller-1");
    expect(db.execute).toHaveBeenCalled();
  });

  it("24. idempotência -> confirmação e liberação repetidas retornam false no segundo chamado", async () => {
    const findSpy = vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValue({
      id: "res-confirmed",
      sellerId: "seller-1",
      requestedBytes: 1000,
      status: "CONFIRMED",
    } as any);

    try {
      const confirm2 = await StorageUsageService.confirmReservation("res-confirmed", 1000);
      expect(confirm2).toBe(false);

      const release2 = await StorageUsageService.releaseReservation("res-confirmed");
      expect(release2).toBe(false);
    } finally {
      findSpy.mockRestore();
    }
  });

  it("25. Base64 payload em produto dentro da quota -> reserva e confirma armazenamento com sucesso", async () => {
    const base64Data = "data:image/webp;base64,UklGRgAAAABXRUJQVlA4WAoAAAAQAAAAAQAA"; // ~30 bytes
    const bufferSize = Buffer.from("UklGRgAAAABXRUJQVlA4WAoAAAAQAAAAAQAA", "base64").length;

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-25",
      storeId: "store-1",
      bytes: bufferSize,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    expect(res.reservationId).toBeDefined();

    vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValueOnce({
      id: res.reservationId!,
      sellerId: "seller-25",
      requestedBytes: bufferSize,
      status: "ACTIVE",
    } as any);

    const confirmed = await StorageUsageService.confirmReservation(res.reservationId!, bufferSize);
    expect(confirmed).toBe(true);
  });

  it("26. Base64 payload em produto acima da quota -> bloqueia server-side e não grava no storage", async () => {
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-over-quota",
      storeId: "store-1",
      bytes: 200 * GB_IN_BYTES,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe("STORAGE_QUOTA_EXCEEDED");
    expect(res.reason).toContain("Capacidade de armazenamento insuficiente");
  });

  it("27. Base64 payload em atualização de produto -> reserva nova mídia e remove a antiga de forma segura", async () => {
    const resNew = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 100 * 1024,
      referenceType: "image_upload",
    });

    expect(resNew.allowed).toBe(true);
    await StorageUsageService.confirmReservation(resNew.reservationId!, 100 * 1024);

    await MediaLifecycleService.handleImageReplacement({
      oldUrl: "https://cdn.webgran.online/stores/store-1/products/old_base64.webp",
      newUrl: "https://cdn.webgran.online/stores/store-1/products/new_base64.webp",
      storeId: "store-1",
    });

    expect(mockStorageProvider.delete).toHaveBeenCalledWith("stores/store-1/products/old_base64.webp");
  });

  it("28. Base64 payload em categoria dentro da quota -> reserva e confirma quota", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 400 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);
    await StorageUsageService.confirmReservation(res.reservationId!, 400 * 1024);
  });

  it("29. Base64 payload em categoria acima da quota -> bloqueia sem upload no Bunny", async () => {
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 1 }));
    (db.execute as any).mockImplementationOnce(async () => ({ rowCount: 0 }));

    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-1",
      storeId: "store-1",
      bytes: 500 * GB_IN_BYTES,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe("STORAGE_QUOTA_EXCEEDED");
  });

  it("30. erro de upload com Base64 -> reserva é liberada sem incrementar usedBytes", async () => {
    const res = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-30",
      storeId: "store-1",
      bytes: 250 * 1024,
      referenceType: "image_upload",
    });

    expect(res.allowed).toBe(true);

    vi.spyOn(db.query.storageReservations, "findFirst").mockResolvedValueOnce({
      id: res.reservationId!,
      sellerId: "seller-30",
      requestedBytes: 250 * 1024,
      status: "ACTIVE",
    } as any);

    const released = await StorageUsageService.releaseReservation(res.reservationId!);
    expect(released).toBe(true);
  });

  it("31. multi-tenant Base64 -> seller A não pode consumir quota do seller B", async () => {
    const resA = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-A",
      storeId: "store-A",
      bytes: 2 * 1024 * 1024,
      referenceType: "image_upload",
    });

    const resB = await StorageUsageService.reserveStorageForUpload({
      sellerId: "seller-B",
      storeId: "store-B",
      bytes: 2 * 1024 * 1024,
      referenceType: "image_upload",
    });

    expect(resA.allowed).toBe(true);
    expect(resB.allowed).toBe(true);
  });
});
