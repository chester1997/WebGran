import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn() },
      productVideoAssignments: { findMany: vi.fn() },
      accesses: { findFirst: vi.fn() },
      telegramCustomers: { findFirst: vi.fn() },
      videoProgress: { findFirst: vi.fn() },
    },
    execute: vi.fn(),
  },
}));

import { ProductVideoService } from "@/lib/videos/product-video-service";
import { db } from "@/db";

describe("Watermark and Access Button UI Security Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUNNY_STREAM_TOKEN_KEY = "mock-watermark-token-key";
  });

  it("1 & 2. Authenticated user with Telegram username receives watermark formatted with @username", async () => {
    const mockReadyVideo = {
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-123",
      status: "READY",
      active: true,
    };
    const mockAssignment = [{ productId: "prod-1", videoId: "vid-1", storeId: "store-1" }];
    const mockAccess = { id: "acc-101-uuid", status: "ACTIVE", expiresAt: null, productId: "prod-1" };
    const mockCustomer = {
      id: "cust-1",
      telegramUserId: "998877",
      username: "marcos_dev",
      firstName: "Marcos",
      lastName: "Silva",
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockReadyVideo as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignment as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValueOnce(mockCustomer as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const result = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-1");

    expect(result.watermark).toBeDefined();
    expect(result.watermark.brand).toBe("WEBGRAN");
    expect(result.watermark.label).toBe("@marcos_dev");
  });

  it("3. Fallback to display name when username is missing", async () => {
    const mockReadyVideo = {
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-123",
      status: "READY",
      active: true,
    };
    const mockAssignment = [{ productId: "prod-1", videoId: "vid-1", storeId: "store-1" }];
    const mockAccess = { id: "acc-101-uuid", status: "ACTIVE", expiresAt: null, productId: "prod-1" };
    const mockCustomerNoUsername = {
      id: "cust-2",
      telegramUserId: "998877",
      username: null,
      firstName: "Ana",
      lastName: "Paula",
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockReadyVideo as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignment as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValueOnce(mockCustomerNoUsername as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const result = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-2", "vid-1");

    expect(result.watermark.label).toBe("Ana Paula");
  });

  it("3B. Fallback to short access code when username and name are missing", async () => {
    const mockReadyVideo = {
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-123",
      status: "READY",
      active: true,
    };
    const mockAssignment = [{ productId: "prod-1", videoId: "vid-1", storeId: "store-1" }];
    const mockAccess = { id: "12345678-abcd-ef00-1122-334455667788", status: "ACTIVE", expiresAt: null, productId: "prod-1" };
    const mockCustomerAnonymous = {
      id: "cust-3",
      telegramUserId: "998877",
      username: null,
      firstName: null,
      lastName: null,
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockReadyVideo as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignment as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValueOnce(mockCustomerAnonymous as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const result = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-3", "vid-1");

    expect(result.watermark.label).toBe("#WG667788");
  });

  it("4 & 5. Sensitive tokens/secrets are NOT present in watermark object and server determines buyer identity", async () => {
    const mockReadyVideo = {
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-123",
      status: "READY",
      active: true,
    };
    const mockAssignment = [{ productId: "prod-1", videoId: "vid-1", storeId: "store-1" }];
    const mockAccess = { id: "acc-uuid", status: "ACTIVE", expiresAt: null, productId: "prod-1" };
    const mockCustomer = {
      id: "cust-auth-id",
      telegramUserId: "123456789",
      username: "buyer_authenticated",
    };

    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(mockReadyVideo as any);
    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce(mockAssignment as any);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(mockAccess as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValueOnce(mockCustomer as any);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const result = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-auth-id", "vid-1");

    const jsonString = JSON.stringify(result.watermark);
    expect(jsonString).not.toContain("token");
    expect(jsonString).not.toContain("secret");
    expect(jsonString).not.toContain("bot");
    expect(result.watermark.label).toBe("@buyer_authenticated");
  });
});
