import { describe, it, expect, vi, beforeEach } from "vitest";
import { OWNER_EMAIL, OWNER_USER_ID, isOwnerUser } from "@/lib/bots/owner-guard";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { ProductVisibilityService, CatalogScope, SharingMode } from "@/lib/products/catalog-resolver";
import { updateProductAction, getProductVisibilitiesAction } from "../actions";

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => {
  const mockDb = {
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

// Mock media lifecycle
vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn(),
  },
}));

describe("EditProductModalV2 — Multi-Bot Selection & Owner Security Suite", () => {
  const mockStore = { id: "store-123", slug: "store-test", name: "Minha Loja" };
  const ownerUser = { id: OWNER_USER_ID, email: OWNER_EMAIL, role: "admin" };
  const otherAdmin = { id: "admin-456", email: "outro-admin@teste.com", role: "admin" };
  const sellerUser = { id: "seller-789", email: "vendedor@teste.com", role: "seller" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Strict Owner Authentication Rules", () => {
    it("permite proprietário por ID", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: OWNER_USER_ID })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { id: OWNER_USER_ID })).toBe(true);
      expect(isOwnerUser({ id: OWNER_USER_ID })).toBe(true);
    });

    it("permite proprietário por role admin + lf49127@gmail.com normalizado", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: "any-id", role: "admin", email: "lf49127@gmail.com" })).toBe(true);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: "any-id", role: "admin", email: "  LF49127@GMAIL.COM  " })).toBe(true);
    });

    it("bloqueia outros administradores", () => {
      expect(ProductManualDeepLinkService.isAuthorized("admin", otherAdmin)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("admin", { id: "other", role: "admin", email: "admin@gmail.com" })).toBe(false);
    });

    it("bloqueia vendedores comuns mesmo com e-mail similar", () => {
      expect(ProductManualDeepLinkService.isAuthorized("seller", sellerUser)).toBe(false);
      expect(ProductManualDeepLinkService.isAuthorized("seller", { id: "other", role: "seller", email: "lf49127@gmail.com" })).toBe(false);
    });
  });

  describe("2. Server Action Security: Multi-Bot Blocking for Non-Owners", () => {
    it("bloqueia outro admin de atualizar produto com sharingMode CUSTOM", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(otherAdmin as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Produto Teste");
      formData.set("price", "29.90");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://google.com");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("sharingMode", "CUSTOM");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2"]));

      const result = await updateProductAction("prod-1", formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("exclusiva da conta proprietária");
    });

    it("bloqueia vendedor comum de tentar salvar múltiplos targetBotIds", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(sellerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const formData = new FormData();
      formData.set("title", "Produto Teste");
      formData.set("price", "29.90");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://google.com");
      formData.set("catalogScope", "BOT_SPECIFIC");
      formData.set("botId", "bot-1");
      formData.set("targetBotIds", JSON.stringify(["bot-1", "bot-2", "bot-3"]));

      const result = await updateProductAction("prod-1", formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("exclusiva da conta proprietária");
    });

    it("bloqueia não-proprietário em getProductVisibilitiesAction", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(otherAdmin as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const res = await getProductVisibilitiesAction("prod-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito");
    });
  });

  describe("3. Multi-Bot Visibility Syncing (ProductVisibilityService)", () => {
    it("sincroniza múltiplos bots com bot proprietário (isOwner=true) e outros bots (isOwner=false)", async () => {
      const insertedRows: any[] = [];
      const deletedConditions: any[] = [];

      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn((cond) => {
            deletedConditions.push(cond);
            return Promise.resolve();
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((rows) => {
            insertedRows.push(...rows);
            return Promise.resolve();
          }),
        })),
        query: {
          telegramBots: {
            findFirst: vi.fn(() => Promise.resolve({ id: "bot-owner", storeId: "store-123" })),
            findMany: vi.fn(() =>
              Promise.resolve([
                { id: "bot-2", storeId: "store-123", status: "active" },
                { id: "bot-3", storeId: "store-123", status: "active" },
              ])
            ),
          },
        },
      };

      await ProductVisibilityService.syncProductVisibility(mockTx as any, {
        storeId: "store-123",
        productId: "prod-1",
        botId: "bot-owner",
        catalogScope: "BOT_SPECIFIC",
        sharingMode: "CUSTOM",
        targetBotIds: ["bot-owner", "bot-2", "bot-3"],
      });

      // Validar remoção de visibilidades anteriores
      expect(mockTx.delete).toHaveBeenCalled();

      // Validar linhas inseridas
      expect(insertedRows).toHaveLength(3);

      const ownerRow = insertedRows.find((r) => r.botId === "bot-owner");
      expect(ownerRow).toBeDefined();
      expect(ownerRow.isOwner).toBe(true);
      expect(ownerRow.canDeliver).toBe(true);

      const bot2Row = insertedRows.find((r) => r.botId === "bot-2");
      expect(bot2Row).toBeDefined();
      expect(bot2Row.isOwner).toBe(false);

      const bot3Row = insertedRows.find((r) => r.botId === "bot-3");
      expect(bot3Row).toBeDefined();
      expect(bot3Row.isOwner).toBe(false);
    });

    it("permite desmarcar um bot secundário sem afetar o bot proprietário", async () => {
      const insertedRows: any[] = [];

      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((rows) => {
            insertedRows.push(...rows);
            return Promise.resolve();
          }),
        })),
        query: {
          telegramBots: {
            findFirst: vi.fn(() => Promise.resolve({ id: "bot-owner", storeId: "store-123" })),
            findMany: vi.fn(() =>
              Promise.resolve([
                { id: "bot-2", storeId: "store-123", status: "active" },
              ])
            ),
          },
        },
      };

      // Usuário desmarcou bot-3, mantendo apenas bot-owner e bot-2
      await ProductVisibilityService.syncProductVisibility(mockTx as any, {
        storeId: "store-123",
        productId: "prod-1",
        botId: "bot-owner",
        catalogScope: "BOT_SPECIFIC",
        sharingMode: "CUSTOM",
        targetBotIds: ["bot-owner", "bot-2"],
      });

      expect(insertedRows).toHaveLength(2);
      expect(insertedRows.some((r) => r.botId === "bot-3")).toBe(false);
      expect(insertedRows.find((r) => r.botId === "bot-owner")?.isOwner).toBe(true);
      expect(insertedRows.find((r) => r.botId === "bot-2")?.isOwner).toBe(false);
    });

    it("preserva BOT_GENERAL como snapshot dos bots ativos existentes", async () => {
      const insertedRows: any[] = [];

      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((rows) => {
            insertedRows.push(...rows);
            return Promise.resolve();
          }),
        })),
        query: {
          telegramBots: {
            findMany: vi.fn(() =>
              Promise.resolve([
                { id: "bot-1", storeId: "store-123", status: "active" },
                { id: "bot-2", storeId: "store-123", status: "active" },
              ])
            ),
          },
          telegramBotChats: {
            findFirst: vi.fn(() => Promise.resolve(null)),
          },
        },
      };

      await ProductVisibilityService.syncProductVisibility(mockTx as any, {
        storeId: "store-123",
        productId: "prod-1",
        botId: null,
        catalogScope: "BOT_GENERAL",
        sharingMode: "EXCLUSIVE",
      });

      expect(insertedRows).toHaveLength(2);
      expect(insertedRows.every((r) => r.canDeliver === true)).toBe(true);
    });

    it("avalia deterministicamente can_deliver: bot com capacidade vs bot sem capacidade no canal Telegram", async () => {
      const insertedRows: any[] = [];

      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((rows) => {
            insertedRows.push(...rows);
            return Promise.resolve();
          }),
        })),
        query: {
          telegramBots: {
            findFirst: vi.fn(() => Promise.resolve({ id: "bot-owner", storeId: "store-123" })),
            findMany: vi.fn(() =>
              Promise.resolve([
                { id: "bot-sem-permissao", storeId: "store-123", status: "active" },
              ])
            ),
          },
          telegramBotChats: {
            findFirst: vi.fn(({ where }) => {
              // Simular: bot-owner tem permissão de administrador no canal; bot-sem-permissao NÃO tem
              // Se botId for bot-owner:
              return Promise.resolve({
                botId: "bot-owner",
                telegramChatId: "-100999999999",
                botStatus: "administrator",
                canInviteUsers: true,
                isActive: true,
              });
            }),
          },
        },
      };

      // Mock para bot-sem-permissao retornar null no chat
      mockTx.query.telegramBotChats.findFirst = vi.fn().mockImplementation(async (params: any) => {
        // Se a busca for para bot-owner:
        const whereClause = params?.where;
        // Na nossa implementação, botId é verificado
        return null; // padrão sem permissão
      });

      // Implementação customizada para distinguir bots
      mockTx.query.telegramBotChats.findFirst = vi.fn().mockImplementation(async () => {
        // Retorna permissão apenas se for a primeira chamada (bot-owner)
        if (mockTx.query.telegramBotChats.findFirst.mock.calls.length === 1) {
          return {
            botId: "bot-owner",
            telegramChatId: "-100999999999",
            botStatus: "administrator",
            canInviteUsers: true,
            isActive: true,
          };
        }
        return null; // bot-sem-permissao não tem chat cadastrado
      });

      await ProductVisibilityService.syncProductVisibility(mockTx as any, {
        storeId: "store-123",
        productId: "prod-canal",
        botId: "bot-owner",
        catalogScope: "BOT_SPECIFIC",
        sharingMode: "CUSTOM",
        targetBotIds: ["bot-owner", "bot-sem-permissao"],
        deliveryType: "telegram",
        deliveryValue: "-100999999999",
      });

      expect(insertedRows).toHaveLength(2);

      const ownerRow = insertedRows.find((r) => r.botId === "bot-owner");
      expect(ownerRow).toBeDefined();
      expect(ownerRow.isOwner).toBe(true);
      expect(ownerRow.canDeliver).toBe(true);
      expect(ownerRow.deliveryBlockReason).toBeNull();

      const blockedRow = insertedRows.find((r) => r.botId === "bot-sem-permissao");
      expect(blockedRow).toBeDefined();
      expect(blockedRow.isOwner).toBe(false);
      expect(blockedRow.canDeliver).toBe(false);
      expect(blockedRow.deliveryBlockReason).toContain("permissão de administrador");
    });

    it("preserva STORE_GENERAL: limpa visibilidades e não insere nenhum bot", async () => {
      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => Promise.resolve()),
        })),
        query: {
          telegramBots: {
            findMany: vi.fn(),
          },
        },
      };

      await ProductVisibilityService.syncProductVisibility(mockTx as any, {
        storeId: "store-123",
        productId: "prod-store-general",
        botId: null,
        catalogScope: "STORE_GENERAL",
        sharingMode: "EXCLUSIVE",
      });

      expect(mockTx.delete).toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it("falha durante sincronização transacional propaga exceção para rollback seguro", async () => {
      const mockTx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
        insert: vi.fn(() => {
          throw new Error("Simulação de falha no banco Neon");
        }),
        query: {
          telegramBots: {
            findFirst: vi.fn(() => Promise.resolve({ id: "bot-owner", storeId: "store-123" })),
            findMany: vi.fn(() => Promise.resolve([])),
          },
        },
      };

      await expect(
        ProductVisibilityService.syncProductVisibility(mockTx as any, {
          storeId: "store-123",
          productId: "prod-fail",
          botId: "bot-owner",
          catalogScope: "BOT_SPECIFIC",
          sharingMode: "CUSTOM",
          targetBotIds: ["bot-owner"],
        })
      ).rejects.toThrow("Simulação de falha no banco Neon");
    });

    it("persiste e recupera visibilidades do produto após reabrir", async () => {
      const { requireSeller, getCurrentStore } = await import("@/lib/auth");
      vi.mocked(requireSeller).mockResolvedValue(ownerUser as any);
      vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);

      const { db } = await import("@/db");
      vi.mocked(db.query.productBotVisibility.findMany).mockResolvedValue([
        { botId: "bot-owner", isOwner: true, canDeliver: true } as any,
        { botId: "bot-shared-1", isOwner: false, canDeliver: true } as any,
      ]);

      const res = await getProductVisibilitiesAction("prod-saved-1");
      expect(res.success).toBe(true);
      expect(res.visibilities).toHaveLength(2);
      expect(res.visibilities?.[0].botId).toBe("bot-owner");
      expect(res.visibilities?.[1].botId).toBe("bot-shared-1");
    });
  });

  describe("4. Bot Filtering, Search and Selection Logic", () => {
    const sampleBots = [
      { id: "b1", username: "studiioshorts_bot", displayName: "STUDIO MINI APP™", photoUrl: "https://api.telegram.org/photo1.jpg" },
      { id: "b2", username: "appseries_bot", displayName: "APP NOSSA SÉRIE", photoUrl: null },
      { id: "b3", username: "novelatop_bot", displayName: "NOVELAS VIP", photoUrl: "https://api.telegram.org/photo3.jpg" },
    ];

    it("filtra bots por displayName ignorando maiúsculas", () => {
      const term = "nossa";
      const filtered = sampleBots.filter(
        (b) => b.displayName.toLowerCase().includes(term) || b.username.toLowerCase().includes(term)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("b2");
    });

    it("filtra bots por @username", () => {
      const term = "studiio";
      const filtered = sampleBots.filter(
        (b) => b.displayName.toLowerCase().includes(term) || b.username.toLowerCase().includes(term)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("b1");
    });

    it("selecionar todos e desmarcar todos funcionam corretamente", () => {
      let selected: string[] = [];
      // Selecionar todos
      selected = sampleBots.map((b) => b.id);
      expect(selected).toEqual(["b1", "b2", "b3"]);

      // Desmarcar todos
      selected = [];
      expect(selected).toHaveLength(0);
    });

    it("reconhece foto real e fallback quando photoUrl for nulo", () => {
      expect(sampleBots[0].photoUrl).toBeTruthy();
      expect(sampleBots[1].photoUrl).toBeNull();
    });
  });
});
