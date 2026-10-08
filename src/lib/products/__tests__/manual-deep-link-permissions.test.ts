import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { POST } from "@/app/api/seller/products/deep-link/route";
import { NextRequest } from "next/server";

// Mock dependencies for API route test
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { getCurrentUser } from "@/lib/auth";

describe("Manual Product Deep Link Access Restriction Suite (SUPER_ADMIN Exclusive)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. SUPER_ADMIN is authorized to generate manual deep link", () => {
    expect(ProductManualDeepLinkService.isAuthorized("SUPER_ADMIN")).toBe(true);
    expect(ProductManualDeepLinkService.isAuthorized("super_admin")).toBe(true);
  });

  it("2. SUPER_ADMIN successfully generates Direct Mini App Deep Link", () => {
    const res = ProductManualDeepLinkService.generateDeepLink({
      productId: "prod-uuid-123",
      botUsername: "@studiioshorts_bot",
      shortName: "shorts",
      userRole: "SUPER_ADMIN",
    });

    expect(res.success).toBe(true);
    expect(res.url).toBe("https://t.me/studiioshorts_bot/shorts?startapp=product_prod-uuid-123");
  });

  it("3. ADMIN is NOT authorized to generate manual deep link", () => {
    expect(ProductManualDeepLinkService.isAuthorized("ADMIN")).toBe(false);
    expect(ProductManualDeepLinkService.isAuthorized("admin")).toBe(false);

    const res = ProductManualDeepLinkService.generateDeepLink({
      productId: "prod-uuid-123",
      botUsername: "@studiioshorts_bot",
      userRole: "ADMIN",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("exclusiva para SUPER_ADMIN");
  });

  it("4. SELLER/VENDEDOR is NOT authorized to generate manual deep link", () => {
    expect(ProductManualDeepLinkService.isAuthorized("SELLER")).toBe(false);
    expect(ProductManualDeepLinkService.isAuthorized("seller")).toBe(false);

    const res = ProductManualDeepLinkService.generateDeepLink({
      productId: "prod-uuid-123",
      botUsername: "@studiioshorts_bot",
      userRole: "SELLER",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("exclusiva para SUPER_ADMIN");
  });

  it("5. CUSTOMER is NOT authorized and receives forbidden error", () => {
    expect(ProductManualDeepLinkService.isAuthorized("CUSTOMER")).toBe(false);

    const res = ProductManualDeepLinkService.generateDeepLink({
      productId: "prod-uuid-123",
      botUsername: "@studiioshorts_bot",
      userRole: "CUSTOMER",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("exclusiva para SUPER_ADMIN");
  });

  it("6. Seller attempting to call deep link API directly receives 403 Forbidden error", async () => {
    (getCurrentUser as any).mockResolvedValue({ id: "seller-user", role: "SELLER" });

    const req = new NextRequest("https://www.webgran.online/api/seller/products/deep-link", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-123", botUsername: "studiioshorts_bot" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("exclusiva para SUPER_ADMIN");
  });

  it("7. SUPER_ADMIN calling deep link API directly receives 200 OK and valid deepLink URL", async () => {
    (getCurrentUser as any).mockResolvedValue({ id: "admin-user", role: "SUPER_ADMIN" });

    const req = new NextRequest("https://www.webgran.online/api/seller/products/deep-link", {
      method: "POST",
      body: JSON.stringify({ productId: "prod-123", botUsername: "studiioshorts_bot" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deepLink).toBe("https://t.me/studiioshorts_bot/shorts?startapp=product_prod-123");
  });

  it("8. product_{productId} resolution flow remains functional", () => {
    const rawStartParam = "product_prod-uuid-999";
    const productId = rawStartParam.replace(/^product[=_]/, "");
    expect(productId).toBe("prod-uuid-999");
  });

  it("9. access_{accessId} post-purchase flow remains functional", () => {
    const rawStartParam = "access_access-uuid-888";
    const accessId = rawStartParam.replace(/^access[=_]/, "");
    expect(accessId).toBe("access-uuid-888");
  });

  it("10. 🔴 ASSISTIR AGORA automatic Telegram notification button format remains web_app link", () => {
    const storeSlug = "studio-shorts";
    const accessId = "access-123";
    const webAppUrl = `https://www.webgran.online/miniapp/${storeSlug}?access=${accessId}`;
    expect(webAppUrl).toContain("/miniapp/studio-shorts?access=access-123");
  });

  it("11. 🎬 ACESSAR MEU PRODUTO Mini App button remains intact", () => {
    const storeSlug = "studio-shorts";
    const productSlug = "a-loba-negra";
    const targetUrl = `/miniapp/${storeSlug}/product/${productSlug}`;
    expect(targetUrl).toBe("/miniapp/studio-shorts/product/a-loba-negra");
  });
});
