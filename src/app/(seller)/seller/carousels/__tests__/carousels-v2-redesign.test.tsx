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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { mockDb } = vi.hoisted(() => {
  const db: any = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "carousel-new", name: "Novo Carrossel" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      productCarousels: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
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
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 10 }),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import SellerCarouselsPage from "../page";
import CarouselsClientV2, {
  StandardCarousel,
  RankingCarousel,
  ProductOption,
} from "../CarouselsClientV2";
import CarouselsClient from "../CarouselsClient";

describe("ETAPA 4.7 — REDESIGN V2 DA PÁGINA DE CARROSSÉIS (/seller/carousels)", () => {
  const OWNER_USER_ID = "ead2ec50-ac72-4917-9d9c-1c68de270070";
  const OWNER_EMAIL = "lf49127@gmail.com";

  const mockStore = {
    id: "store-owner-123",
    name: "Loja Oficial V2",
    slug: "loja-oficial-v2",
    ownerId: OWNER_USER_ID,
  };

  const mockRankingCarousel: RankingCarousel = {
    id: "ranking-1",
    name: "Top 15 Hoje",
    status: "active",
    position: 0,
    indicatorType: "ICON",
    iconName: "Trophy",
    iconColor: "#FFD700",
    items: [
      {
        id: "item-r1",
        productId: "prod-1",
        position: 0,
        product: { id: "prod-1", title: "Curso de Next.js", price: "97.00", badge: "HOT" },
      },
      {
        id: "item-r2",
        productId: "prod-2",
        position: 1,
        product: { id: "prod-2", title: "Comunidade VIP", price: "197.00", badge: "NEW" },
      },
    ],
  };

  const mockStandardCarousels: StandardCarousel[] = [
    {
      id: "car-1",
      name: "Lançamentos",
      status: "active",
      position: 1,
      indicatorType: "BAR",
      iconColor: "#8B5CF6",
      items: [
        {
          id: "item-c1",
          productId: "prod-1",
          position: 0,
          product: { id: "prod-1", title: "Curso de Next.js", price: "97.00", badge: "HOT" },
        },
      ],
    },
    {
      id: "car-2",
      name: "Ofertas Especiais",
      status: "inactive",
      position: 2,
      indicatorType: "ICON",
      iconName: "Flame",
      iconColor: "#EF4444",
      items: [],
    },
  ];

  const mockStoreProducts: ProductOption[] = [
    { id: "prod-1", title: "Curso de Next.js", price: "97.00", badge: "HOT" },
    { id: "prod-2", title: "Comunidade VIP", price: "197.00", badge: "NEW" },
    { id: "prod-3", title: "Ebook Gratuito", price: "0.00" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);
    vi.mocked(mockDb.query.productCarousels.findFirst).mockResolvedValue(mockRankingCarousel as any);
    vi.mocked(mockDb.query.productCarousels.findMany).mockResolvedValue(mockStandardCarousels as any);
    vi.mocked(mockDb.query.products.findMany).mockResolvedValue(mockStoreProducts as any);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar CarouselsClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: OWNER_USER_ID,
        email: "qualquer@email.com",
        role: "seller",
      } as any);

      const page = await SellerCarouselsPage();
      const html = renderToStaticMarkup(page);

      // Deve conter elementos exclusivos do CarouselsClientV2
      expect(html).toContain("Carrosséis Temáticos da Loja");
      expect(html).toContain("Total de Seções");
      expect(html).toContain("Ranking Editorial");
    });

    it("deve renderizar CarouselsClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "outro-id-admin",
        email: "LF49127@GMAIL.COM", // maiúsculas para testar normalização
        role: "admin",
      } as any);

      const page = await SellerCarouselsPage();
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Carrosséis Temáticos da Loja");
      expect(html).toContain("Total de Seções");
      expect(html).toContain("Ranking Editorial");
    });

    it("NÃO deve renderizar CarouselsClientV2 para admin secundário com outro e-mail (fallback clássico)", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "admin-secundario",
        email: "outro-admin@webgran.com",
        role: "admin",
      } as any);

      const page = await SellerCarouselsPage();
      const html = renderToStaticMarkup(page);

      // Deve renderizar a interface clássica CarouselsClient
      expect(html).toContain("Outros Carrosséis da Loja");
      expect(html).not.toContain("Carrosséis Temáticos da Loja");
      expect(html).not.toContain("Total de Seções");
    });

    it("NÃO deve renderizar CarouselsClientV2 para vendedor comum (fallback clássico)", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "vendedor-regular",
        email: "vendedor@loja.com",
        role: "seller",
      } as any);

      const page = await SellerCarouselsPage();
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Outros Carrosséis da Loja");
      expect(html).not.toContain("Carrosséis Temáticos da Loja");
      expect(html).not.toContain("Total de Seções");
    });

    it("deve renderizar SetupStoreClient quando o lojista não possui loja cadastrada", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        role: "admin",
      } as any);
      vi.mocked(getCurrentStore).mockResolvedValue(null);

      const page = await SellerCarouselsPage();
      const html = renderToStaticMarkup(page);

      expect(html).not.toContain("Carrosséis Temáticos da Loja");
      expect(html).not.toContain("Outros Carrosséis da Loja");
    });
  });

  describe("2. Renderização do Design System V2 (CarouselsClientV2)", () => {
    it("deve renderizar PageHeader com título, badge de seções e botões de ação", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Carrosséis");
      expect(html).toContain("Personalize a seção de Ranking Editorial");
      expect(html).toContain("3 seções"); // 2 padrão + 1 ranking
      expect(html).toContain("Configurar Ranking");
      expect(html).toContain("Novo Carrossel");
    });

    it("deve renderizar os 4 StatCards operacionais com métricas precisas", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Total de Seções");
      expect(html).toContain("3"); // total sections
      expect(html).toContain("Carrosséis Ativos");
      expect(html).toContain("2"); // ranking (active) + car-1 (active)
      expect(html).toContain("Ranking Editorial");
      expect(html).toContain("Ativo");
      expect(html).toContain("2 de 15 produtos vinculados");
      expect(html).toContain("Produtos Vinculados");
      expect(html).toContain("3"); // 2 no ranking + 1 no car-1
    });

    it("deve renderizar o card especial em destaque do Ranking Editorial (Top 15)", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Top 15 Hoje");
      expect(html).toContain("Ativo na Home");
      expect(html).toContain("Gerenciar Top 15");
      expect(html).toContain("Curso de Next.js");
      expect(html).toContain("Comunidade VIP");
    });

    it("deve renderizar Toolbar V2 com SearchInput e SegmentedControl", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Buscar por nome do carrossel ou produto...");
      expect(html).toContain("Todos");
      expect(html).toContain("Ativos");
      expect(html).toContain("Ocultos");
    });

    it("deve renderizar os carrosséis temáticos no modo Grade por padrão", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Lançamentos");
      expect(html).toContain("Ofertas Especiais");
      expect(html).toContain("1 item");
      expect(html).toContain("0 items");
      expect(html).toContain("1º");
      expect(html).toContain("2º");
    });

    it("deve renderizar EmptyState convidativo quando não houver carrosséis padrão", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={[]}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Nenhum carrossel padrão criado");
      expect(html).toContain("Criar Primeiro Carrossel");
    });

    it("deve respeitar a propriedade hideHeader quando acoplado a abas de Bot", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
          hideHeader={true}
        />
      );

      // Não deve renderizar o PageHeader do topo
      expect(html).not.toContain("Personalize a seção de Ranking Editorial e organize");
      // Mas continua renderizando os carrosséis
      expect(html).toContain("Carrosséis Temáticos da Loja");
    });
  });

  describe("3. Preservação de Regras de Negócio e Dados", () => {
    it("deve exibir corretamente os preços dos produtos vinculados formatados em Real (R$)", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("R$ 97,00");
    });

    it("deve identificar visualmente carrosséis com status Oculto/Inativo", () => {
      const html = renderToStaticMarkup(
        <CarouselsClientV2
          rankingCarousel={mockRankingCarousel}
          standardCarousels={mockStandardCarousels}
          storeProducts={mockStoreProducts}
        />
      );

      expect(html).toContain("Ativo");
      expect(html).toContain("Oculto");
    });
  });
});

