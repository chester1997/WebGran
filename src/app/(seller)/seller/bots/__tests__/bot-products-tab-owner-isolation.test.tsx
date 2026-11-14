import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock auth & db
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: { findFirst: vi.fn(), findMany: vi.fn() },
      telegramCustomers: { findMany: vi.fn() },
      telegramMessages: { findMany: vi.fn() },
      botStartEvents: { findMany: vi.fn().mockResolvedValue([]) },
      orders: { findMany: vi.fn() },
      productBotVisibility: { findMany: vi.fn() },
      products: { findMany: vi.fn() },
      categories: { findMany: vi.fn() },
      productCarousels: { findMany: vi.fn() },
      carouselProducts: { findMany: vi.fn() },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../actions", () => ({
  toggleBotStatusAction: vi.fn(),
  renameBotAction: vi.fn(),
  updateBotTokenAction: vi.fn(),
  deleteBotAction: vi.fn(),
}));

vi.mock("@/app/(seller)/seller/products/v2/NewProductFlowV2", () => ({
  NewProductFlowV2: ({ isOpen }: any) => (
    <div data-testid="mock-new-product-flow-v2" data-is-open={String(isOpen)}>
      NOVO PRODUTO · PASSO 1 DE 2 (Como deseja entregar?, Grupo ou canal, Link externo, Vídeo do produto)
    </div>
  ),
}));


import SingleBotClient from "../[id]/SingleBotClient";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const mockBot = {
  id: "bot-123",
  botId: "987654321",
  username: "studiioshorts_bot",
  displayName: "STUDIO SHORTS",
  photoUrl: null,
  buttonText: "Abrir App",
  status: "active" as const,
  createdAt: "2026-11-01T00:00:00Z",
  mode: "MINI_APP" as const,
  storeSlug: "minha-loja",
  storeName: "Minha Loja",
  chatsCount: 1,
  recipientsCount: 1,
};

const mockProductsData = {
  products: [
    {
      id: "prod-1",
      title: "VIP Vitalício Canal",
      slug: "vip-vitalicio-canal",
      price: "47.00",
      status: "active",
      catalogScope: "STORE_GENERAL",
      sharingMode: "EXCLUSIVE",
      coverUrl: null,
      shortDescription: "Acesso total ao canal",
      duration: "lifetime",
      category: { id: "cat-1", name: "Canais VIP" },
    },
  ],
  categories: [{ id: "cat-1", name: "Canais VIP" }],
  bots: [{ id: "bot-123", username: "studiioshorts_bot", displayName: "STUDIO SHORTS" }],
  carousels: [],
};

