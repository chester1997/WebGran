import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { OWNER_EMAIL, OWNER_USER_ID } from "@/lib/bots/owner-guard";
import { DELIVERY_TYPE_CONFIG } from "../v2/types";

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ count: 0 }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "prod-new-123", slug: "prod-slug" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    query: {
      products: {
        findFirst: vi.fn(),
      },
      productVideos: {
        findFirst: vi.fn(),
      },
      productVideoAssignments: {
        findFirst: vi.fn(),
      },
      telegramBots: {
        findFirst: vi.fn(),
      },
      productCarousels: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
  };
  return { db: mockDb };
});

// Mock entitlements
vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn(() => Promise.resolve({ allowed: true, limit: 100 })),
}));

// Mock video service
vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    listProductVideos: vi.fn(),
    assignVideosToProduct: vi.fn(),
  },
}));

// Mock image optimizer
vi.mock("@/lib/image-optimizer", () => ({
  processImageUrl: vi.fn((url) => Promise.resolve(url)),
}));

// Mock catalog resolver
vi.mock("@/lib/products/catalog-resolver", () => ({
  ProductVisibilityService: {
    syncProductVisibility: vi.fn(),
  },
}));

// Mock chat validator
vi.mock("@/lib/telegram/product-chat-validator", () => ({
  validateProductTelegramChat: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock media lifecycle
vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn(),
  },
}));

describe("EditProductModalV2 & Admin Isolation Suite (Sem Trailer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Admin Authorization & Isolation", () => {
    it("admin + lf49127@gmail.com: autorizado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: "lf49127@gmail.com" })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: OWNER_EMAIL })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: "  LF49127@GMAIL.COM  " })).toBe(true);
    });

    it("admin + outro e-mail: bloqueado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: "outro-admin@dominio.com" })).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: "gestor@empresa.com" })).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin")).toBe(false);
    });

    it("seller + lf49127@gmail.com: bloqueado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("seller", { email: "lf49127@gmail.com" })).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { email: OWNER_EMAIL })).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("SELLER", { email: OWNER_EMAIL })).toBe(false);
    });

    it("ID proprietário: autorizado", () => {
      expect(ProductManualDeepLinkService.isAuthorized(undefined, { id: OWNER_USER_ID })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { id: OWNER_USER_ID })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("admin", OWNER_USER_ID)).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized(undefined, OWNER_USER_ID)).toBe(true);
    });
  });

  describe("2. V2 Delivery Types Configuration", () => {
    it("provides correct metadata and colors for the 3 delivery types", () => {
      expect(DELIVERY_TYPE_CONFIG.telegram.name).toBe("Grupo ou canal");
      expect(DELIVERY_TYPE_CONFIG.telegram.cc).toBe("#38bdf8");

      expect(DELIVERY_TYPE_CONFIG.external.name).toBe("Link externo");
      expect(DELIVERY_TYPE_CONFIG.external.cc).toBe("#a3e635");

      expect(DELIVERY_TYPE_CONFIG.product_video.name).toBe("Vídeo do produto");
      expect(DELIVERY_TYPE_CONFIG.product_video.cc).toBe("#c084fc");
    });
  });

  describe("3. Server Action: createProductAction", () => {
    it("successfully creates product without trailer column", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "admin",
        email: OWNER_EMAIL,
      });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-123",
        name: "Minha Loja",
      });

      const { createProductAction } = await import("../actions");
      const formData = new FormData();
      formData.set("title", "Produto Novo V2");
      formData.set("price", "29.90");
      formData.set("deliveryType", "telegram");
      formData.set("deliveryValue", "-1001234567890");

      const res = await createProductAction(formData);
      expect(res.success).toBe(true);
    });
  });

  describe("4. Server Action: updateProductAction", () => {
    it("successfully updates product delivery type without trailer references", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "admin",
        email: OWNER_EMAIL,
      });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-123",
        name: "Minha Loja",
      });

      const { db } = await import("@/db");
      (db.query.products.findFirst as any).mockResolvedValue({
        id: "prod-123",
        storeId: "store-123",
        title: "Produto Antigo",
        deliveryType: "telegram",
        deliveryValue: "-1001234567890",
      });

      const { updateProductAction } = await import("../actions");
      const formData = new FormData();
      formData.set("title", "Produto Atualizado V2");
      formData.set("price", "39.90");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://example.com/acesso");

      const res = await updateProductAction("prod-123", formData);
      expect(res.success).toBe(true);
    });
  });
});
