import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// Mock DB
// Track TelegramBotService instantiated tokens
export const botServiceConstructors: string[] = [];
export const mockBanChatMember = vi.fn();
export const mockUnbanChatMember = vi.fn();

// Mock DB
vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      accesses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

// Mock Auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

// Mock Encryption & TelegramBotService
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockImplementation((val: string) => `decrypted-${val}`),
}));

vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: class MockBotService {
      token: string;
      constructor(token: string) {
        this.token = token;
        botServiceConstructors.push(token);
      }
      getMe = vi.fn().mockResolvedValue({ id: "123456", username: "botA_username" });
      getChat = vi.fn().mockResolvedValue({ id: "-10012345", title: "Canal VIP", type: "channel" });
      getChatMember = vi.fn().mockResolvedValue({ status: "administrator", can_invite_users: true });
      banChatMember = vi.fn().mockImplementation((...args: any[]) => mockBanChatMember(...args));
      unbanChatMember = vi.fn().mockImplementation((...args: any[]) => mockUnbanChatMember(...args));
    },
  };
});

vi.mock("@/lib/delivery/telegram-delivery-service", () => ({
  TelegramDeliveryService: {
    checkBuyerMembership: vi.fn().mockResolvedValue(true),
    validateBotAndChatPermission: vi.fn().mockResolvedValue({ success: true }),
    createTelegramInvite: vi.fn().mockResolvedValue({ inviteLink: "https://t.me/+invite" }),
    sendPaymentConfirmationMessage: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));

vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    trackReplacements: vi.fn(),
  },
}));

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    reserveStorageForUpload: vi.fn().mockResolvedValue({ allowed: true }),
    confirmReservation: vi.fn(),
    releaseReservation: vi.fn(),
  },
}));

vi.mock("@/lib/telegram/chat-sync", () => ({
  saveOrUpdateBotChat: vi.fn().mockResolvedValue({ id: "chat-1", isActive: true }),
  getBotChats: vi.fn().mockResolvedValue([]),
  syncBotChats: vi.fn().mockResolvedValue([]),
}));

import { db } from "@/db";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { validateProductTelegramChat } from "@/lib/telegram/product-chat-validator";
import {
  createProductAction,
  updateProductAction,
  testTelegramChatAccessAction,
  getBotChatsAction,
} from "@/app/(seller)/seller/products/actions";
import { processExpiredAccesses } from "@/lib/orders/expiration-service";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { TelegramDeliveryService } from "@/lib/delivery/telegram-delivery-service";

