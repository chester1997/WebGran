import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OWNER_EMAIL, OWNER_USER_ID, isOwnerUser } from "@/lib/bots/owner-guard";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { BotPicker } from "../v2/BotPicker";
import { ProductDetailsStep } from "../v2/ProductDetailsStep";
import { INITIAL_FORM_STATE, NewProductFormStateV2 } from "../v2/types";
import { createProductAction } from "../actions";

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => {
  const mockDb: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ count: 0 }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "prod-new-123", slug: "prod-slug" }])),
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
    transaction: vi.fn(async (cb: any) => cb(mockDb)),
    query: {
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      productBotVisibility: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      productVideos: {
        findFirst: vi.fn(),
      },
      productVideoAssignments: {
        findFirst: vi.fn(),
      },
      productCarousels: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
      carouselProducts: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
  };
  return { db: mockDb };
});

// Mock entitlements
vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn(() => Promise.resolve({ allowed: true, limit: 100 })),
}));

// Mock video service
vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    listProductVideos: vi.fn(),
    assignVideosToProduct: vi.fn(),
  },
}));

// Mock image optimizer
vi.mock("@/lib/image-optimizer", () => ({
  processImageUrl: vi.fn((url) => Promise.resolve(url)),
}));

// Mock chat validator
vi.mock("@/lib/telegram/product-chat-validator", () => ({
  validateProductTelegramChat: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock catalog-resolver
vi.mock("@/lib/products/catalog-resolver", () => ({
  ProductVisibilityService: {
    syncProductVisibility: vi.fn(() => Promise.resolve()),
  },
}));

describe("NewProductFlowV2 — Multi-Bot BotPicker Integration & Server Security", () => {
  const mockStore = { id: "store-123", slug: "store-test", name: "Minha Loja" };
  const ownerUser = { id: OWNER_USER_ID, email: OWNER_EMAIL, role: "admin" };
  const otherAdmin = { id: "admin-456", email: "outro-admin@teste.com", role: "admin" };
  const sellerUser = { id: "seller-789", email: "vendedor@teste.com", role: "seller" };

  const mockBots = [
    { id: "bot-1", username: "canal_vip_bot", displayName: "Bot VIP Principal", photoUrl: "https://r2.webgran.com/avatar1.jpg" },
    { id: "bot-2", username: "conteudo_premium_bot", displayName: "Bot Conteúdo Premium", photoUrl: null },
    { id: "bot-3", username: "bot_backup", displayName: null, photoUrl: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. REGRAS RÍGIDAS DE AUTORIZAÇÃO DO PROPRIETÁRIO
  // =========================================================================
  describe("1. Identificação do Proprietário e Isolamento de Acesso", () => {
    it("1.1 Autoriza proprietário por OWNER_USER_ID", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: OWNER_USER_ID })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { id: OWNER_USER_ID })).toBe(true);
      expect(isOwnerUser({ id: OWNER_USER_ID })).toBe(true);
    });

    it("1.2 Autoriza proprietário por role admin + lf49127@gmail.com normalizado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: "any", email: "lf49127@gmail.com", role: "admin" })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: "any", email: "  LF49127@GMAIL.COM  ", role: "admin" })).toBe(true);
    });

    it("1.3 Bloqueia outros administradores de configurar multi-bot", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", otherAdmin)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { email: "gestor@empresa.com", role: "admin" })).toBe(false);
    });

    it("1.4 Bloqueia vendedores comuns (role seller)", () => {
      expect(ProductManualDeepLinkService.isAuthorized("seller", sellerUser)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { email: "lf49127@gmail.com", role: "seller" })).toBe(false);
    });
  });

  // =========================================================================
  // 2. COMPONENTE BotPicker: Renderização, Avatares e Estados
  // =========================================================================
  describe("2. Componente BotPicker", () => {
    it("2.1 Renderiza o seletor de bot proprietário e a lista multi-bot", () => {
      const html = renderToStaticMarkup(
        <BotPicker
          bots={mockBots}
          selectedBotId="bot-1"
          onChangeSelectedBotId={vi.fn()}
          selectedBotIds={["bot-1", "bot-2"]}
          onChangeSelectedBotIds={vi.fn()}
        />
      );

      // Select do Bot proprietário
      expect(html).toContain("Bot proprietário");
      expect(html).toContain("Bot VIP Principal (@canal_vip_bot)");
      expect(html).toContain("Bot Conteúdo Premium (@conteudo_premium_bot)");

      // Seção Multi-bot
      expect(html).toContain("Disponibilidade nos Mini Apps");
      expect(html).toContain("Selecione um ou mais bots onde este produto ficará disponível.");
      expect(html).toContain("2 selecionados");
      expect(html).toContain("Selecionar todos");
      expect(html).toContain("Desmarcar todos");
      expect(html).toContain("Buscar por nome ou @username...");
    });

    it("2.2 Renderiza avatar de foto para bots com photoUrl e fallback com inicial para bots sem foto", () => {
      const html = renderToStaticMarkup(
        <BotPicker
          bots={mockBots}
          selectedBotId="bot-1"
          onChangeSelectedBotId={vi.fn()}
          selectedBotIds={["bot-1"]}
          onChangeSelectedBotIds={vi.fn()}
        />
      );

      // Bot 1 tem foto
      expect(html).toContain('src="https://r2.webgran.com/avatar1.jpg"');
      // Bot 2 não tem foto: inicial "B" de "Bot Conteúdo Premium"
      expect(html).toContain("bg-gradient-to-br from-[#27272a] to-[#18181b]");
      // Tag Proprietário para bot-1
      expect(html).toContain("Proprietário");
    });

    it("2.3 Exibe mensagens de erro quando fornecidas", () => {
      const html = renderToStaticMarkup(
        <BotPicker
          bots={mockBots}
          selectedBotId=""
          onChangeSelectedBotId={vi.fn()}
          selectedBotIds={[]}
          onChangeSelectedBotIds={vi.fn()}
          errors={{
            selectedBotId: "Selecione o bot proprietário.",
            selectedBots: "Selecione pelo menos um bot para disponibilizar o produto.",
          }}
        />
      );

      expect(html).toContain("Selecione o bot proprietário.");
      expect(html).toContain("Selecione pelo menos um bot para disponibilizar o produto.");
    });
  });

  // =========================================================================
  // 3. INTEGRAÇÃO NO ProductDetailsStep
  // =========================================================================
  describe("3. Integração no ProductDetailsStep", () => {
    it("3.1 Renderiza BotPicker quando catalogScope for BOT_SPECIFIC", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        catalogScope: "BOT_SPECIFIC",
        selectedBotId: "bot-1",
        targetBotIds: ["bot-1", "bot-2"],
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={[]}
          bots={mockBots}
          carousels={[]}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      expect(html).toContain("Bot proprietário");
      expect(html).toContain("Disponibilidade nos Mini Apps");
      expect(html).toContain("2 selecionados");
      expect(html).toContain("@canal_vip_bot");
      expect(html).toContain("@conteudo_premium_bot");
    });

    it("3.2 Não renderiza BotPicker quando catalogScope for STORE_GENERAL", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        catalogScope: "STORE_GENERAL",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={[]}
          bots={mockBots}
          carousels={[]}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      expect(html).not.toContain("Disponibilidade nos Mini Apps");
    });
  });

  // =========================================================================
  // 4. SEGURANÇA E EXECUÇÃO DO createProductAction NO SERVIDOR
  // =========================================================================
  describe("4. createProductAction — Proteção de Acesso e Multi-Bot no Servidor", () => {
    it("4.1 Não bloqueia outro admin ao criar produto com sharingMode CUSTOM", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(otherAdmin as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Curso Pro");
      formData.set("price", "97.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/acesso");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "CUSTOM");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));

      const result = await createProductAction(formData);
      // Vários bots agora são liberados para todos (só exige que os bots sejam da loja).
      expect(result.error ?? "").not.toContain("exclusiva da conta proprietária");
    });

    it("4.2 Não bloqueia vendedor comum (seller) ao passar vários targetBotIds", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(sellerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Curso Pro");
      formData.set("price", "97.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/acesso");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "EXCLUSIVE");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));

      const result = await createProductAction(formData);
      // Vários bots agora são liberados para todos (só exige que os bots sejam da loja).
      expect(result.error ?? "").not.toContain("exclusiva da conta proprietária");
    });

    it("4.3 Rejeita bots que não pertencem à loja do lojista (Multi-tenant check)", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      const { db } = await import("@/db");
      vi.mocked(requireSeller).mockResolvedValue(ownerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      // Bot proprietário pertence à loja
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({ id: "bot-1", storeId: mockStore.id } as any);
      // Mas a query de bots da loja só encontra 1 dos 2 selecionados
      vi.mocked(db.query.telegramBots.findMany).mockResolvedValue([{ id: "bot-1" }] as any);

      const formData = new FormData();
      formData.set("title", "Curso Pro");
      formData.set("price", "97.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/acesso");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "CUSTOM");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-alienigena"]));

      const result = await createProductAction(formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Um ou mais bots selecionados não pertencem a esta loja.");
    });

    it("4.4 Permite proprietário criar produto com múltiplos bots e sincroniza visibilidade", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      const { db } = await import("@/db");
      const { ProductVisibilityService } = await import("@/lib/products/catalog-resolver");

      vi.mocked(requireSeller).mockResolvedValue(ownerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({ id: "bot-1", storeId: mockStore.id } as any);
      vi.mocked(db.query.telegramBots.findMany).mockResolvedValue([{ id: "bot-1" }, { id: "bot-2" }] as any);

      const formData = new FormData();
      formData.set("title", "Mentoria Exclusiva");
      formData.set("price", "197.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/mentoria");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "CUSTOM");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));

      const result = await createProductAction(formData);
      expect(result.success).toBe(true);

      // Valida chamada do ProductVisibilityService
      expect(ProductVisibilityService.syncProductVisibility).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          storeId: mockStore.id,
          productId: "prod-new-123",
          botId: "bot-1",
          catalogScope: "BOT_SPECIFIC",
          sharingMode: "CUSTOM",
          targetBotIds: ["bot-1", "bot-2"],
          deliveryType: "external",
          deliveryValue: "https://exemplo.com/mentoria",
        })
      );
    });

    it("4.5 Vendedor pode associar outro bot além do proprietário (validado pela loja)", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(sellerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Curso Pro");
      formData.set("price", "97.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/acesso");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "EXCLUSIVE");
      // Tentativa de spoofing: 1 único bot no targetBotIds, mas diferente do botId proprietário
      formData.set("targetBotIds", JSON.stringify(["bot-2"]));

      const result = await createProductAction(formData);
      // Vários bots agora são liberados para todos (só exige que os bots sejam da loja).
      expect(result.error ?? "").not.toContain("exclusiva da conta proprietária");
    });

    it("4.6 targetBotIds com STORE_GENERAL não esbarra mais na trava de proprietário", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(sellerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Curso Geral");
      formData.set("price", "97.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/acesso");
      formData.set("catalogScope", "STORE_GENERAL");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));

      const result = await createProductAction(formData);
      // Vários bots agora são liberados para todos (só exige que os bots sejam da loja).
      expect(result.error ?? "").not.toContain("exclusiva da conta proprietária");
    });

    it("4.7 Rejeita imediatamente sem tocar no banco caso db.transaction não esteja disponível", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      const { db } = await import("@/db");

      vi.mocked(requireSeller).mockResolvedValue(ownerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const origTransaction = (db as any).transaction;
      delete (db as any).transaction;

      const formData = new FormData();
      formData.set("title", "Produto sem transação");
      formData.set("price", "50.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/falha");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");

      const result = await createProductAction(formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("não suporta transações atômicas");
      expect(db.insert).not.toHaveBeenCalled();

      // Restaura mock da transação
      (db as any).transaction = origTransaction;
    });

    it("4.8 Identidade forjada no formulário não muda nada: vários bots já são liberados", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      // Sessão real do servidor é sellerUser
      vi.mocked(requireSeller).mockResolvedValue(sellerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Tentativa de Bypass");
      formData.set("price", "100.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/bypass");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "CUSTOM");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));
      // Tentativa de forjar identidade via campos de formulário
      formData.set("userId", OWNER_USER_ID);
      formData.set("email", OWNER_EMAIL);
      formData.set("role", "admin");

      const result = await createProductAction(formData);
      // O servidor deve ignorar os campos do formulário e consultar estritamente a sessão autenticada (sellerUser)
      // Vários bots agora são liberados para todos (só exige que os bots sejam da loja).
      expect(result.error ?? "").not.toContain("exclusiva da conta proprietária");
    });

    it("4.9 Garante atomicidade: executa produto, visibilidade e carrosséis na mesma transação PostgreSQL", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      const { db } = await import("@/db");
      const { ProductVisibilityService } = await import("@/lib/products/catalog-resolver");

      vi.mocked(requireSeller).mockResolvedValue(ownerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({ id: "bot-1", storeId: mockStore.id } as any);
      vi.mocked(db.query.telegramBots.findMany).mockResolvedValue([{ id: "bot-1" }] as any);
      vi.mocked(db.query.productCarousels.findMany).mockResolvedValue([{ id: "car-1" }] as any);

      // Simula suporte real a db.transaction
      const mockTx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ id: "prod-tx-999", title: "Produto Atômico" }])),
          })),
        })),
      };
      (db as any).transaction = vi.fn(async (cb: any) => await cb(mockTx));

      const formData = new FormData();
      formData.set("title", "Produto Atômico");
      formData.set("price", "250.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://exemplo.com/atomico");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("targetBotIds", JSON.stringify(["bot-1"]));
      formData.set("carouselIds", JSON.stringify(["car-1"]));

      const result = await createProductAction(formData);
      expect(result.success).toBe(true);

      // Confirma que db.transaction foi chamado
      expect((db as any).transaction).toHaveBeenCalledTimes(1);

      // Confirma que syncProductVisibility recebeu a instância mockTx (mesma transação)
      expect(ProductVisibilityService.syncProductVisibility).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: "prod-tx-999",
          botId: "bot-1",
        })
      );

      // Confirma que o insert de carrosséis também utilizou mockTx (mesma transação)
      expect(mockTx.insert).toHaveBeenCalled();

      // Restaura mock padrão de transaction
      (db as any).transaction = vi.fn(async (cb: any) => cb(db));
    });
  });
});

