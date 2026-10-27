import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatProductDetailMessage,
  formatCatalogMessage,
  handleCartCallbackQuery,
  type BotCartContext,
} from "../bot-cart-handler";
import { CartService } from "@/lib/cart/cart-service";
import { ProductVideoService } from "@/lib/videos/product-video-service";

// Mock DB
const mockFindManyProducts = vi.fn();
const mockFindFirstProduct = vi.fn();
const mockFindFirstClip = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      products: {
        findMany: (...args: any[]) => mockFindManyProducts(...args),
        findFirst: (...args: any[]) => mockFindFirstProduct(...args),
      },
      clips: {
        findFirst: (...args: any[]) => mockFindFirstClip(...args),
      },
    },
  },
}));

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    addItemByTelegramUser: vi.fn(),
    getCartByTelegramUser: vi.fn(),
  },
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    listProductVideos: vi.fn(),
  },
}));

describe("WebGran — Fase H: Imagens, Trailers, Layout Mobile e Carrinho", () => {
  const storeId = "store-h-test";
  const miniAppUrl = "https://webgran.test/miniapp/test-store";
  const defaultCtx: BotCartContext = {
    botService: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 101 }),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
    } as any,
    store: {
      id: storeId,
      name: "Loja Teste H",
      slug: "loja-teste-h",
    } as any,
    miniAppUrl,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirstClip.mockResolvedValue(null);
    vi.mocked(ProductVideoService.listProductVideos).mockResolvedValue([]);
  });

  describe("3. Imagem do produto nos detalhes", () => {
    it("should include hero image preview and invisible anchor when product has valid coverUrl", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-img-1",
        storeId,
        title: "E-book Premium",
        description: "Sinopse do produto com detalhes ricos.",
        price: "29.90",
        coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
        status: "active",
      });

      const res = await formatProductDetailMessage(storeId, "prod-img-1", 2, miniAppUrl);

      expect(res).not.toBeNull();
      // Invisible anchor with zero-width space [\u200B](url)
      expect(res!.text).toContain("[\u200B](https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c)");
      expect(res!.text).toContain("*E-book Premium*");
      expect(res!.text).toContain("Sinopse do produto com detalhes ricos.");
      expect(res!.text).toContain("R$ 29,90");

      // Link preview options configured for hero media above text
      expect(res!.linkPreviewOptions).toEqual({
        url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
        prefer_large_media: true,
        show_above_text: true,
      });

      // Navigation preserved
      const allBtns = res!.replyMarkup.inline_keyboard.flat();
      expect(allBtns.some((b: any) => "callback_data" in b && b.callback_data === "cart_add:prod-img-1:2")).toBe(true);
      expect(allBtns.some((b: any) => "callback_data" in b && b.callback_data === "cat_p:2")).toBe(true);
      expect(allBtns.some((b: any) => "callback_data" in b && b.callback_data === "start_menu")).toBe(true);
    });

    it("should fallback gracefully when product has no image (no preview options, clean text)", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-no-img",
        storeId,
        title: "Produto Sem Foto",
        description: "Descrição sem imagem.",
        price: "15.00",
        coverUrl: null,
        status: "active",
      });

      const res = await formatProductDetailMessage(storeId, "prod-no-img", 1, miniAppUrl);

      expect(res).not.toBeNull();
      expect(res!.text).not.toContain("[\u200B]");
      expect(res!.text).toContain("*Produto Sem Foto*");
      expect(res!.linkPreviewOptions).toEqual({ is_disabled: true });
    });

    it("should ignore invalid/dangerous image URLs (e.g. javascript:, ftp:)", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-bad-img",
        storeId,
        title: "Produto URL Invalida",
        description: "Descrição com url suspeita.",
        price: "10.00",
        coverUrl: "javascript:alert(1)",
        status: "active",
      });

      const res = await formatProductDetailMessage(storeId, "prod-bad-img", 1, miniAppUrl);

      expect(res).not.toBeNull();
      expect(res!.text).not.toContain("javascript:");
      expect(res!.linkPreviewOptions).toEqual({ is_disabled: true });
    });
  });

  describe("4. Botão '🎬 Ver trailer'", () => {
    it("should render '🎬 Ver trailer' button when product has assigned video in ProductVideoService", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-trailer-1",
        storeId,
        title: "Curso com Vídeo",
        description: "Aprenda tudo com vídeo.",
        price: "99.00",
        coverUrl: "https://webgran.test/cover.jpg",
        status: "active",
      });

      vi.mocked(ProductVideoService.listProductVideos).mockResolvedValueOnce([
        {
          id: "video-bunny-123",
          status: "READY",
          active: true,
        } as any,
      ]);

      const res = await formatProductDetailMessage(storeId, "prod-trailer-1", 1, miniAppUrl);

      expect(res).not.toBeNull();
      const allBtns = res!.replyMarkup.inline_keyboard.flat();
      const trailerBtn = allBtns.find((b: any) => b.text.includes("Ver trailer"));
      expect(trailerBtn).toBeDefined();
      expect(trailerBtn!.text).toBe("🎬 Ver trailer");
      if (trailerBtn && "web_app" in trailerBtn && trailerBtn.web_app) {
        expect(trailerBtn.web_app.url).toContain("/video/video-bunny-123");
      }
    });

    it("should render '🎬 Ver trailer' button when product has clip in clips table", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-clip-1",
        storeId,
        title: "Produto com Clip",
        description: "Descrição.",
        price: "50.00",
        coverUrl: null,
        status: "active",
      });

      mockFindFirstClip.mockResolvedValueOnce({
        id: "clip-uuid-99",
        productId: "prod-clip-1",
        storeId,
      });

      const res = await formatProductDetailMessage(storeId, "prod-clip-1", 1, miniAppUrl);

      expect(res).not.toBeNull();
      const allBtns = res!.replyMarkup.inline_keyboard.flat();
      const trailerBtn = allBtns.find((b: any) => b.text.includes("Ver trailer"));
      expect(trailerBtn).toBeDefined();
      expect(trailerBtn!.text).toBe("🎬 Ver trailer");
      if (trailerBtn && "web_app" in trailerBtn && trailerBtn.web_app) {
        expect(trailerBtn.web_app.url).toContain("/clips?productId=prod-clip-1");
      }
    });

    it("should render '🎬 Ver trailer' button when description has valid YouTube or Vimeo trailer URL", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-yt-1",
        storeId,
        title: "Filme Indie",
        description: "Assista a prévia aqui: https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        price: "19.90",
        coverUrl: null,
        status: "active",
      });

      const res = await formatProductDetailMessage(storeId, "prod-yt-1", 1, miniAppUrl);

      expect(res).not.toBeNull();
      const allBtns = res!.replyMarkup.inline_keyboard.flat();
      const trailerBtn = allBtns.find((b: any) => b.text.includes("Ver trailer"));
      expect(trailerBtn).toBeDefined();
      expect(trailerBtn!.text).toBe("🎬 Ver trailer");
      if (trailerBtn && "url" in trailerBtn) {
        expect(trailerBtn.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      }
    });

    it("should NOT render '🎬 Ver trailer' when product has no video, clip or trailer URL", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-no-trailer",
        storeId,
        title: "Produto Sem Trailer",
        description: "Descrição sem nenhum vídeo.",
        price: "10.00",
        coverUrl: null,
        status: "active",
      });

      const res = await formatProductDetailMessage(storeId, "prod-no-trailer", 1, miniAppUrl);

      expect(res).not.toBeNull();
      const allBtns = res!.replyMarkup.inline_keyboard.flat();
      expect(allBtns.some((b: any) => b.text.includes("Ver trailer"))).toBe(false);
    });
  });

  describe("Layout do catálogo com 0, 1, 10, 11, 20 e 21 produtos", () => {
    function generateProducts(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        id: `prod-${i + 1}`,
        storeId,
        title: `Produto ${i + 1}`,
        price: `${(i + 1) * 10}.00`,
        status: "active",
      }));
    }

    it("should handle 0 products gracefully", async () => {
      mockFindManyProducts.mockResolvedValueOnce([]);
      const res = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(res.text).toContain("Nenhum produto disponível no momento.");
      expect(res.replyMarkup.inline_keyboard).toHaveLength(2); // MiniApp + Voltar ao Menu
    });

    it("should handle 1 product on page 1 of 1", async () => {
      mockFindManyProducts.mockResolvedValueOnce(generateProducts(1));
      const res = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(res.text).toContain("Página 1 de 1 · 1 produto");
      expect(res.text).toContain("*1.* Produto 1 — *R$ 10,00*");
      expect(res.replyMarkup.inline_keyboard[0][0].text).toBe("1. Produto 1");
      expect(res.replyMarkup.inline_keyboard[0][1].text).toBe("🛒");
    });

    it("should handle exactly 10 products on page 1 of 1 without pagination buttons", async () => {
      mockFindManyProducts.mockResolvedValueOnce(generateProducts(10));
      const res = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(res.text).toContain("Página 1 de 1 · 10 produtos");
      // Check 10 rows of products
      for (let i = 1; i <= 10; i++) {
        expect(res.text).toContain(`*${i}.* Produto ${i}`);
        expect(res.replyMarkup.inline_keyboard[i - 1][0].text).toBe(`${i}. Produto ${i}`);
        expect(res.replyMarkup.inline_keyboard[i - 1][1].text).toBe("🛒");
      }
      // No pagination row (only products + actions + menu)
      const allText = res.replyMarkup.inline_keyboard.flat().map((b: any) => b.text);
      expect(allText.some((t: any) => t.includes("Próxima") || t.includes("Anterior"))).toBe(false);
    });

    it("should handle 11 products: page 1 has 10 items + Próxima button; page 2 has 1 item + Anterior button", async () => {
      const prods11 = generateProducts(11);

      // Page 1
      mockFindManyProducts.mockResolvedValueOnce(prods11);
      const resPage1 = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(resPage1.text).toContain("Página 1 de 2 · 11 produtos");
      const page1Btns = resPage1.replyMarkup.inline_keyboard.flat();
      expect(page1Btns.some((b: any) => b.text.includes("Próxima ▶️"))).toBe(true);
      expect(page1Btns.some((b: any) => b.text.includes("◀️ Anterior"))).toBe(false);

      // Page 2
      mockFindManyProducts.mockResolvedValueOnce(prods11);
      const resPage2 = await formatCatalogMessage(storeId, miniAppUrl, 2);
      expect(resPage2.text).toContain("Página 2 de 2 · 11 produtos");
      expect(resPage2.text).toContain("*11.* Produto 11");
      const page2Btns = resPage2.replyMarkup.inline_keyboard.flat();
      expect(page2Btns.some((b: any) => b.text.includes("◀️ Anterior"))).toBe(true);
      expect(page2Btns.some((b: any) => b.text.includes("Próxima ▶️"))).toBe(false);
    });

    it("should handle 20 products: exactly 2 pages of 10 items each", async () => {
      const prods20 = generateProducts(20);
      mockFindManyProducts.mockResolvedValueOnce(prods20);
      const res = await formatCatalogMessage(storeId, miniAppUrl, 1);
      expect(res.text).toContain("Página 1 de 2 · 20 produtos");
    });

    it("should handle 21 products: 3 pages (10 + 10 + 1)", async () => {
      const prods21 = generateProducts(21);

      // Page 2 of 3 should have BOTH Anterior and Próxima
      mockFindManyProducts.mockResolvedValueOnce(prods21);
      const resPage2 = await formatCatalogMessage(storeId, miniAppUrl, 2);
      expect(resPage2.text).toContain("Página 2 de 3 · 21 produtos");
      const page2Btns = resPage2.replyMarkup.inline_keyboard.flat();
      expect(page2Btns.some((b: any) => b.text.includes("◀️ Anterior"))).toBe(true);
      expect(page2Btns.some((b: any) => b.text.includes("Próxima ▶️"))).toBe(true);

      // Page 3 of 3 should have 1 item (*21.*) and only Anterior
      mockFindManyProducts.mockResolvedValueOnce(prods21);
      const resPage3 = await formatCatalogMessage(storeId, miniAppUrl, 3);
      expect(resPage3.text).toContain("Página 3 de 3 · 21 produtos");
      expect(resPage3.text).toContain("*21.* Produto 21");
    });
  });

  describe("Tratamento de persistência e adições consecutivas no carrinho", () => {
    it("should alert user when persistence fails without showing fake success", async () => {
      mockFindFirstProduct.mockResolvedValueOnce({
        id: "prod-fail",
        storeId,
        title: "Produto Falha",
        status: "active",
      });

      vi.mocked(CartService.addItemByTelegramUser).mockRejectedValueOnce(new Error("Database connection lost"));

      const handled = await handleCartCallbackQuery(
        defaultCtx,
        "cb-err-1",
        12345,
        100,
        "cart_add:prod-fail:1",
        { id: 999 }
      );

      expect(handled).toBe(true);
      expect(defaultCtx.botService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-err-1",
        "⚠️ Não foi possível alterar o carrinho no momento.",
        true
      );
    });

    it("should allow consecutive legitimate additions with distinct callback IDs and update cart correctly", async () => {
      mockFindFirstProduct.mockResolvedValue({
        id: "prod-add-1",
        storeId,
        title: "Produto 1",
        status: "active",
      });

      vi.mocked(CartService.addItemByTelegramUser)
        .mockResolvedValueOnce({
          items: [{ quantity: 1 }],
          subtotal: 10,
        } as any)
        .mockResolvedValueOnce({
          items: [{ quantity: 2 }],
          subtotal: 20,
        } as any);

      // 1st addition
      const res1 = await handleCartCallbackQuery(
        defaultCtx,
        "cb-add-click-1",
        12345,
        100,
        "cart_add:prod-add-1:1",
        { id: 999 }
      );
      expect(res1).toBe(true);
      expect(defaultCtx.botService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-add-click-1",
        expect.stringContaining("adicionado ao carrinho!")
      );

      // 2nd legitimate addition
      const res2 = await handleCartCallbackQuery(
        defaultCtx,
        "cb-add-click-2",
        12345,
        100,
        "cart_add:prod-add-1:1",
        { id: 999 }
      );
      expect(res2).toBe(true);
      expect(defaultCtx.botService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-add-click-2",
        expect.stringContaining("adicionado ao carrinho!")
      );

      expect(CartService.addItemByTelegramUser).toHaveBeenCalledTimes(2);
    });
  });
});
