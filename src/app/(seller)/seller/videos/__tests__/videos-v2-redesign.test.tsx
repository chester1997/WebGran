import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock das dependências de Next e serviços
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

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  getSellerEntitlement: vi.fn().mockResolvedValue({ isUnlimited: true, value: -1 }),
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    listSellerLibraryVideos: vi.fn().mockResolvedValue([]),
    getSellerVideoStorageUsage: vi.fn().mockResolvedValue({
      usedBytes: 5 * 1024 * 1024 * 1024,
      quotaGb: 50,
      quotaBytes: 50 * 1024 * 1024 * 1024,
      reservedBytes: 0,
      remainingBytes: 45 * 1024 * 1024 * 1024,
      percentUsed: 10,
      hasVideoSubscription: true,
      planName: "PROPRIETÁRIO / ILIMITADO",
      isUnlimited: true,
    }),
  },
}));

vi.mock("@/components/miniapp/ProductVideoPlayer", () => ({
  ProductVideoPlayer: () => <div data-testid="mock-player">Player de Vídeo</div>,
}));

vi.mock("@/components/billing/VideoPlanUpgradeModal", () => ({
  VideoPlanUpgradeModal: () => <div data-testid="mock-plan-modal">Modal Upgrade</div>,
}));

vi.mock("@/components/seller/GenerateDeepLinkModal", () => ({
  GenerateDeepLinkModal: () => <div data-testid="mock-deeplink-modal">Modal DeepLink</div>,
}));

