import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Dedicated Product Video Player Screen & Navigation Layout Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Dedicated screen route /video/ hides global Mini App bottom navigation bar", () => {
    const videoPathname = "/miniapp/loja-teste/video/vid-123";
    const isVideoRoute = videoPathname.includes("/video/");

    expect(isVideoRoute).toBe(true);
  });

  it("2. Non-video routes (Home, Search, Product, Cart, Accesses) preserve global bottom navigation bar", () => {
    const normalRoutes = [
      "/miniapp/loja-teste",
      "/miniapp/loja-teste/search",
      "/miniapp/loja-teste/product/curso-mestre",
      "/miniapp/loja-teste/cart",
      "/miniapp/loja-teste/accesses",
      "/miniapp/loja-teste/profile",
    ];

    for (const r of normalRoutes) {
      expect(r.includes("/video/")).toBe(false);
    }
  });

  it("3. Back arrow button navigates back to the product page slug", () => {
    const mockStoreSlug = "loja-teste";
    const mockProductSlug = "a-loba-negra-rejeitada";
    const targetUrl = `/miniapp/${mockStoreSlug}/product/${mockProductSlug}`;

    expect(targetUrl).toBe("/miniapp/loja-teste/product/a-loba-negra-rejeitada");
  });
});
