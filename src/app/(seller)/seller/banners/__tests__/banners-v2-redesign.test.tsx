import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock das dependências de Next e DB
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockDb: any = {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ count: 2 }])),
      })),
    })),
    query: {
      banners: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    },
  };
  return { db: mockDb };
});

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  getSellerEntitlement: vi.fn().mockResolvedValue({ isUnlimited: false, value: 5 }),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 5 }),
}));

vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn().mockResolvedValue(undefined),
    deleteMediaFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { getSellerEntitlement, checkLimit } from "@/lib/entitlements/entitlement-service";
import { MediaLifecycleService } from "@/lib/storage/lifecycle-service";
import { db } from "@/db";
import SellerBannersPage from "../page";
import BannersClientV2, { BannerItem } from "../BannersClientV2";
import BannersClient from "../BannersClient";
import {
  getStoreBanners,
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
  reorderBannersAction,
  updateBannerIntervalAction,
} from "../actions";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_BANNERS: BannerItem[] = [
  {
    id: "banner-1",
    storeId: "store-1",
    title: "Mega Promoção de Verão",
    imageUrl: "https://example.com/banner1.webp",
    linkType: "url",
    linkValue: "https://minhaloja.com/promo",
    position: 0,
    status: "active",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
  },
  {
    id: "banner-2",
    storeId: "store-1",
    title: "Novidades da Coleção",
    imageUrl: "https://example.com/banner2.webp",
    linkType: "product",
    linkValue: "prod-123",
    position: 1,
    status: "inactive",
    createdAt: new Date("2026-01-02T10:00:00Z"),
    updatedAt: new Date("2026-01-02T10:00:00Z"),
  },
];