vi.mock("./InlineVideoLibraryOnboarding", () => ({
  InlineVideoLibraryOnboarding: () => <div data-testid="mock-onboarding">Onboarding de Vídeos</div>,
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import SellerVideosPage from "../page";
import VideoLibraryClientV2, {
  LibraryVideoItem,
  VideoStorageUsage,
} from "../VideoLibraryClientV2";
import VideosClient from "../VideosClient";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_VIDEOS: LibraryVideoItem[] = [
  {
    id: "vid-1",
    storeId: "store-1",
    bunnyVideoId: "bunny-123",
    title: "Aula Inaugural de Finanças",
    description: "Introdução prática ao módulo de investimentos.",
    durationSeconds: 345,
    fileSizeBytes: 120 * 1024 * 1024,
    thumbnailUrl: "https://example.com/thumb1.webp",
    status: "READY",
    active: true,
    createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    assignedProductsCount: 2,
    assignments: [
      { id: "assign-1", productId: "prod-1", productTitle: "Curso Completo de Finanças" },
      { id: "assign-2", productId: "prod-2", productTitle: "Mentoria VIP" },
    ],
  },
  {
    id: "vid-2",
    storeId: "store-1",
    bunnyVideoId: "bunny-456",
    title: "Workshop de Estratégias",
    description: "Gravação ao vivo do evento exclusivo.",
    durationSeconds: 900,
    fileSizeBytes: 450 * 1024 * 1024,
    thumbnailUrl: null,
    status: "PROCESSING",
    active: false,
    createdAt: new Date("2026-01-02T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-02T10:00:00Z").toISOString(),
    assignedProductsCount: 0,
    assignments: [],
  },
];

const MOCK_USAGE: VideoStorageUsage = {
  usedBytes: 5 * 1024 * 1024 * 1024,
  quotaBytes: 50 * 1024 * 1024 * 1024,
  reservedBytes: 0,
  usedGB: 5.0,
  quotaGB: 50,
  freeGB: 45.0,
  percentage: 10,
  hasVideoSubscription: true,
  planName: "PROPRIETÁRIO / ILIMITADO",
  isUnlimited: true,
};

describe("ETAPA 4.6 — REDESIGN V2 DA BIBLIOTECA DE VÍDEOS (/seller/videos & /seller/video-library)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-1",
      name: "Loja Teste Vídeos",
      slug: "loja-teste",
    });

    (hasFeature as any).mockResolvedValue(true);
    (ProductVideoService.listSellerLibraryVideos as any).mockResolvedValue(MOCK_VIDEOS);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar VideoLibraryClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Biblioteca de Vídeos");
      expect(html).toContain("Total de Vídeos");
      expect(html).toContain("Vídeos Prontos");
      expect(html).toContain("Em Processamento");
      expect(html).toContain("Aula Inaugural de Finanças");
      expect(html).toContain("Workshop de Estratégias");
    });

    it("deve renderizar VideoLibraryClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Biblioteca de Vídeos");
      expect(html).toContain("Total de Vídeos");
      expect(html).toContain("Vídeos Prontos");
    });

    it("NÃO deve renderizar VideoLibraryClientV2 para outro admin com e-mail diferente (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      // O V2 possui os StatCards padronizados do Design System V2
      expect(html).not.toContain("Total de Vídeos");
      expect(html).not.toContain("Vídeos Prontos");
      expect(html).toContain("Aula Inaugural de Finanças");
    });

    it("NÃO deve renderizar VideoLibraryClientV2 para vendedor comum (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("Total de Vídeos");
      expect(html).toContain("Aula Inaugural de Finanças");
    });

    it("deve exibir tela de recurso desativado quando product_videos_enabled for falso", async () => {
      (hasFeature as any).mockResolvedValue(false);
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: OWNER_EMAIL,
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Biblioteca de Vídeos Desativada");
    });

    it("deve renderizar SetupStoreClient quando o lojista não possui loja cadastrada", async () => {
      (getCurrentStore as any).mockResolvedValue(null);
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: OWNER_EMAIL,
      });

      const jsx = await SellerVideosPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Configure sua Loja");
    });
  });

  describe("2. Renderização do Design System V2 (VideoLibraryClientV2)", () => {
    it("deve renderizar Header V2 com badge e botões de ação", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={MOCK_VIDEOS}
          initialUsage={MOCK_USAGE}
        />
      );

      expect(html).toContain("Biblioteca de Vídeos");
      expect(html).toContain("2 vídeos cadastrados");
      expect(html).toContain("Atualizar");
      expect(html).toContain("Adicionar vídeo");
    });

    it("deve renderizar os 4 StatCards com métricas calculadas", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={MOCK_VIDEOS}
          initialUsage={MOCK_USAGE}
        />
      );

      // Stat 1: Total
      expect(html).toContain("Total de Vídeos");
      expect(html).toContain("Vídeos na biblioteca");

      // Stat 2: Prontos
      expect(html).toContain("Vídeos Prontos");
      expect(html).toContain("Prontos para streaming");

      // Stat 3: Em Processamento
      expect(html).toContain("Em Processamento");
      expect(html).toContain("Aguardando otimização");

      // Stat 4: Armazenamento
      expect(html).toContain("Armazenamento");
      expect(html).toContain("5.0 GB");
    });

    it("deve renderizar Barra de Armazenamento com percentual e status de cota", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={MOCK_VIDEOS}
          initialUsage={MOCK_USAGE}
        />
      );

      expect(html).toContain("PLANO: PROPRIETÁRIO / ILIMITADO");
      expect(html).toContain("5.0 GB / ILIMITADO");
      expect(html).toContain("Uso sem restrições de quota");
    });

    it("deve renderizar Toolbar com campo de busca, filtros de status e botões de grade/lista", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={MOCK_VIDEOS}
          initialUsage={MOCK_USAGE}
        />
      );

      expect(html).toContain("Buscar em 2 vídeos por título ou descrição...");
      expect(html).toContain("Todos os status");
      expect(html).toContain("Prontos");
      expect(html).toContain("Processando");
      expect(html).toContain("Todas visibilidades");
      expect(html).toContain("Visualização em Grade");
      expect(html).toContain("Visualização em Lista");
    });

    it("deve exibir card de vídeo com thumbnail 16:9, badges de status, duração e produtos vinculados", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={MOCK_VIDEOS}
          initialUsage={MOCK_USAGE}
        />
      );

      expect(html).toContain("Aula Inaugural de Finanças");
      expect(html).toContain("PRONTO");
      expect(html).toContain("5:45");
      expect(html).toContain("120.0 MB");
      expect(html).toContain("2 produto(s)");

      expect(html).toContain("Workshop de Estratégias");
      expect(html).toContain("PROCESSANDO");
      expect(html).toContain("15:00");
      expect(html).toContain("450.0 MB");
      expect(html).toContain("Avulso");
    });

    it("deve renderizar tela de contratação quando vendedor não possui assinatura de vídeo", () => {
      const noSubUsage: VideoStorageUsage = {
        ...MOCK_USAGE,
        hasVideoSubscription: false,
        isUnlimited: false,
      };

      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={[]}
          initialUsage={noSubUsage}
        />
      );

      expect(html).toContain("Habilite o armazenamento em nuvem para entregar conteúdos e vídeos aos seus clientes.");
    });

    it("deve exibir EmptyState quando não há vídeos na biblioteca", () => {
      const html = renderToStaticMarkup(
        <VideoLibraryClientV2
          initialVideos={[]}
          initialUsage={MOCK_USAGE}
        />
      );

      expect(html).toContain("Nenhum vídeo na biblioteca");
      expect(html).toContain("Faça upload dos seus primeiros vídeos para utilizá-los na entrega");
      expect(html).toContain("Adicionar primeiro vídeo");
    });
  });
});
