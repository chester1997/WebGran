import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock auth & db
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      products: { findFirst: vi.fn(), findMany: vi.fn() },
      telegramBots: { findFirst: vi.fn(), findMany: vi.fn() },
      categories: { findMany: vi.fn() },
      productCarousels: { findMany: vi.fn() },
    },
  },
}));

vi.mock("../actions", () => ({
  deleteProductAction: vi.fn(),
  createProductAction: vi.fn(),
  testTelegramChatAccessAction: vi.fn(),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ProductsListClient from "../ProductsListClient";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";

// Mock do useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock do SellerPageHeader para inspecionar as props passadas
vi.mock("@/components/layout/SellerPageHeader", () => ({
  default: ({ title, subtitle, badge, actions }: any) => (
    <header data-testid="mock-seller-page-header">
      <div data-testid="header-title">{title}</div>
      <div data-testid="header-badge">{badge}</div>
      <div data-testid="header-subtitle">{subtitle}</div>
      <div data-testid="header-actions">{actions}</div>
    </header>
  ),
}));

// Mock do DeliveryChoiceModal para validação de montagem no DOM
vi.mock("../DeliveryChoiceModal", () => ({
  DeliveryChoiceModal: ({ isOpen }: any) => (
    <div data-testid="mock-delivery-choice-modal" data-is-open={String(isOpen)}>
      COMO DESEJA ENTREGAR (Grupo / Canal Telegram, Link externo, Vídeo do Produto)
    </div>
  ),
}));

// Mock do EditProductModal
vi.mock("../EditProductModal", () => ({
  EditProductModal: () => <div data-testid="mock-edit-modal" />,
}));

const mockCategories = [
  { id: "cat-1", name: "Cursos" },
  { id: "cat-2", name: "VIP" },
];

const mockBots = [
  { id: "bot-1", username: "test_bot", displayName: "Bot de Testes" },
];

const mockCarousels = [
  { id: "car-1", name: "Destaques" },
];

const mockProducts = [
  {
    id: "prod-1",
    title: "Produto Alpha",
    slug: "produto-alpha",
    price: "49.90",
    status: "active",
    catalogScope: "STORE_GENERAL",
    sharingMode: "EXCLUSIVE",
  },
  {
    id: "prod-2",
    title: "Produto Beta",
    slug: "produto-beta",
    price: "99.00",
    status: "active",
    catalogScope: "BOT_SPECIFIC",
    sharingMode: "EXCLUSIVE",
    botId: "bot-1",
  },
];

describe("Isolamento Estrito da Interface Experimental do Catálogo (SUPER_ADMIN vs Lojistas Comuns)", () => {
  // =========================================================================
  // 1. REGRA DE IDENTIFICAÇÃO DO SUPER_ADMIN
  // =========================================================================
  describe("1. Identificação de Perfil via ProductManualDeepLinkService", () => {
    it("Autoriza exclusivamente perfil SUPER_ADMIN", () => {
      expect(ProductManualDeepLinkService.isAuthorized("SUPER_ADMIN")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("super_admin")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized(" SUPER_ADMIN ")).toBe(true);

      // Bloqueia qualquer outro perfil
      expect(ProductManualDeepLinkService.isAuthorized("SELLER")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("ADMIN")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("USER")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(null)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(undefined)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("")).toBe(false);
    });
  });

  // =========================================================================
  // 2. EXPERIÊNCIA DO SUPER_ADMIN (VERSÃO NOVA / EXPERIMENTAL)
  // =========================================================================
  describe("2. SUPER_ADMIN — Nova Versão Experimental Ativa", () => {
    it("SUPER_ADMIN: renderiza cabeçalho novo, contador discreto e botão experimental", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="SUPER_ADMIN"
          carousels={mockCarousels}
        />
      );

      // 1. Título novo no cabeçalho
      expect(html).toContain("Catálogo de Produtos");

      // 2. Contador de produtos discreto (sem badge pill estilizado bg-[#3984FF]/10)
      expect(html).toContain("2 produtos");
      expect(html).toContain("text-zinc-400 font-normal tabular-nums");

      // 3. Renderiza o modal DeliveryChoiceModal no DOM exclusivo para SUPER_ADMIN
      expect(html).toContain("COMO DESEJA ENTREGAR");
      expect(html).toContain("Grupo / Canal Telegram");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo do Produto");

      // 4. No cabeçalho, o botão de ação NÃO renderiza o NewProductModal diretamente
      // Em vez disso, é o botão experimental com estilo novo que aciona o DeliveryChoiceModal
      expect(html).toContain("h-10 px-4 sm:px-5 rounded-lg bg-blue-600");
    });

    it("SUPER_ADMIN com catálogo vazio: botão do estado vazio também respeita o fluxo experimental", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={[]}
          categories={mockCategories}
          bots={mockBots}
          userRole="SUPER_ADMIN"
          carousels={mockCarousels}
        />
      );

      // Empty state com botão experimental
      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("Cadastre seu primeiro produto");
      // DeliveryChoiceModal presente no DOM
      expect(html).toContain("COMO DESEJA ENTREGAR");
    });
  });

  // =========================================================================
  // 3. EXPERIÊNCIA DO LOJISTA COMUM (VERSÃO ANTERIOR RESTAURADA)
  // =========================================================================
  describe("3. LOJISTA COMUM — Versão Anterior 100% Restaurada (Commit 3791f51)", () => {
    it("Lojista comum (role SELLER): renderiza cabeçalho clássico 'Produtos' com badge azul", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="SELLER"
          carousels={mockCarousels}
        />
      );

      // 1. Título clássico da versão 3791f51
      expect(html).toContain("Produtos");

      // 2. Badge pill estilizado anterior com fundo azul e borda
      expect(html).toContain("rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).toContain("2 produtos");

      // 3. Botão abre DIRETAMENTE o NewProductModal clássico
      // O NewProductModal renderiza seu DialogTrigger clássico
      expect(html).toContain("Novo Produto");

      // 4. CRÍTICO: DeliveryChoiceModal NÃO PODE EXISTIR no DOM do lojista comum
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
      expect(html).not.toContain("delivery-modal-title");
      expect(html).not.toContain("Grupo / Canal Telegram");
    });

    it("Lojista com catálogo vazio (role SELLER): botão do estado vazio renderiza NewProductModal anterior", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={[]}
          categories={mockCategories}
          bots={mockBots}
          userRole="SELLER"
          carousels={mockCarousels}
        />
      );

      // Estado vazio
      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("Cadastre seu primeiro produto");

      // DeliveryChoiceModal NÃO está no DOM
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
      expect(html).not.toContain("delivery-modal-title");
    });

    it("Usuário com userRole nulo ou indefinido: recebe obrigatoriamente a versão clássica do lojista", () => {
      const htmlNull = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole={null}
          carousels={mockCarousels}
        />
      );

      expect(htmlNull).toContain("Produtos");
      expect(htmlNull).toContain("bg-[#3984FF]/10 text-[#3984FF]");
      expect(htmlNull).not.toContain("COMO DESEJA ENTREGAR");

      const htmlUndefined = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole={undefined}
          carousels={mockCarousels}
        />
      );

      expect(htmlUndefined).toContain("Produtos");
      expect(htmlUndefined).toContain("bg-[#3984FF]/10 text-[#3984FF]");
      expect(htmlUndefined).not.toContain("COMO DESEJA ENTREGAR");
    });
  });
});
