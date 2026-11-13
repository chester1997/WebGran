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
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

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

describe("Isolamento Estrito da Interface Experimental do Catálogo (Conta Proprietária vs Demais Lojistas e Admins)", () => {
  // =========================================================================
  // 1. REGRA DE IDENTIFICAÇÃO DA CONTA PROPRIETÁRIA E SUPER_ADMIN
  // =========================================================================
  describe("1. Identificação de Perfil via ProductManualDeepLinkService", () => {
    it("SUPER_ADMIN explícito: autorizado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("SUPER_ADMIN")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("super_admin")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized(" SUPER_ADMIN ")).toBe(true);
    });

    it("ID correto do proprietário (OWNER_USER_ID): autorizado mesmo com role 'admin'", () => {
      // 1. ID passado como string
      expect(ProductManualDeepLinkService.isAuthorized("admin", OWNER_USER_ID)).toBe(true);

      // 2. ID passado em objeto de usuário com role 'admin'
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: OWNER_USER_ID, email: OWNER_EMAIL })
      ).toBe(true);

      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: OWNER_USER_ID })
      ).toBe(true);
    });

    it("E-mail correto, mas ID diferente: estritamente BLOQUEADO", () => {
      // Tentativa de acesso com email do proprietário mas id divergente
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: "outro-id-falso", email: OWNER_EMAIL })
      ).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("seller", { id: "outro-id-falso", email: OWNER_EMAIL })
      ).toBe(false);
    });

    it("Outro ADMIN (não proprietário): estritamente BLOQUEADO", () => {
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: "admin-secundario-id", email: "secundario@empresa.com" })
      ).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("ADMIN")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", "outro-id-qualquer")).toBe(false);
    });

    it("SELLER: estritamente BLOQUEADO", () => {
      expect(ProductManualDeepLinkService.isAuthorized("SELLER")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller")).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("seller", { id: "lojista-1", email: "lojista@webgran.app" })
      ).toBe(false);
    });

    it("Usuário sem identificação ou sem perfil válido: estritamente BLOQUEADO", () => {
      expect(ProductManualDeepLinkService.isAuthorized(null)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(undefined)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("USER")).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(null, null)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(undefined, undefined)).toBe(false);
    });

    it("isOwner: true enviado isoladamente ou forjado no cliente: estritamente NÃO concede autorização", () => {
      // 1. isAuthorized com booleano ou objeto arbitrário sem ID válido
      expect(ProductManualDeepLinkService.isAuthorized("SELLER", { isOwner: true } as any)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { isOwner: true } as any)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(null, { isOwner: true } as any)).toBe(false);

      // 2. generateDeepLink rejeita qualquer tentativa de bypass com isOwner: true
      const res = ProductManualDeepLinkService.generateDeepLink({
        productId: "prod-hack",
        botUsername: "testbot",
        userRole: "SELLER",
        userId: "hacker-123",
        ...({ isOwner: true } as any),
      } as any);

      expect(res.success).toBe(false);
      expect(res.error).toContain("exclusiva para SUPER_ADMIN");
    });
  });

  // =========================================================================
  // 2. EXPERIÊNCIA DA CONTA PROPRIETÁRIA (MODAL EXPERIMENTAL ATIVO)
  // =========================================================================
  describe("2. Conta Proprietária — Nova Versão Experimental Ativa", () => {
    it("Proprietário com role 'admin' e isOwnerAccount=true: renderiza cabeçalho novo, contador discreto e DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={true}
          carousels={mockCarousels}
        />
      );

      // 1. Título novo no cabeçalho
      expect(html).toContain("Catálogo de Produtos");

      // 2. Contador de produtos discreto (sem badge pill estilizado bg-[#3984FF]/10)
      expect(html).toContain("2 produtos");
      expect(html).toContain("text-zinc-400 font-normal tabular-nums");

      // 3. Renderiza o modal DeliveryChoiceModal no DOM exclusivo para a conta proprietária
      expect(html).toContain("COMO DESEJA ENTREGAR");
      expect(html).toContain("Grupo / Canal Telegram");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo do Produto");

      // 4. Botão experimental com cantos retos
      expect(html).toContain("h-10 px-4 sm:px-5 rounded-lg bg-blue-600");
    });

    it("Proprietário com catálogo vazio: botão do estado vazio respeita o fluxo experimental", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={[]}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={true}
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
  // 3. EXPERIÊNCIA DE OUTROS ADMINISTRADORES (NÃO PROPRIETÁRIOS)
  // =========================================================================
  describe("3. Administradores Comuns (Não Proprietários) — Mantidos na Versão Clássica", () => {
    it("Admin secundário (role 'admin', isOwnerAccount=false): recebe cabeçalho clássico e NÃO recebe DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={false}
          carousels={mockCarousels}
        />
      );

      // 1. Título clássico
      expect(html).toContain("Produtos");

      // 2. Badge pill estilizado clássico
      expect(html).toContain("rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");

      // 3. Botão abre NewProductModal diretamente
      expect(html).toContain("Novo Produto");

      // 4. DeliveryChoiceModal NÃO PODE EXISTIR no DOM
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
      expect(html).not.toContain("Grupo / Canal Telegram");
    });
  });

  // =========================================================================
  // 4. EXPERIÊNCIA DO LOJISTA COMUM (VERSÃO ANTERIOR RESTAURADA)
  // =========================================================================
  describe("4. LOJISTA COMUM — Versão Anterior 100% Restaurada", () => {
    it("Lojista comum (role SELLER): renderiza cabeçalho clássico 'Produtos' com badge azul", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="SELLER"
          isOwnerAccount={false}
          carousels={mockCarousels}
        />
      );

      // 1. Título clássico da versão 3791f51
      expect(html).toContain("Produtos");

      // 2. Badge pill estilizado anterior com fundo azul e borda
      expect(html).toContain("rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).toContain("2 produtos");

      // 3. Botão abre DIRETAMENTE o NewProductModal clássico
      expect(html).toContain("Novo Produto");

      // 4. CRÍTICO: DeliveryChoiceModal NÃO PODE EXISTIR no DOM do lojista comum
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
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
          isOwnerAccount={false}
          carousels={mockCarousels}
        />
      );

      // Estado vazio
      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("Cadastre seu primeiro produto");

      // DeliveryChoiceModal NÃO está no DOM
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
    });

    it("Usuário com userRole nulo ou indefinido: recebe obrigatoriamente a versão clássica do lojista", () => {
      const htmlNull = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole={null}
          isOwnerAccount={false}
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
          isOwnerAccount={false}
          carousels={mockCarousels}
        />
      );

      expect(htmlUndefined).toContain("Produtos");
      expect(htmlUndefined).toContain("bg-[#3984FF]/10 text-[#3984FF]");
      expect(htmlUndefined).not.toContain("COMO DESEJA ENTREGAR");
    });
  });
});
