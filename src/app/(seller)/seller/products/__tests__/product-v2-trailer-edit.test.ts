import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { OWNER_EMAIL, OWNER_USER_ID } from "@/lib/bots/owner-guard";

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

// Mock media lifecycle
vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn(),
  },
}));

// Mock bunny token generator
vi.mock("@/lib/bunny/token", () => ({
  generateBunnyPlaybackToken: vi.fn(() => ({
    token: "mocktoken",
    expires: 123456789,
    playbackUrl: "https://direct.bunnycdn.com/embed/test-vid?token=mocktoken",
    directUrl: "https://direct.bunnycdn.com/play/test-vid?token=mocktoken",
  })),
}));

describe("Product V2 & Trailer & Edit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Admin Authorization for Trailer", () => {
    it("identifies owner account as authorized admin", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: OWNER_EMAIL })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized(undefined, { id: OWNER_USER_ID })).toBe(true);
    });

    it("rejects regular seller from being authorized as admin", () => {
      expect(ProductManualDeepLinkService.isAuthorized("seller", { email: "seller@store.com" })).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(undefined)).toBe(false);
    });
  });

  describe("2. Server Action: createProductAction Trailer Enforcement", () => {
    it("blocks non-admin seller from creating a product with trailerVideoId", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      (requireSeller as any).mockResolvedValue({
        id: "seller-regular",
        role: "seller",
        email: "regular@seller.com",
      });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-123",
        name: "Minha Loja",
      });

      const { createProductAction } = await import("../actions");
      const formData = new FormData();
      formData.set("title", "Produto com Trailer Proibido");
      formData.set("price", "49.90");
      formData.set("deliveryType", "product_video");
      formData.set("deliveryValue", "vid-1");
      formData.set("videoIds", JSON.stringify(["vid-1"]));
      formData.set("trailerVideoId", "vid-trailer-1");

      const res = await createProductAction(formData);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Apenas administradores podem configurar trailer de produto.");
    });

    it("blocks trailer if it is the same file as delivery video", async () => {
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
      (db.query.productVideos.findFirst as any).mockResolvedValue({
        id: "vid-same",
        status: "READY",
        title: "Vídeo 1",
      });

      const { createProductAction } = await import("../actions");
      const formData = new FormData();
      formData.set("title", "Produto com Trailer Repetido");
      formData.set("price", "49.90");
      formData.set("deliveryType", "product_video");
      formData.set("deliveryValue", "vid-same");
      formData.set("videoIds", JSON.stringify(["vid-same"]));
      formData.set("trailerVideoId", "vid-same"); // Same as delivery video!

      const res = await createProductAction(formData);
      expect(res.success).toBe(false);
      expect(res.error).toBe("O trailer precisa ser um arquivo separado do vídeo do produto.");
    });
  });

  describe("3. Server Action: updateProductAction Trailer Enforcement", () => {
    it("blocks non-admin seller from updating trailerVideoId", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      (requireSeller as any).mockResolvedValue({
        id: "seller-regular",
        role: "seller",
        email: "regular@seller.com",
      });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-123",
        name: "Minha Loja",
      });

      const { updateProductAction } = await import("../actions");
      const formData = new FormData();
      formData.set("title", "Produto Editado");
      formData.set("price", "49.90");
      formData.set("deliveryType", "product_video");
      formData.set("trailerVideoId", "vid-trailer-illegal");

      const res = await updateProductAction("prod-123", formData);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Apenas administradores podem configurar trailer de produto.");
    });
  });

  describe("4. Trailer API Route: /api/miniapp/products/[productId]/trailer", () => {
    it("returns 404 when product does not exist", async () => {
      const { db } = await import("@/db");
      (db.query.products.findFirst as any).mockResolvedValue(null);

      const { GET } = await import("@/app/api/miniapp/products/[productId]/trailer/route");
      const req = new Request("http://localhost/api/miniapp/products/prod-not-found/trailer");
      const res = await GET(req as any, { params: Promise.resolve({ productId: "prod-not-found" }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Produto não encontrado ou indisponível.");
    });

    it("returns 404 when product has no trailer configured", async () => {
      const { db } = await import("@/db");
      (db.query.products.findFirst as any).mockResolvedValue({
        id: "prod-1",
        trailerVideoId: null,
        status: "active",
      });

      const { GET } = await import("@/app/api/miniapp/products/[productId]/trailer/route");
      const req = new Request("http://localhost/api/miniapp/products/prod-1/trailer");
      const res = await GET(req as any, { params: Promise.resolve({ productId: "prod-1" }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Este produto não possui trailer configurado.");
    });

    it("returns 200 with signed playbackUrl for valid trailer that is not a delivery video", async () => {
      const { db } = await import("@/db");
      (db.query.products.findFirst as any).mockResolvedValue({
        id: "prod-1",
        storeId: "store-123",
        trailerVideoId: "trailer-vid-1",
        status: "active",
      });

      (db.query.productVideos.findFirst as any).mockResolvedValue({
        id: "trailer-vid-1",
        storeId: "store-123",
        bunnyVideoId: "bunny-trailer-guid-123",
        status: "READY",
        title: "Trailer Oficial",
        durationSeconds: 32,
      });

      // No assignment found -> it is NOT a delivery video
      (db.query.productVideoAssignments.findFirst as any).mockResolvedValue(null);

      const { GET } = await import("@/app/api/miniapp/products/[productId]/trailer/route");
      const req = new Request("http://localhost/api/miniapp/products/prod-1/trailer");
      const res = await GET(req as any, { params: Promise.resolve({ productId: "prod-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.trailer.title).toBe("Trailer Oficial");
      expect(json.trailer.durationSeconds).toBe(32);
      expect(json.trailer.playbackUrl).toContain("direct.bunnycdn.com");
    });
  });
});
