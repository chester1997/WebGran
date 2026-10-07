import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

vi.mock("@/db", () => {
  const mockDb = {
    query: {
      stores: {
        findFirst: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
      },
      accesses: {
        findFirst: vi.fn(),
      },
      productVideoAssignments: {
        findMany: vi.fn(),
      },
      productVideos: {
        findFirst: vi.fn(),
      },
    },
  };
  return { db: mockDb };
});

vi.mock("@/lib/telegram/session", () => ({
  resolveMiniAppCustomerSession: vi.fn(),
  getMiniAppSession: vi.fn(),
}));

import { db } from "@/db";
import { resolveMiniAppCustomerSession } from "@/lib/telegram/session";

describe("Product Deep Link Resolver API (/api/telegram/product/resolve)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. User WITHOUT active access -> Routes to public product sales page", async () => {
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      slug: "loba-negra",
      deliveryType: "product_video",
    });

    (resolveMiniAppCustomerSession as any).mockResolvedValue(null);
    (db.query.accesses.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest("https://www.webgran.online/api/telegram/product/resolve", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1", storeSlug: "loja-teste" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.hasAccess).toBe(false);
    expect(data.destinationUrl).toBe("/miniapp/loja-teste/product/loba-negra");
  });

  it("2. User WITH active access & READY video -> Routes directly to first READY video player", async () => {
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      slug: "loba-negra",
      deliveryType: "product_video",
    });

    (resolveMiniAppCustomerSession as any).mockResolvedValue({ customerId: "cust-1", storeId: "store-1" });
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-1",
      status: "ACTIVE",
      expiresAt: null,
      product: { duration: "lifetime" },
    });

    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([
      { position: 0, video: { id: "vid-ready-1", status: "READY", active: true } },
    ]);

    const req = new NextRequest("https://www.webgran.online/api/telegram/product/resolve", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1", storeSlug: "loja-teste" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.hasAccess).toBe(true);
    expect(data.destinationUrl).toBe("/miniapp/loja-teste/video/vid-ready-1");
  });

  it("3. User WITH active access but NO ready video -> Routes safely to accesses page", async () => {
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      slug: "loba-negra",
      deliveryType: "product_video",
    });

    (resolveMiniAppCustomerSession as any).mockResolvedValue({ customerId: "cust-1", storeId: "store-1" });
    (db.query.accesses.findFirst as any).mockResolvedValue({
      id: "access-1",
      status: "ACTIVE",
      expiresAt: null,
      product: { duration: "lifetime" },
    });

    (db.query.productVideoAssignments.findMany as any).mockResolvedValue([]);
    (db.query.productVideos.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest("https://www.webgran.online/api/telegram/product/resolve", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-1", storeSlug: "loja-teste" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.hasAccess).toBe(true);
    expect(data.destinationUrl).toBe("/miniapp/loja-teste/accesses");
  });

  it("4. Non-existent product -> Fallback safely to store root", async () => {
    (db.query.stores.findFirst as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
    (db.query.products.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest("https://www.webgran.online/api/telegram/product/resolve", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-invalid", storeSlug: "loja-teste" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.destinationUrl).toBe("/miniapp/loja-teste");
  });
});