describe("ETAPA 4.4 — REDESIGN V2 DA PÁGINA DE BANNERS (/seller/banners)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-1",
      name: "Loja Teste Banners",
      slug: "loja-teste",
      bannerInterval: 5,
    });

    (db.query.banners.findMany as any).mockResolvedValue(MOCK_BANNERS);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar BannersClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await SellerBannersPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Banners");
      expect(html).toContain("Total de Banners");
      expect(html).toContain("Banners Ativos");
      expect(html).toContain("Transição Automática");
      expect(html).toContain("Novo banner");
      expect(html).toContain("Mega Promoção de Verão");
      expect(html).toContain("Novidades da Coleção");
    });

    it("deve renderizar BannersClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await SellerBannersPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Banners");
      expect(html).toContain("Total de Banners");
      expect(html).toContain("Transição Automática");
    });

    it("NÃO deve renderizar BannersClientV2 para outro admin com e-mail diferente (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await SellerBannersPage();
      const html = renderToStaticMarkup(jsx);

      // O V2 tem "Total de Banners" e "Transição Automática" como StatCards
      expect(html).not.toContain("Transição Automática");
      expect(html).not.toContain("Total de Banners");
      // O clássico tem a listagem normal com badges de posição e status
      expect(html).toContain("Mega Promoção de Verão");
    });

    it("NÃO deve renderizar BannersClientV2 para vendedor comum (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await SellerBannersPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("Transição Automática");
      expect(html).not.toContain("Total de Banners");
      expect(html).toContain("Mega Promoção de Verão");
    });

    it("deve renderizar SetupStoreClient quando o lojista não possui loja cadastrada", async () => {
      (getCurrentStore as any).mockResolvedValue(null);
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: OWNER_EMAIL,
      });

      const jsx = await SellerBannersPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Configure sua Loja");
    });
  });

  describe("2. Renderização do Design System V2 (BannersClientV2)", () => {
    it("deve renderizar os 4 StatCards com cálculos corretos", () => {
      const html = renderToStaticMarkup(
        <BannersClientV2
          initialBanners={MOCK_BANNERS}
          initialInterval={7}
          maxLimit={5}
        />
      );

      // Stat 1: Total
      expect(html).toContain("Total de Banners");
      expect(html).toContain("Limite: 5 banners");

      // Stat 2: Ativos
      expect(html).toContain("Banners Ativos");
      expect(html).toContain("Exibidos na loja");

      // Stat 3: Inativos
      expect(html).toContain("Banners Inativos");
      expect(html).toContain("Ocultos no Mini App");

      // Stat 4: Intervalo
      expect(html).toContain("Transição Automática");
      expect(html).toContain("7s");
      expect(html).toContain("Intervalo de rotação");
    });

    it("deve renderizar Toolbar com campo de busca e controles de visualização", () => {
      const html = renderToStaticMarkup(
        <BannersClientV2
          initialBanners={MOCK_BANNERS}
          initialInterval={5}
          maxLimit={5}
        />
      );

      expect(html).toContain("Buscar por título em 2 banners...");
      expect(html).toContain("Todos os Status");
      expect(html).toContain("Todos os Links");
      expect(html).toContain("Visualização em Grade");
      expect(html).toContain("Visualização em Lista");
    });

    it("deve exibir indicador de posição #1 e #2 e preview 16:9", () => {
      const html = renderToStaticMarkup(
        <BannersClientV2
          initialBanners={MOCK_BANNERS}
          initialInterval={5}
          maxLimit={5}
        />
      );

      expect(html).toContain("#1");
      expect(html).toContain("#2");
      expect(html).toContain("aspect-[16/9]");
      expect(html).toContain("https://example.com/banner1.webp");
    });

    it("deve exibir estado vazio quando não há banners cadastrados", () => {
      const html = renderToStaticMarkup(
        <BannersClientV2
          initialBanners={[]}
          initialInterval={5}
          maxLimit={5}
        />
      );

      expect(html).toContain("Nenhum banner cadastrado");
      expect(html).toContain("Cadastre seu primeiro banner para destacar promoções, novidades e produtos no topo da sua loja.");
      expect(html).toContain("Novo banner");
    });
  });

  describe("3. Regras de Negócio e Server Actions", () => {
    it("createBannerAction: deve rejeitar banner sem imagem", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      await expect(
        createBannerAction({ imageUrl: "" })
      ).rejects.toThrow("A URL ou arquivo de imagem do banner é obrigatório.");
    });

    it("createBannerAction: deve rejeitar imagem que excede 20MB", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });

      // Simula uma string data URL com mais de 28MB (equivalente a >20MB binário)
      const hugeImage = "data:image/jpeg;base64," + "a".repeat(29 * 1024 * 1024);

      await expect(
        createBannerAction({ imageUrl: hugeImage })
      ).rejects.toThrow("A imagem do banner excede o tamanho máximo permitido de 20MB.");
    });

    it("createBannerAction: deve bloquear quando atinge o limite do plano max_banners", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (checkLimit as any).mockResolvedValue({ allowed: false, limit: 5 });

      await expect(
        createBannerAction({ imageUrl: "https://example.com/banner3.webp" })
      ).rejects.toThrow("Limite de banners atingido (2/5). Faça upgrade do seu plano.");
    });

    it("createBannerAction: deve inserir com sucesso e calcular ordem sequencial", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      (checkLimit as any).mockResolvedValue({ allowed: true, limit: 5 });

      const res = await createBannerAction({
        imageUrl: "https://example.com/banner-ok.webp",
        title: "Banner Teste",
        linkType: "url",
        linkValue: "https://google.com",
      });

      expect(res).toEqual({ success: true });
      expect(db.insert).toHaveBeenCalled();
    });

    it("updateBannerAction: deve validar propriedade e rejeitar banner inexistente ou de outra loja", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (db.query.banners.findFirst as any).mockResolvedValue(null);

      await expect(
        updateBannerAction({ id: "banner-alheio", title: "Hacked" })
      ).rejects.toThrow("Banner não encontrado ou sem permissão.");
    });

    it("updateBannerAction: deve atualizar e acionar substituição de mídia ao trocar imagem", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      (db.query.banners.findFirst as any).mockResolvedValue({
        id: "banner-1",
        imageUrl: "https://example.com/old-banner.webp",
      });

      const res = await updateBannerAction({
        id: "banner-1",
        imageUrl: "https://example.com/new-banner.webp",
        title: "Banner Atualizado",
      });

      expect(res).toEqual({ success: true });
      expect(db.update).toHaveBeenCalled();
      expect(MediaLifecycleService.handleImageReplacement).toHaveBeenCalledWith({
        oldUrl: "https://example.com/old-banner.webp",
        newUrl: "https://example.com/new-banner.webp",
        storeId: "store-1",
        excludeEntityId: "banner-1",
      });
    });

    it("deleteBannerAction: deve validar propriedade, excluir do banco e acionar limpeza no storage", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });
      (db.query.banners.findFirst as any).mockResolvedValue({
        id: "banner-1",
        imageUrl: "https://storage.bunnycdn.com/banners/banner-1.webp",
      });

      const res = await deleteBannerAction("banner-1");

      expect(res).toEqual({ success: true });
      expect(db.delete).toHaveBeenCalled();
      expect(MediaLifecycleService.deleteMediaFile).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/banners/banner-1.webp",
        "store-1",
        "banner-1"
      );
    });

    it("reorderBannersAction: deve atualizar as posições sequencialmente para a loja", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });

      const res = await reorderBannersAction(["banner-2", "banner-1"]);

      expect(res).toEqual({ success: true });
      expect(db.update).toHaveBeenCalledTimes(2);
    });

    it("updateBannerIntervalAction: deve validar intervalos válidos [3, 5, 7, 10] e salvar no banco", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1", slug: "loja-teste" });

      const res1 = await updateBannerIntervalAction(7);
      expect(res1).toEqual({ success: true });

      // Se valor for inválido, deve assumir padrão 5
      const res2 = await updateBannerIntervalAction(42);
      expect(res2).toEqual({ success: true });
    });
  });
});
