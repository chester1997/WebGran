import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock das dependências de Next e DB
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { mockDb } = vi.hoisted(() => {
  const db: any = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "cat-new", name: "Nova Categoria" }])),
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
      categories: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ value: 3 }])),
      })),
    })),
  };
  return { mockDb: db };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 20 }),
  hasFeature: vi.fn().mockResolvedValue(true),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import SellerCategoriesPage from "../page";
import CategoriesClientV2, {
  CategoryData,
  SerializedProduct,
} from "../CategoriesClientV2";
import CategoriesClient from "../CategoriesClient";

describe("ETAPA 4.8 — REDESIGN V2 DA PÁGINA DE CATEGORIAS (/seller/categories)", () => {
  const OWNER_USER_ID = "ead2ec50-ac72-4917-9d9c-1c68de270070";
  const OWNER_EMAIL = "lf49127@gmail.com";

  const mockStore = {
    id: "store-owner-123",
    name: "Loja Oficial V2",
    slug: "loja-oficial-v2",
    ownerId: OWNER_USER_ID,
    categoryDisplayStyle: "IMAGE",
  };

  const mockCategories: CategoryData[] = [
    {
      id: "cat-1",
      name: "Cursos Online",
      slug: "cursos-online",
      description: "Treinamentos e cursos completos",
      imageUrl: "https://cdn.test/cursos.webp",
      iconName: "Tv",
      status: "active",
      position: 0,
    },
    {
      id: "cat-2",
      name: "E-books e Guias",
      slug: "ebooks-guias",
      description: "Livros digitais e manuais práticos",
      imageUrl: null,
      iconName: "BookOpen",
      status: "active",
      position: 1,
    },
    {
      id: "cat-3",
      name: "Arquivados",
      slug: "arquivados",
      description: "Produtos descontinuados",
      imageUrl: null,
      iconName: "Archive",
      status: "inactive",
      position: 2,
    },
  ];

  const mockSerializedProducts: SerializedProduct[] = [
    { id: "prod-1", title: "Curso de Next.js", price: "97.00", categoryId: "cat-1" },
    { id: "prod-2", title: "Curso de TypeScript", price: "147.00", categoryId: "cat-1" },
    { id: "prod-3", title: "Guia Definitivo de SEO", price: "47.00", categoryId: "cat-2" },
    { id: "prod-4", title: "Produto Avulso Sem Categoria", price: "29.90", categoryId: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);
    vi.mocked(mockDb.query.categories.findMany).mockResolvedValue(mockCategories as any);
    vi.mocked(mockDb.query.products.findMany).mockResolvedValue(mockSerializedProducts as any);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar CategoriesClientV2 exclusivamente para o OWNER_USER_ID com role admin", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: OWNER_USER_ID,
        email: "qualquer@email.com",
        role: "admin",
      } as any);

      const page = await SellerCategoriesPage();
      const html = renderToStaticMarkup(page);

      // Deve conter elementos exclusivos do CategoriesClientV2
      expect(html).toContain("Categorias da Loja");
      expect(html).toContain("Total de Categorias");
      expect(html).toContain("Estilo de Exibição no Mini App");
    });

    it("deve renderizar CategoriesClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "outro-id-admin",
        email: "LF49127@GMAIL.COM", // maiúsculas para testar normalização
        role: "admin",
      } as any);

      const page = await SellerCategoriesPage();
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Categorias da Loja");
      expect(html).toContain("Total de Categorias");
      expect(html).toContain("Estilo de Exibição no Mini App");
    });

    it("NÃO deve renderizar CategoriesClientV2 para admin secundário com outro e-mail (fallback clássico)", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "admin-secundario",
        email: "outro-admin@webgran.com",
        role: "admin",
      } as any);

      const page = await SellerCategoriesPage();
      const html = renderToStaticMarkup(page);

      // Deve renderizar a interface clássica CategoriesClient
      expect(html).toContain("Estilo das Categorias no Mini App");
      expect(html).not.toContain("Categorias da Loja");
      expect(html).not.toContain("Total de Categorias");
    });

    it("deve redirecionar usuário com role diferente de admin/super_admin para /seller", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: "vendedor-regular",
        email: "vendedor@loja.com",
        role: "seller",
      } as any);

      await expect(SellerCategoriesPage()).rejects.toThrow("REDIRECT:/seller");
    });

    it("deve renderizar SetupStoreClient quando o lojista não possui loja cadastrada", async () => {
      vi.mocked(requireSeller).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        role: "admin",
      } as any);
      vi.mocked(getCurrentStore).mockResolvedValue(null);

      const page = await SellerCategoriesPage();
      const html = renderToStaticMarkup(page);

      expect(html).not.toContain("Categorias da Loja");
      expect(html).not.toContain("Total de Categorias");
    });
  });

  describe("2. Renderização do Design System V2 (CategoriesClientV2)", () => {
    it("deve renderizar PageHeader com título, badge de contagem e botão de ação", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Categorias");
      expect(html).toContain("Organize seus produtos em categorias");
      expect(html).toContain("3 categorias");
      expect(html).toContain("Nova Categoria");
    });

    it("deve renderizar os 4 StatCards operacionais com dados reais precisos", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Total de Categorias");
      expect(html).toContain("3");
      expect(html).toContain("Categorias Ativas");
      expect(html).toContain("2"); // cat-1 e cat-2
      expect(html).toContain("Produtos Categorizados");
      expect(html).toContain("3"); // prod-1, prod-2, prod-3
      expect(html).toContain("Estilo no Mini App");
      expect(html).toContain("Imagens (1:1)");
    });

    it("deve renderizar o Card de Configuração de Estilo Visual com opções IMAGE e ICON", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Estilo de Exibição no Mini App");
      expect(html).toContain("Imagens (1:1)");
      expect(html).toContain("Ícones + Nomes");
    });

    it("deve renderizar Toolbar V2 com SearchInput e SegmentedControl", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Buscar por nome ou slug da categoria...");
      expect(html).toContain("Todas");
      expect(html).toContain("Ativas");
      expect(html).toContain("Inativas");
    });

    it("deve renderizar as categorias no modo Grade por padrão com produtos associados", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Cursos Online");
      expect(html).toContain("/cursos-online");
      expect(html).toContain("2 items"); // 2 produtos em cat-1
      expect(html).toContain("Curso de Next.js");
      expect(html).toContain("Curso de TypeScript");

      expect(html).toContain("E-books e Guias");
      expect(html).toContain("/ebooks-guias");
      expect(html).toContain("1 item"); // 1 produto em cat-2

      expect(html).toContain("Arquivados");
      expect(html).toContain("Nenhum produto associado");
    });

    it("deve renderizar EmptyState convidativo quando não houver categorias cadastradas", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={[]}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Nenhuma categoria criada");
      expect(html).toContain("Criar Primeira Categoria");
    });

    it("deve respeitar a propriedade hideHeader quando acoplado a abas de Bot", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
          hideHeader={true}
        />
      );

      expect(html).not.toContain("Organize seus produtos em categorias e personalize a navegação");
      expect(html).toContain("Categorias da Loja");
    });
  });

  describe("3. Preservação de Regras de Negócio e Dados", () => {
    it("deve formatar corretamente os preços dos produtos vinculados em Real (R$)", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("R$ 97,00");
      expect(html).toContain("R$ 147,00");
    });

    it("deve exibir visualmente os chips de status Ativa e Inativa", () => {
      const html = renderToStaticMarkup(
        <CategoriesClientV2
          allCategories={mockCategories}
          serializedProducts={mockSerializedProducts}
          initialStyle="IMAGE"
        />
      );

      expect(html).toContain("Ativa");
      expect(html).toContain("Inativa");
    });
  });
});