describe("WEBGRAN — Aba Produtos no Módulo Bots (/seller/bots/[botId]?tab=produtos)", () => {
  describe("1. Identificação da Conta Proprietária no Módulo Bots", () => {
    it("1.1 Proprietário identificado por role 'admin' e OWNER_EMAIL: autoriza isOwnerAccount", () => {
      const authorized = ProductManualDeepLinkService.isAuthorized("admin", {
        email: OWNER_EMAIL,
        role: "admin",
      });
      expect(authorized).toBe(true);
    });

    it("1.2 Proprietário identificado por OWNER_USER_ID: autoriza isOwnerAccount", () => {
      const authorized = ProductManualDeepLinkService.isAuthorized("admin", {
        id: OWNER_USER_ID,
      });
      expect(authorized).toBe(true);
    });

    it("1.3 Outro administrador com e-mail diferente: BLOQUEADO (isOwnerAccount=false)", () => {
      const authorized = ProductManualDeepLinkService.isAuthorized("admin", {
        email: "outro-admin@webgran.app",
        role: "admin",
      });
      expect(authorized).toBe(false);
    });

    it("1.4 Vendedor comum (role 'seller'): BLOQUEADO (isOwnerAccount=false)", () => {
      const authorized = ProductManualDeepLinkService.isAuthorized("seller", {
        email: OWNER_EMAIL,
        role: "seller",
      });
      expect(authorized).toBe(false);
    });
  });

  describe("2. Renderização de SingleBotClient na aba Produtos", () => {
    it("2.1 Proprietário (isOwnerAccount=true): renderiza botão experimental e monta DeliveryChoiceModal", () => {
      const html = renderToStaticMarkup(
        <SingleBotClient
          bot={mockBot}
          storeSlug="minha-loja"
          initialTab="produtos"
          initialOrders={[]}
          initialCustomers={[]}
          tabData={{ productsData: mockProductsData }}
          userRole="admin"
          isAdmin={true}
          isOwnerAccount={true}
        />
      );

      // Deve renderizar a aba produtos
      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("VIP Vitalício Canal");
      expect(html).toContain("Novo Produto");

      // CRÍTICO: NewProductFlowV2 DEVE estar presente no DOM com todas as opções
      expect(html).toContain("NOVO PRODUTO · PASSO 1 DE 2");
      expect(html).toContain("Como deseja entregar?");
      expect(html).toContain("Grupo ou canal");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo do produto");

      // CRÍTICO: Cards de produtos NÃO devem exibir botão Deep Link
      expect(html).not.toContain("Copiar Deep Link do Telegram");
      expect(html).not.toContain(">Deep Link<");
      expect(html).toContain("Excluir");
    });

    it("2.2 Proprietário com catálogo vazio: botão do estado vazio abre NewProductFlowV2", () => {
      const emptyProductsData = {
        ...mockProductsData,
        products: [],
      };

      const html = renderToStaticMarkup(
        <SingleBotClient
          bot={mockBot}
          storeSlug="minha-loja"
          initialTab="produtos"
          initialOrders={[]}
          initialCustomers={[]}
          tabData={{ productsData: emptyProductsData }}
          userRole="admin"
          isAdmin={true}
          isOwnerAccount={true}
        />
      );

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).toContain("Cadastre seu primeiro produto");

      // NewProductFlowV2 DEVE estar montado
      expect(html).toContain("NOVO PRODUTO · PASSO 1 DE 2");
      expect(html).toContain("Como deseja entregar?");
    });

    it("2.3 Outro ADMIN (isOwnerAccount=false): renderiza versão clássica com NewProductModal e SEM NewProductFlowV2", () => {
      const html = renderToStaticMarkup(
        <SingleBotClient
          bot={mockBot}
          storeSlug="minha-loja"
          initialTab="produtos"
          initialOrders={[]}
          initialCustomers={[]}
          tabData={{ productsData: mockProductsData }}
          userRole="admin"
          isAdmin={true}
          isOwnerAccount={false}
        />
      );

      // Deve renderizar o sub-cabeçalho clássico com badge azul
      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).toContain("Novo Produto");

      // CRÍTICO: NewProductFlowV2 NÃO pode estar no DOM
      expect(html).not.toContain("NOVO PRODUTO · PASSO 1 DE 2");
      expect(html).not.toContain("Como deseja entregar?");
      expect(html).not.toContain("Grupo ou canal");
    });

    it("2.4 Lojista comum (role 'seller', isOwnerAccount=false): renderiza versão clássica", () => {
      const html = renderToStaticMarkup(
        <SingleBotClient
          bot={mockBot}
          storeSlug="minha-loja"
          initialTab="produtos"
          initialOrders={[]}
          initialCustomers={[]}
          tabData={{ productsData: mockProductsData }}
          userRole="seller"
          isAdmin={false}
          isOwnerAccount={false}
        />
      );

      expect(html).toContain("Catálogo de Produtos");
      expect(html).toContain("bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25");
      expect(html).not.toContain("NOVO PRODUTO · PASSO 1 DE 2");
    });

    it("2.5 Lojista comum com catálogo vazio: botão vazio abre NewProductModal clássico", () => {
      const emptyProductsData = {
        ...mockProductsData,
        products: [],
      };

      const html = renderToStaticMarkup(
        <SingleBotClient
          bot={mockBot}
          storeSlug="minha-loja"
          initialTab="produtos"
          initialOrders={[]}
          initialCustomers={[]}
          tabData={{ productsData: emptyProductsData }}
          userRole="seller"
          isAdmin={false}
          isOwnerAccount={false}
        />
      );

      expect(html).toContain("Nenhum produto encontrado");
      expect(html).not.toContain("NOVO PRODUTO · PASSO 1 DE 2");
    });

  });
});
