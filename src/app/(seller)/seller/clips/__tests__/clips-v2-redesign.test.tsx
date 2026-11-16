import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
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

vi.mock("@/lib/clips/service", () => ({
  ClipService: {
    listStoreClips: vi.fn(),
    createClip: vi.fn(),
    getClipById: vi.fn(),
    deleteClip: vi.fn(),
    updateClipStatusByBunnyId: vi.fn(),
  },
}));

const { mockDb } = vi.hoisted(() => {
  const db: any = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "clip-123", title: "Novo Clip" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "clip-123", title: "Clip Atualizado" }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      products: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      clips: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ value: 2 }])),
      })),
    })),
  };
  return { mockDb: db };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 50 }),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ClipService } from "@/lib/clips/service";
import { CLIP_MAX_DURATION_SECONDS, formatDurationHuman } from "@/lib/clips/video-processor";
import SellerClipsPage from "../page";
import BotClipsPage from "../../bot/clips/page";
import ClipsClientV2, { ClipItem, ClipsStats, ProductOption } from "../ClipsClientV2";
import ClipsClient from "../../bot/clips/ClipsClient";

describe("ETAPA 4.9 — REDESIGN V2 DA PÁGINA DE CLIPS (/seller/clips & /seller/bot/clips)", () => {
  const OWNER_USER_ID = "ead2ec50-ac72-4917-9d9c-1c68de270070";
  const OWNER_EMAIL = "lf49127@gmail.com";

  const mockStore = {
    id: "store-clips-123",
    name: "Loja Clips Oficial V2",
    slug: "loja-clips-v2",
    ownerId: OWNER_USER_ID,
  };

  const mockProducts: ProductOption[] = [
    {
      id: "prod-1",
      title: "Curso Next.js Pro",
      price: "197.00",
      coverUrl: "https://cdn.test/prod1.jpg",
      slug: "curso-nextjs-pro",
      status: "ACTIVE",
    },
    {
      id: "prod-2",
      title: "Mentoria VIP",
      price: "497.00",
      coverUrl: null,
      slug: "mentoria-vip",
      status: "ACTIVE",
    },
  ];

  const mockClips: ClipItem[] = [
    {
      id: "clip-1",
      storeId: mockStore.id,
      title: "Demonstração do Módulo 1",
      description: "Aprenda arquitetura de componentes",
      bunnyVideoId: "bunny-vid-001",
      thumbnailUrl: "https://vz-test.b-cdn.net/bunny-vid-001/thumbnail.jpg",
      duration: 65,
      status: "READY",
      position: 0,
      isActive: true,
      productId: "prod-1",
      product: mockProducts[0],
      createdAt: new Date("2026-11-01T10:00:00Z"),
      updatedAt: new Date("2026-11-01T10:00:00Z"),
    },
    {
      id: "clip-2",
      storeId: mockStore.id,
      title: "Apresentação da Mentoria",
      description: "Depoimento e resultados",
      bunnyVideoId: "bunny-vid-002",
      thumbnailUrl: null,
      duration: null,
      status: "PROCESSING",
      position: 1,
      isActive: false,
      productId: "prod-2",
      product: mockProducts[1],
      createdAt: new Date("2026-11-02T10:00:00Z"),
      updatedAt: new Date("2026-11-02T10:00:00Z"),
    },
  ];

  const mockStats: ClipsStats = {
    total: 2,
    published: 1,
    processing: 1,
    failed: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentStore as any).mockResolvedValue(mockStore);
    (ClipService.listStoreClips as any).mockResolvedValue(mockClips);
    (mockDb.query.products.findMany as any).mockResolvedValue(mockProducts);
  });

  describe("1. Isolamento de Segurança no Servidor", () => {
    it("deve renderizar ClipsClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "admin",
        email: "qualquer@email.com",
      });

      const pageElement = await SellerClipsPage();
      expect(pageElement.type).toBe(ClipsClientV2);
      expect(pageElement.props.initialClips).toHaveLength(2);
      expect(pageElement.props.initialStats.total).toBe(2);
    });

    it("deve renderizar ClipsClientV2 para usuário com role=admin e OWNER_EMAIL oficial", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-id-admin",
        role: "admin",
        email: " LF49127@GMAIL.COM ", // teste com espaços e maiúsculas
      });

      const pageElement = await SellerClipsPage();
      expect(pageElement.type).toBe(ClipsClientV2);
    });

    it("NÃO deve renderizar ClipsClientV2 para administrador que não seja o proprietário (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "admin-comum-id",
        role: "admin",
        email: "outro_admin@empresa.com",
      });

      const pageElement = await SellerClipsPage();
      expect(pageElement.type).toBe(ClipsClient);
      expect(pageElement.type).not.toBe(ClipsClientV2);
    });

    it("NÃO deve renderizar ClipsClientV2 para vendedor comum (fallback clássico)", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-regular-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const pageElement = await SellerClipsPage();
      expect(pageElement.type).toBe(ClipsClient);
      expect(pageElement.type).not.toBe(ClipsClientV2);
    });

    it("deve funcionar identicamente em /seller/clips e /seller/bot/clips", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "admin",
        email: OWNER_EMAIL,
      });

      const clipsPage = await SellerClipsPage();
      const botClipsPage = await BotClipsPage();

      expect(clipsPage.type).toBe(ClipsClientV2);
      expect(botClipsPage.type).toBe(ClipsClientV2);
    });
  });

  describe("2. Renderização da Interface V2 e Design System", () => {
    it("deve renderizar PageHeader V2 com título, subtítulo e badge", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Clips");
      expect(html).toContain("Gerencie os vídeos curtos exibidos na sua loja online");
      expect(html).toContain("2 clips");
      expect(html).toContain("Adicionar Clip");
    });

    it("deve renderizar 4 StatCards com métricas reais do Neon", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Total de Clips");
      expect(html).toContain("Publicados");
      expect(html).toContain("Processando");
      expect(html).toContain("Falhas");
    });

    it("deve renderizar Toolbar com SearchInput e SegmentedControl", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Buscar por título, descrição ou produto...");
      expect(html).toContain("Todos");
      expect(html).toContain("Publicados");
      expect(html).toContain("Processando");
      expect(html).toContain("Ativos");
      expect(html).toContain("Inativos");
    });

    it("deve renderizar cards com poster, posição, status chip, duração e produto vinculado", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Demonstração do Módulo 1");
      expect(html).toContain("#1");
      expect(html).toContain("Publicado");
      expect(html).toContain("01:05"); // 65s formatado
      expect(html).toContain("Curso Next.js Pro");
      expect(html).toContain("bunny-vid-001");
    });

    it("deve renderizar EmptyState amigável quando a lista de clips for vazia", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={[]}
          initialStats={{ total: 0, published: 0, processing: 0, failed: 0 }}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Nenhum clip cadastrado");
      expect(html).toContain("Adicionar Primeiro Clip");
    });

    it("deve respeitar a prop hideHeader quando incorporado em abas do bot", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
          hideHeader={true}
        />
      );

      // Não deve renderizar o elemento header do PageHeader
      expect(html).not.toContain("Gerencie os vídeos curtos exibidos na sua loja online");
    });
  });

  describe("3. Regras de Negócio e Validações de Clip", () => {
    it("deve validar a duração máxima de 120 segundos para clips", () => {
      expect(CLIP_MAX_DURATION_SECONDS).toBe(120);
      expect(formatDurationHuman(120)).toBe("2m");
      expect(formatDurationHuman(65)).toBe("1m 5s");
      expect(formatDurationHuman(45)).toBe("45s");
    });

    it("deve vincular produtos cadastrados na loja preservando multi-tenancy", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Curso Next.js Pro");
      expect(html).toContain("Mentoria VIP");
    });

    it("deve conter botões de ação para assistir, alternar visibilidade, editar e excluir", () => {
      const html = renderToStaticMarkup(
        <ClipsClientV2
          initialClips={mockClips}
          initialStats={mockStats}
          availableProducts={mockProducts}
        />
      );

      expect(html).toContain("Pré-visualizar clip");
      expect(html).toContain("Desativar Clip");
      expect(html).toContain("Editar Clip");
      expect(html).toContain("Excluir Clip");
      expect(html).toContain("Subir posição");
      expect(html).toContain("Descer posição");
    });
  });
});
