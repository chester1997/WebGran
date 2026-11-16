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

vi.mock("@/db", () => ({
  db: {
    query: {
      products: { findMany: vi.fn() },
      categories: { findMany: vi.fn() },
      telegramBots: { findMany: vi.fn() },
      productCarousels: { findMany: vi.fn() },
      carouselProducts: { findMany: vi.fn() },
    },
  },
}));

vi.mock("../actions", () => ({
  deleteProductAction: vi.fn().mockResolvedValue({ success: true }),
  createProductAction: vi.fn(),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import SellerProductsPage from "../page";
import ProductsListClientV2 from "../ProductsListClientV2";
import ProductsListClient from "../ProductsListClient";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_BOTS = [
  { id: "bot-1", username: "bot1_bot", displayName: "Bot Alfa", photoUrl: null },
  { id: "bot-2", username: "bot2_bot", displayName: "Bot Beta", photoUrl: null },
];

const MOCK_CATEGORIES = [
  { id: "cat-1", name: "Cursos" },
  { id: "cat-2", name: "VIPs" },
];

const MOCK_PRODUCTS = [
  {
    id: "prod-1",
    title: "Produto Telegram VIP",
    slug: "produto-telegram-vip",
    shortDescription: "Acesso vitalício ao canal VIP",
    description: "Descrição completa do produto VIP",
    price: "97.00",
    compareAtPrice: "197.00",
    coverUrl: "https://example.com/cover1.jpg",
    bannerUrl: null,
    duration: "lifetime",
    badge: "novo",
    status: "active",
    deliveryType: "telegram",
    deliveryValue: "-100123456789",
    botId: "bot-1",
    catalogScope: "BOT_SPECIFIC",
    sharingMode: "ALL_EXISTING",
    canDeliverInCurrentBot: true,
    categoryId: "cat-2",
    category: { id: "cat-2", name: "VIPs" },
    carouselIds: [],
    botVisibilities: [
      { botId: "bot-1", canDeliver: true, deliveryBlockReason: null },
      { botId: "bot-2", canDeliver: true, deliveryBlockReason: null },
    ],
  },
  {
    id: "prod-2",
    title: "Produto Link Externo",
    slug: "produto-link-externo",
    shortDescription: "Acesso à área de membros",
    description: "Link direto para o portal externo",
    price: "47.50",
    compareAtPrice: null,
    coverUrl: null,
    bannerUrl: null,
    duration: "monthly",
    badge: null,
    status: "draft",
    deliveryType: "external_link",
    deliveryValue: "https://cursospages.com",
    botId: null,
    catalogScope: "STORE_GENERAL",
    sharingMode: "NONE",
    canDeliverInCurrentBot: true,
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Cursos" },
    carouselIds: [],
    botVisibilities: [],
  },
  {
    id: "prod-3",
    title: "Produto Vídeo Bot Geral",
    slug: "produto-video-bot-geral",
    shortDescription: "Vídeo exclusivo de onboarding",
    description: "Vídeo streaming no Telegram",
    price: "15.00",
    compareAtPrice: null,
    coverUrl: null,
    bannerUrl: null,
    duration: "lifetime",
    badge: null,
    status: "active",
    deliveryType: "video",
    deliveryValue: "video-id-123",
    botId: null,
    catalogScope: "BOT_GENERAL",
    sharingMode: "NONE",
    canDeliverInCurrentBot: true,
    categoryId: null,
    category: null,
    carouselIds: [],
    botVisibilities: [],
  },
];

describe("ETAPA 4.1 — REDESIGN V2 DA PÁGINA DE PRODUTOS (/seller/products)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-test-1",
      name: "Loja Teste V2",
    });

    (db.query.products.findMany as any).mockResolvedValue(MOCK_PRODUCTS);
    (db.query.categories.findMany as any).mockResolvedValue(MOCK_CATEGORIES);
    (db.query.telegramBots.findMany as any).mockResolvedValue(MOCK_BOTS);
    (db.query.productCarousels.findMany as any).mockResolvedValue([]);
    (db.query.carouselProducts.findMany as any).mockResolvedValue([]);
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar ProductsListClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await SellerProductsPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Produtos");
      expect(html).toContain("Total de Produtos");
      expect(html).toContain("Multi-Bot / Específicos");
      expect(html).toContain("Novo produto");
    });

    it("deve renderizar ProductsListClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await SellerProductsPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Produtos");
      expect(html).toContain("Total de Produtos");
    });

    it("NÃO deve renderizar ProductsListClientV2 para outro admin com e-mail diferente", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await SellerProductsPage();
      const html = renderToStaticMarkup(jsx);

      // Deve renderizar a versão clássica ProductsListClient
      expect(html).not.toContain("Multi-Bot / Específicos");
      expect(html).not.toContain("Gerencie o catálogo e a visibilidade dos produtos no seu Mini App");
      expect(html).toContain('placeholder="Buscar em 3 produtos..."');
    });

    it("NÃO deve renderizar ProductsListClientV2 para vendedor comum", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await SellerProductsPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("Multi-Bot / Específicos");
      expect(html).not.toContain("Gerencie o catálogo e a visibilidade dos produtos no seu Mini App");
      expect(html).toContain('placeholder="Buscar em 3 produtos..."');
    });
  });

  describe("2. Renderização do Design System V2 em ProductsListClientV2", () => {
    it("renderiza PageHeader com título, contadores e botão 'Novo produto'", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      expect(html).toContain("Produtos");
      expect(html).toContain("3 produtos");
      expect(html).toContain("Novo produto");
      expect(html).toContain("Gerencie o catálogo e a visibilidade dos produtos");
    });

    it("renderiza os 4 StatCards com valores corretos", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      // Total: 3
      expect(html).toContain("Total de Produtos");
      expect(html).toContain("3");

      // Ativos: 2 (prod-1 e prod-3)
      expect(html).toContain("Produtos Ativos");
      expect(html).toContain("2");

      // Inativos: 1 (prod-2)
      expect(html).toContain("Produtos Inativos");
      expect(html).toContain("1");

      // Multi-Bot / Específicos: 1 (prod-1)
      expect(html).toContain("Multi-Bot / Específicos");
    });

    it("renderiza Toolbar com campo de busca e seletores de filtros", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      expect(html).toContain('placeholder="Buscar em 3 produtos por título ou descrição..."');
      expect(html).toContain("Todas as Categorias");
      expect(html).toContain("Todos os Status");
      expect(html).toContain("Todos os Escopos / Bots");
      expect(html).toContain("Loja Geral (Web)");
      expect(html).toContain("Bot Geral (Todos os Bots)");
    });

    it("renderiza cards com preços formatados em moeda (R$ XX,XX) e badges de entrega", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      // Preços
      expect(html).toContain("R$ 97,00");
      expect(html).toContain("R$ 197,00"); // De/por
      expect(html).toContain("R$ 47,50");
      expect(html).toContain("R$ 15,00");

      // Badges de entrega
      expect(html).toContain("Telegram");
      expect(html).toContain("Link externo");
      expect(html).toContain("Vídeo");
    });

    it("renderiza badges de escopo de catálogo e Multi-Bot corretamente", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      // Prod 1: Multi-bot (2 bots associados e Compartilhado)
      expect(html).toContain("2 bots associados");
      expect(html).toContain("Compartilhado");

      // Prod 2: Loja Geral
      expect(html).toContain("Loja Geral");

      // Prod 3: Bot Geral
      expect(html).toContain("Todos os Bots");
    });

    it("renderiza EmptyState quando não há produtos cadastrados", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={[]}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      expect(html).toContain("Nenhum produto cadastrado");
      expect(html).toContain("Cadastre seu primeiro produto para começar a vender");
    });

    it("integra os modais NewProductFlowV2 e ConfirmDialog", () => {
      const html = renderToStaticMarkup(
        <ProductsListClientV2
          storeName="Loja Teste V2"
          products={MOCK_PRODUCTS}
          categories={MOCK_CATEGORIES}
          bots={MOCK_BOTS}
          isOwnerAccount={true}
        />
      );

      // Botão Novo produto que dispara o NewProductFlowV2
      expect(html).toContain("Novo produto");

      // EditProductModalV2 renderiza o botão "Editar"
      expect(html).toContain("Editar");
    });
  });
});