describe("Product-Bot Association Isolation & Scope Regression Suite", () => {
  const storeA = { id: "store-uuid-a", name: "Loja A", slug: "loja-a" };
  const storeB = { id: "store-uuid-b", name: "Loja B", slug: "loja-b" };

  const botA = {
    id: "bot-uuid-a",
    botId: "123456",
    storeId: "store-uuid-a",
    username: "studio_mini_app_bot",
    displayName: "STUDIO MINI APP™",
    tokenEncrypted: "enc-token-a",
    status: "active",
  };

  const botB = {
    id: "bot-uuid-b",
    botId: "654321",
    storeId: "store-uuid-a",
    username: "bot_b_store_a",
    displayName: "Bot Secundário",
    tokenEncrypted: "enc-token-b",
    status: "active",
  };

  const botAlien = {
    id: "bot-uuid-alien",
    botId: "999999",
    storeId: "store-uuid-b", // Pertence à Loja B!
    username: "alien_bot",
    displayName: "Bot Outra Loja",
    tokenEncrypted: "enc-token-alien",
    status: "active",
  };

  const sellerA = { id: "seller-user-a", role: "SELLER" };

  beforeEach(() => {
    vi.clearAllMocks();
    botServiceConstructors.length = 0;
    mockBanChatMember.mockReset().mockResolvedValue(true);
    mockUnbanChatMember.mockReset().mockResolvedValue(true);
    vi.mocked(requireSeller).mockResolvedValue(sellerA as any);
    vi.mocked(getCurrentStore).mockResolvedValue(storeA as any);
  });

  // 1. Vincular um recurso ao Bot A não o vincula ao Bot B
  it("1. Vincular um produto ao Bot A persiste botId estritamente como Bot A e não afeta o Bot B", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 2 }]),
      }),
    } as any);

    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);

    let insertedValues: any = null;
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        insertedValues = val;
        return {
          returning: vi.fn().mockResolvedValue([{ id: "prod-new-1", ...val }]),
        };
      }),
    } as any);

    const formData = new FormData();
    formData.set("title", "Produto Exclusivo Bot A");
    formData.set("price", "99.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://link.com/download");
    formData.set("botId", botA.id); // Vinculando ao Bot A

    await createProductAction(formData);

    expect(insertedValues).toBeDefined();
    expect(insertedValues.botId).toBe(botA.id);
    expect(insertedValues.botId).not.toBe(botB.id);
  });

  // 2. O Bot A mostra seus próprios vínculos
  it("2. O Bot A mostra seus próprios vínculos quando filtrado por escopo", () => {
    const catalog = [
      { id: "p1", title: "Produto do Bot A", botId: botA.id, status: "active" },
      { id: "p2", title: "Produto do Bot B", botId: botB.id, status: "active" },
      { id: "p3", title: "Produto Loja Geral", botId: null, status: "active" },
    ];

    const selectedBot = botA.id;
    const botAProducts = catalog.filter((prod) => {
      return selectedBot === "all"
        ? true
        : selectedBot === "global"
        ? !prod.botId
        : prod.botId === selectedBot;
    });

    expect(botAProducts).toHaveLength(1);
    expect(botAProducts[0].id).toBe("p1");
    expect(botAProducts[0].title).toBe("Produto do Bot A");
  });

  // 3. O Bot B mostra somente os seus vínculos
  it("3. O Bot B mostra somente os seus vínculos quando selecionado", () => {
    const catalog = [
      { id: "p1", title: "Produto do Bot A", botId: botA.id, status: "active" },
      { id: "p2", title: "Produto do Bot B", botId: botB.id, status: "active" },
      { id: "p3", title: "Produto Loja Geral", botId: null, status: "active" },
    ];

    const selectedBot = botB.id;
    const botBProducts = catalog.filter((prod) => {
      return selectedBot === "all"
        ? true
        : selectedBot === "global"
        ? !prod.botId
        : prod.botId === selectedBot;
    });

    expect(botBProducts).toHaveLength(1);
    expect(botBProducts[0].id).toBe("p2");
    expect(botBProducts[0].title).toBe("Produto do Bot B");
  });

  // 4. Vínculos de “Todos os Bots (Loja Geral)” seguem a regra global existente
  it("4. Vínculos de 'Todos os Bots (Loja Geral)' representam exclusivamente registros com botId nulo", () => {
    const catalog = [
      { id: "p1", title: "Produto do Bot A", botId: botA.id, status: "active" },
      { id: "p2", title: "Produto do Bot B", botId: botB.id, status: "active" },
      { id: "p3", title: "Produto Loja Geral 1", botId: null, status: "active" },
      { id: "p4", title: "Produto Loja Geral 2", botId: null, status: "active" },
    ];

    const selectedBot: string = "global";
    const globalProducts = catalog.filter((prod) => {
      return selectedBot === "all"
        ? true
        : selectedBot === "global"
        ? !prod.botId
        : prod.botId === selectedBot;
    });

    expect(globalProducts).toHaveLength(2);
    expect(globalProducts.map((p) => p.id)).toEqual(["p3", "p4"]);
    expect(globalProducts.every((p) => p.botId === null)).toBe(true);
  });

  // 5. Trocar rapidamente entre bots não exibe dados desatualizados
  it("5. Trocar rapidamente entre bots calcula o conjunto exato de produtos sem vazamento de estado", () => {
    const catalog = [
      { id: "p1", title: "Prod A1", botId: botA.id },
      { id: "p2", title: "Prod A2", botId: botA.id },
      { id: "p3", title: "Prod B1", botId: botB.id },
      { id: "p4", title: "Prod Geral", botId: null },
    ];

    const filterFn = (scope: string) =>
      catalog.filter((p) => (scope === "all" ? true : scope === "global" ? !p.botId : p.botId === scope));

    // Passo 1: Seleciona Bot A
    let currentView = filterFn(botA.id);
    expect(currentView.map((p) => p.id)).toEqual(["p1", "p2"]);

    // Passo 2: Troca instantânea para Bot B
    currentView = filterFn(botB.id);
    expect(currentView.map((p) => p.id)).toEqual(["p3"]);

    // Passo 3: Troca instantânea para Loja Geral
    currentView = filterFn("global");
    expect(currentView.map((p) => p.id)).toEqual(["p4"]);

    // Passo 4: Troca instantânea de volta para Bot A
    currentView = filterFn(botA.id);
    expect(currentView.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  // 6. Um vendedor não consegue alterar vínculos de outra loja
  describe("6. Isolamento multi-inquilino estrito (Cross-store security)", () => {
    it("6a. createProductAction rejeita botId de outra loja", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);

      // Simula que botAlien não é encontrado no escopo da loja A
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const formData = new FormData();
      formData.set("title", "Produto Invasor");
      formData.set("price", "50.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://link.com");
      formData.set("botId", botAlien.id);

      await expect(createProductAction(formData)).rejects.toThrow(
        "O bot selecionado não pertence a esta loja."
      );
    });

    it("6b. updateProductAction rejeita botId de outra loja", async () => {
      // Simula que botAlien não é encontrado no escopo da loja A
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const formData = new FormData();
      formData.set("title", "Produto Modificado");
      formData.set("price", "50.00");
      formData.set("deliveryType", "external");
      formData.set("deliveryValue", "https://link.com");
      formData.set("botId", botAlien.id);

      await expect(updateProductAction("prod-uuid-1", formData)).rejects.toThrow(
        "O bot selecionado não pertence a esta loja."
      );
    });

    it("6c. validateProductTelegramChat rejeita e não executa fallback se targetBotId for de outra loja", async () => {
      // targetBotId pertence à Loja B, storeId testado é Loja A -> findFirst retorna null
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const result = await validateProductTelegramChat(storeA.id, "-10012345", botAlien.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe("BOT_MISSING");
      expect(result.error).toContain("O bot selecionado não foi encontrado ou não pertence a esta loja.");
    });

    it("6d. testTelegramChatAccessAction rejeita botId que não pertence à loja do vendedor", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const result = await testTelegramChatAccessAction(botAlien.id, "-10012345");

      expect(result.success).toBe(false);
      expect(result.error).toContain("O bot selecionado não foi encontrado ou não pertence a esta loja.");
    });

    it("6e. getBotChatsAction retorna array vazio sem fallback quando botId pertence a outra loja", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const result = await getBotChatsAction(botAlien.id);

      expect(result).toEqual([]);
    });
  });

  // 7. Atualizar ou remover um vínculo afeta somente o escopo correto
  it("7. Atualizar o vínculo de um produto para outro bot altera somente o escopo correto", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botB as any);
    vi.mocked(db.query.products.findFirst).mockResolvedValue({
      id: "prod-1",
      storeId: storeA.id,
      botId: botA.id,
      title: "Produto Original",
    } as any);

    let updatedSet: any = null;
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockImplementation((val) => {
        updatedSet = val;
        return {
          where: vi.fn().mockResolvedValue([{ id: "prod-1", ...val }]),
        };
      }),
    } as any);

    const formData = new FormData();
    formData.set("title", "Produto Original");
    formData.set("price", "80.00");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://link.com");
    formData.set("botId", botB.id); // Movendo do Bot A para o Bot B

    await updateProductAction("prod-1", formData);

    expect(updatedSet).toBeDefined();
    expect(updatedSet.botId).toBe(botB.id);
  });

  it("7b. Remover o vínculo de bot (definindo como Loja Geral / Todos os Bots) define botId como null sem afetar outros produtos", async () => {
    vi.mocked(db.query.products.findFirst).mockResolvedValue({
      id: "prod-1",
      storeId: storeA.id,
      botId: botA.id,
      title: "Produto Original",
    } as any);

    let updatedSet: any = null;
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockImplementation((val) => {
        updatedSet = val;
        return {
          where: vi.fn().mockResolvedValue([{ id: "prod-1", ...val }]),
        };
      }),
    } as any);

    const formData = new FormData();
    formData.set("title", "Produto Original");
    formData.set("price", "80.00");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://link.com");
    formData.set("botId", ""); // Definindo para Todos os Bots (Loja Geral)

    await updateProductAction("prod-1", formData);

    expect(updatedSet).toBeDefined();
    expect(updatedSet.botId).toBeNull();
  });

  // 8. Isolamento na revogação de acessos (expiration-service)
  describe("8. Isolamento estrito na revogação de acessos (expiration-service)", () => {
    it("8a. Revogação com bot específico correto utiliza exclusivamente as credenciais do bot vinculado", async () => {
      const mockAccess = {
        id: "acc-1",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000), // Vencido
        product: { id: "prod-1", botId: botA.id, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA, botB] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-1", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(true);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("SUCCESS");
      expect(botServiceConstructors).toEqual(["decrypted-enc-token-a"]);
      expect(botServiceConstructors).not.toContain("decrypted-enc-token-b");
    });

    it("8b. Bot específico ausente não utiliza fallback para outro bot, registra erro operacional sem expor tokens e preserva o acesso para retry", async () => {
      const mockAccess = {
        id: "acc-2",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: "bot-inexistente", deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botB] }, // Há o botB na loja, mas NÃO deve ser usado!
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      // findFirst não encontra o bot inexistente no escopo da loja
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-2", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      // Estado comercial do acesso fica EXPIRED mesmo se a revogação no Telegram falhar
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revokedAt).toBeNull();
      expect(updateValues.revocationError).toContain("não está ativo nesta loja");
      // Confirma que NENHUM bot foi instanciado
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("8c. Bot associado a outra loja não utiliza fallback para outro bot, registra erro operacional e preserva status comercial EXPIRED", async () => {
      const mockAccess = {
        id: "acc-3",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: botAlien.id, deliveryValue: "-10012345" }, // bot de outra loja!
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      // Busca no escopo da storeA com botId de storeB retorna null
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-3", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revokedAt).toBeNull();
      expect(updateValues.revocationError).toContain("não está ativo nesta loja");
      // Não utilizou o token alien nem o token do botA
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("8d. Produto global (botId = null) com bot padrão ativo realiza revogação com o bot ativo da loja", async () => {
      const mockAccess = {
        id: "acc-4",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-global",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-global", botId: null, deliveryValue: "-10012345" }, // Loja Geral
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-4", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(true);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("SUCCESS");
      expect(botServiceConstructors).toEqual(["decrypted-enc-token-a"]);
    });

    it("8e. Falha de resolução não instancia TelegramBotService nem utiliza token de outro bot cadastrado", async () => {
      const mockAccess = {
        id: "acc-5",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: "bot-invalido", deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA, botB] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-5", ...val }]),
          };
        }),
      } as any);

      await processExpiredAccesses();

      // Zero chamadas ao TelegramBotService
      expect(botServiceConstructors).toHaveLength(0);
      // Mensagem de erro operacional limpa e sem tokens
      expect(updateValues.revocationError).not.toContain("enc-token");
      expect(updateValues.revocationError).not.toContain("decrypted");
      expect(updateValues.revocationError).toContain("não está ativo nesta loja");
    });

    it("8f. Produto global (botId = null) sem bot ativo na loja não utiliza bot inativo, marca status comercial EXPIRED e revocationStatus FAILED", async () => {
      const mockAccess = {
        id: "acc-6",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-global",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-global", botId: null, deliveryValue: "-10012345" }, // Loja Geral
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: {
          id: storeA.id,
          // A loja possui apenas um bot INATIVO!
          bots: [{ id: "bot-inactive", status: "inactive", tokenEncrypted: "enc-token-inactive" }],
        },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      // findFirst com status: 'active' não encontra nenhum bot ativo
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-6", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revokedAt).toBeNull();
      expect(updateValues.revocationError).toBe("Nenhum bot ativo foi encontrado para esta loja.");
      // Confirma que o token do bot inativo NUNCA foi utilizado!
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("8g. Retentativa de revogação para acesso já EXPIRED com revocationStatus FAILED executa revogação com bot reativado, sem restaurar status comercial para ACTIVE", async () => {
      const mockAccess = {
        id: "acc-retry-revoc",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "EXPIRED",
        deliveryStatus: "EXPIRED",
        revocationStatus: "FAILED",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: botA.id, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-retry-revoc", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(true);
      // Status comercial permanece EXPIRED: nunca restaura para ACTIVE
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("SUCCESS");
      expect(updateValues.revocationError).toBeNull();
      expect(updateValues.revokedAt).toBeInstanceOf(Date);
      expect(botServiceConstructors).toEqual(["decrypted-enc-token-a"]);
    });

    it("8h. Idempotência: acessos já com revogação SUCCESS não repetem operações nem chamam Telegram", async () => {
      // Quando findMany executa a query com filtro de status/revocationStatus, acessos concluídos não retornam
      vi.mocked(db.query.accesses.findMany).mockResolvedValue([]);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(0);
      expect(botServiceConstructors).toHaveLength(0);
      expect(db.update).not.toHaveBeenCalled();
    });

    it("8i. Erro de API do Telegram marca status comercial como EXPIRED e revocationStatus como FAILED para retentativa", async () => {
      const mockAccess = {
        id: "acc-api-err",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: botA.id, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);
      mockBanChatMember.mockRejectedValueOnce(new Error("429 Too Many Requests"));

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-api-err", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      // Status comercial vira EXPIRED independentemente do erro no Telegram
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revocationError).toContain("429 Too Many Requests");
      expect(updateValues.revokedAt).toBeNull();
    });

    it("8j. Preserva revokedAt pré-existente e não apaga o timestamp em reprocessamentos", async () => {
      const pastRevokedAt = new Date(Date.now() - 120000);
      const mockAccess = {
        id: "acc-preserve-revoked",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "EXPIRED",
        deliveryStatus: "EXPIRED",
        revocationStatus: "PENDING",
        revokedAt: pastRevokedAt,
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: botA.id, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id, bots: [botA] },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-preserve-revoked", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(true);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("SUCCESS");
      // Preserva o revokedAt original sem apagar ou sobrescrever indevidamente
      expect(updateValues.revokedAt).toEqual(pastRevokedAt);
    });

    it("8k. Produto global (botId = null) não utiliza bot ativo de outra loja, marca status comercial EXPIRED e revocationStatus FAILED", async () => {
      const mockAccess = {
        id: "acc-global-alien",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-global",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-global", botId: null, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      // db query com where storeId = storeA.id não encontra o bot de storeB
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-global-alien", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revocationError).toBe("Nenhum bot ativo foi encontrado para esta loja.");
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("8l. Bot correto sem tokenEncrypted registra erro operacional, marca status EXPIRED e revocationStatus FAILED", async () => {
      const botWithoutToken = {
        ...botA,
        tokenEncrypted: null,
      };

      const mockAccess = {
        id: "acc-no-token",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        telegramChatId: "-10012345",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-1", botId: botA.id, deliveryValue: "-10012345" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botWithoutToken as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-no-token", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("FAILED");
      expect(updateValues.revocationError).toContain("Bot ativo não possui token de autenticação configurado.");
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("8m. Entrega externa ou que não envolve canal do Telegram não tenta resolver bot e define revocationStatus SKIPPED_NOT_MEMBER", async () => {
      const mockAccess = {
        id: "acc-external",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-ext",
        deliveryType: "external",
        telegramChatId: "https://drive.google.com/folder",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() - 60000),
        product: { id: "prod-ext", botId: null, deliveryValue: "https://drive.google.com/folder", deliveryType: "external" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
        store: { id: storeA.id },
      };

      vi.mocked(db.query.accesses.findMany).mockResolvedValue([mockAccess] as any);

      let updateValues: any = null;
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updateValues = val;
          return {
            where: vi.fn().mockResolvedValue([{ id: "acc-external", ...val }]),
          };
        }),
      } as any);

      const result = await processExpiredAccesses();

      expect(result.processedCount).toBe(1);
      expect(result.results[0].revokedFromTelegram).toBe(false);
      expect(updateValues.status).toBe("EXPIRED");
      expect(updateValues.deliveryStatus).toBe("EXPIRED");
      expect(updateValues.revocationStatus).toBe("SKIPPED_NOT_MEMBER");
      expect(updateValues.revocationError).toBeNull();
      // Não deve ter consultado bot nem instanciado bot
      expect(db.query.telegramBots.findFirst).not.toHaveBeenCalled();
      expect(botServiceConstructors).toHaveLength(0);
    });
  });

  // 9. Isolamento estrito em retryAccessDelivery
  describe("9. Isolamento estrito em retryAccessDelivery", () => {
    it("9a. retryAccessDelivery rejeita produto com bot ausente ou de outra loja sem recorrer a bot padrão", async () => {
      const mockAccess = {
        id: "acc-retry-1",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        product: { id: "prod-1", botId: botAlien.id, deliveryValue: "-10012345", deliveryType: "telegram" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
      };

      vi.mocked(db.query.accesses.findFirst).mockResolvedValue(mockAccess as any);
      vi.mocked(db.query.stores.findFirst).mockResolvedValue(storeA as any);
      // Não encontra o botAlien no escopo de storeA
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      await expect(
        AccessDeliveryService.retryAccessDelivery("acc-retry-1", storeA.id)
      ).rejects.toThrow("Bot vinculado ao produto não encontrado ou não está ativo nesta loja.");

      // Confirma que não tentou usar botA nem botAlien
      expect(botServiceConstructors).toHaveLength(0);
    });

    it("9b. retryAccessDelivery utiliza estritamente o bot vinculado quando válido", async () => {
      const mockAccess = {
        id: "acc-retry-2",
        storeId: storeA.id,
        customerId: "cust-1",
        productId: "prod-1",
        product: { id: "prod-1", botId: botB.id, title: "Curso Bot B", deliveryValue: "-10012345", deliveryType: "telegram" },
        customer: { id: "cust-1", telegramUserId: "user-tg-1" },
      };

      vi.mocked(db.query.accesses.findFirst).mockResolvedValue(mockAccess as any);
      vi.mocked(db.query.stores.findFirst).mockResolvedValue(storeA as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botB as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "acc-retry-2" }]),
        }),
      } as any);

      const result = await AccessDeliveryService.retryAccessDelivery("acc-retry-2", storeA.id);

      expect(result.status).toBe("ACTIVE");
      expect(TelegramDeliveryService.validateBotAndChatPermission).toHaveBeenCalledWith(
        "decrypted-enc-token-b",
        "-10012345",
        botB.botId
      );
      expect(TelegramDeliveryService.validateBotAndChatPermission).not.toHaveBeenCalledWith(
        "decrypted-enc-token-a",
        expect.anything(),
        expect.anything()
      );
    });
  });
});
