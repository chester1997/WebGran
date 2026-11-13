import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock auth & db
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
  getCurrentUser: vi.fn(),
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
import { POST as deepLinkApiRoute } from "@/app/api/seller/products/deep-link/route";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest } from "next/server";

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

describe("WEBGRAN — Autorização da Conta Proprietária por ID ou E-mail + Admin", () => {
  // =========================================================================
  // 1. TESTES OBRIGATÓRIOS DA REGRA CENTRAL
  // =========================================================================
  describe("1. Regra Central de Identificação e Segurança", () => {
    it("1.1 ID proprietário + role admin: AUTORIZADO", () => {
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: OWNER_USER_ID, role: "admin" })
      ).toBe(true);
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", OWNER_USER_ID)
      ).toBe(true);
    });

    it("1.2 E-mail proprietário + role admin: AUTORIZADO", () => {
      // E-mail idêntico ao OWNER_EMAIL com perfil admin (mesmo com ID omitido ou nulo)
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: OWNER_EMAIL, role: "admin" })
      ).toBe(true);
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: OWNER_EMAIL })
      ).toBe(true);
    });

    it("1.3 E-mail proprietário com role seller: BLOQUEADO", () => {
      // Mesmo com o e-mail do proprietário, perfil de vendedor não recebe autorização
      expect(
        ProductManualDeepLinkService.isAuthorized("seller", { email: OWNER_EMAIL, role: "seller" })
      ).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("SELLER", { email: OWNER_EMAIL, role: "SELLER" })
      ).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("seller", { email: OWNER_EMAIL })
      ).toBe(false);
    });

    it("1.4 Outro e-mail com role admin: BLOQUEADO", () => {
      // Outro administrador não recebe acesso à experiência do proprietário
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: "outro-admin@empresa.com", role: "admin" })
      ).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: "gestor@webgran.app", role: "admin", id: "random-uuid" })
      ).toBe(false);
    });

    it("1.5 ID diferente e e-mail diferente: BLOQUEADO", () => {
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { id: "outro-id-123", email: "outro@dominio.com", role: "admin" })
      ).toBe(false);
      expect(
        ProductManualDeepLinkService.isAuthorized("seller", { id: "outro-id-123", email: "outro@dominio.com", role: "seller" })
      ).toBe(false);
    });

    it("1.6 E-mail com diferenças de maiúsculas ou espaços: AUTORIZADO somente após normalização", () => {
      // E-mail com espaços no início/fim e letras maiúsculas deve bater com trim().toLowerCase()
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: "  LF49127@GMAIL.COM  ", role: "admin" })
      ).toBe(true);
      expect(
        ProductManualDeepLinkService.isAuthorized("admin", { email: "Lf49127@Gmail.Com", role: "admin" })
      ).toBe(true);
    });

    it("1.7 SUPER_ADMIN explícito: AUTORIZADO", () => {
      expect(ProductManualDeepLinkService.isAuthorized("SUPER_ADMIN")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("super_admin")).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized(" SUPER_ADMIN ")).toBe(true);
    });

    it("1.8 Tentativa de enviar e-mail ou ID falso pelo navegador / payload sintético: BLOQUEADA", () => {
      // Objetos contendo flags arbitrárias do cliente são rejeitados
      expect(ProductManualDeepLinkService.isAuthorized("seller", { isOwner: true } as any)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { isOwner: true } as any)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized(null, { isOwner: true } as any)).toBe(false);

      const res = ProductManualDeepLinkService.generateDeepLink({
        productId: "prod-1",
        botUsername: "bot",
        userRole: "seller",
        user: { id: "fake-id", email: "fake@gmail.com", role: "seller" },
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("exclusiva para SUPER_ADMIN");
    });
  });

  // =========================================================================
  // 2. SEGURANÇA NA API DE DEEP LINK
  // =========================================================================
  describe("2. Deep Link Validado Exclusivamente com Dados da Sessão do Servidor", () => {
    it("2.1 API de Deep Link autoriza proprietário por e-mail + role admin via getCurrentUser()", async () => {
      (getCurrentUser as any).mockResolvedValue({
        id: "session-uuid",
        email: OWNER_EMAIL,
        role: "admin",
      });

      const req = new NextRequest("https://www.webgran.online/api/seller/products/deep-link", {
        method: "POST",
        body: JSON.stringify({ productId: "prod-123", botUsername: "studiioshorts_bot" }),
      });

      const res = await deepLinkApiRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deepLink).toContain("product_prod-123");
    });

    it("2.2 API de Deep Link bloqueia outro admin que tente forjar requisição", async () => {
      (getCurrentUser as any).mockResolvedValue({
        id: "admin-2",
        email: "outro-admin@webgran.app",
        role: "admin",
      });

      const req = new NextRequest("https://www.webgran.online/api/seller/products/deep-link", {
        method: "POST",
        body: JSON.stringify({
          productId: "prod-123",
          botUsername: "studiioshorts_bot",
          email: OWNER_EMAIL,
          userId: OWNER_USER_ID,
          isOwner: true,
        }),
      });

      const res = await deepLinkApiRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("exclusiva para SUPER_ADMIN");
    });
  });

  // =========================================================================
  // 3. EXPERIÊNCIA DA INTERFACE EXPERIMENTAL DO PROPRIETÁRIO
  // =========================================================================
  describe("3. Renderização do Modal Experimental para o Proprietário", () => {
    it("3.1 Conta proprietária com isOwnerAccount=true: exibe cabeçalho experimental e DeliveryChoiceModal", () => {
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

      // Cabeçalho experimental
      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("2 produtos");
      expect(html).toContain("text-zinc-400 font-normal tabular-nums");

      // Botão reto experimental
      expect(html).toContain("h-10 px-4 sm:px-5 rounded-lg bg-blue-600");

      // Modal de escolha de entrega presente no DOM
      expect(html).toContain("COMO DESEJA ENTREGAR");
      expect(html).toContain("Grupo / Canal Telegram");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo do Produto");
    });

    it("3.2 Conta proprietária com catálogo vazio: botão do estado vazio abre DeliveryChoiceModal", () => {
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

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("COMO DESEJA ENTREGAR");
    });

    it("3.3 Cards de produtos não exibem botão Deep Link, mantendo exclusivamente Editar e Excluir", () => {
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

      // Ação de excluir presente
      expect(html).toContain("Excluir");

      // Botão Deep Link estritamente ausente dos cards
      expect(html).not.toContain("Copiar Deep Link do Telegram");
      expect(html).not.toContain(">Deep Link<");
    });
  });

  // =========================================================================
  // 4. EXPERIÊNCIA CLÁSSICA PARA DEMAIS USUÁRIOS
  // =========================================================================
  describe("4. Renderização Clássica para os Demais Usuários", () => {
    it("4.1 Lojista comum (role SELLER): recebe cabeçalho clássico 'Produtos' e abre NewProductModal diretamente", () => {
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

      // Cabeçalho clássico restaurado
      expect(html).toContain("Produtos");
      expect(html).toContain("rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).toContain("Novo Produto");

      // DeliveryChoiceModal estritamente omitido do DOM
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
      expect(html).not.toContain("Grupo / Canal Telegram");
    });

    it("4.2 Outro admin (não proprietário): recebe versão clássica de lojista", () => {
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

      expect(html).toContain("Produtos");
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
    });

    it("4.3 Lojista com catálogo vazio: abre formulário clássico NewProductModal", () => {
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

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
    });
  });

  // =========================================================================
  // 5. ABA PRODUTOS DO MÓDULO BOTS (/seller/bots/[botId]?tab=produtos)
  // =========================================================================
  describe("5. Aba Produtos no Módulo Bots (/seller/bots/[botId]?tab=produtos)", () => {
    it("5.1 Proprietário na aba Produtos do bot: exibe botão experimental e monta DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={true}
          carousels={mockCarousels}
          hideHeader={true}
        />
      );

      // 1. Título do sub-cabeçalho da aba de bots
      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("2 produtos");

      // 2. Botão experimental com cantos retos (rounded-lg) que abre o modal de entrega
      expect(html).toContain("Novo Produto");

      // 3. DeliveryChoiceModal DEVE EXISTIR no DOM
      expect(html).toContain("COMO DESEJA ENTREGAR");
      expect(html).toContain("Grupo / Canal Telegram");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo do Produto");
    });

    it("5.2 Proprietário na aba Produtos do bot com catálogo vazio: botão do estado vazio abre DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={[]}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={true}
          carousels={mockCarousels}
          hideHeader={true}
        />
      );

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("Cadastre seu primeiro produto");

      // DeliveryChoiceModal DEVE estar no DOM para o proprietário mesmo com 0 produtos
      expect(html).toContain("COMO DESEJA ENTREGAR");
      expect(html).toContain("Grupo / Canal Telegram");
    });

    it("5.3 Outro ADMIN na aba Produtos do bot: recebe sub-cabeçalho clássico e abre NewProductModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="admin"
          isOwnerAccount={false}
          carousels={mockCarousels}
          hideHeader={true}
        />
      );

      // Sub-cabeçalho clássico com badge azul
      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).toContain("Novo Produto");

      // DeliveryChoiceModal NÃO pode estar no DOM
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
      expect(html).not.toContain("Grupo / Canal Telegram");
    });

    it("5.4 Lojista comum (SELLER) na aba Produtos do bot: recebe versão clássica sem DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={mockProducts as any}
          categories={mockCategories}
          bots={mockBots}
          userRole="SELLER"
          isOwnerAccount={false}
          carousels={mockCarousels}
          hideHeader={true}
        />
      );

      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
    });

    it("5.5 Lojista comum com catálogo vazio na aba Produtos: botão vazio abre NewProductModal clássico", () => {
      const html = renderToStaticMarkup(
        <ProductsListClient
          storeName="Loja Teste"
          products={[]}
          categories={mockCategories}
          bots={mockBots}
          userRole="SELLER"
          isOwnerAccount={false}
          carousels={mockCarousels}
          hideHeader={true}
        />
      );

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).not.toContain("COMO DESEJA ENTREGAR");
    });
  });
});
