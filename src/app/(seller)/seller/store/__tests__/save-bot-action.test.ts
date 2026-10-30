import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveBotAction } from "../actions";
import { encrypt } from "@/lib/encryption";

let mockStore: any = null;
let mockBotsInDb: any[] = [];
let telegramApiMock: any = {};

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn().mockImplementation(async () => ({ id: "seller-1", email: "seller@test.com" })),
  getCurrentStore: vi.fn().mockImplementation(async () => mockStore),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockImplementation(async (sellerId: string, feature: string) => {
    if (feature === "telegram_bot") return true;
    return false;
  }),
}));

vi.mock("@/lib/telegram/bot", () => {
  class MockTelegramBotService {
    token: string;
    constructor(token: string) {
      this.token = token;
      if (telegramApiMock.throwOnConstructor) {
        throw new Error("Invalid token in constructor");
      }
    }

    async getMe() {
      if (telegramApiMock.throwOnGetMe) {
        throw new Error("Telegram 401 Unauthorized: Invalid Token");
      }
      if (telegramApiMock.networkError) {
        throw new Error("Fetch failed: ETIMEDOUT");
      }
      return { id: 123456789, username: "teste_bot", first_name: "Bot de Teste" };
    }

    async setWebhook(url: string, secret: string) {
      if (telegramApiMock.throwOnSetWebhook) {
        throw new Error("Webhook setup failed");
      }
      return true;
    }

    async setChatMenuButton() {
      return true;
    }

    async getProfilePhotoUrl() {
      return "https://telegram.org/photo.jpg";
    }
  }

  return {
    TelegramBotService: MockTelegramBotService,
  };
});

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
    },
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          if (mockStore && updates.name !== undefined) mockStore.name = updates.name;
          if (mockStore && updates.logoUrl !== undefined) mockStore.logoUrl = updates.logoUrl;
          return [updates];
        }),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(async (vals: any) => {
        mockBotsInDb.push({
          ...vals,
          id: "bot-new-id",
        });
        return [vals];
      }),
    })),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("saveBotAction Suite (React #441 Prevention & Full Lifecycle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telegramApiMock = {};
    mockStore = {
      id: "store-1",
      ownerId: "seller-1",
      name: "Minha Loja Original",
      slug: "minha-loja",
      logoUrl: "https://cdn.webgran.com/old-logo.webp",
    };
    mockBotsInDb = [];
  });

  it("1. Cadastra bot com token válido com sucesso e atualiza dados da loja", async () => {
    const formData = new FormData();
    formData.set("token", "123456789:ABCDEF_valid_token_xyz");
    formData.set("buttonName", "Comprar Agora");
    formData.set("name", "Nova Loja VIP");
    formData.set("logoUrl", "https://cdn.webgran.com/new-logo.webp");
    formData.set("color", "#A855F7");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(true);
    expect(res.message).toContain("Bot configurado com sucesso");
    expect(mockStore.name).toBe("Nova Loja VIP");
    expect(mockStore.logoUrl).toBe("https://cdn.webgran.com/new-logo.webp");
    expect(mockBotsInDb.length).toBe(1);
    expect(mockBotsInDb[0].botId).toBe("123456789");
    expect(mockBotsInDb[0].username).toBe("teste_bot");
    expect(mockBotsInDb[0].buttonText).toBe("Comprar Agora");
  });

  it("2. Retorna erro amigável em caso de token inválido sem lançar exceção não tratada", async () => {
    telegramApiMock.throwOnGetMe = true;

    const formData = new FormData();
    formData.set("token", "123456789:INVALID_TOKEN");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toBe("Token do Telegram inválido ou não autorizado. Verifique o token fornecido pelo @BotFather.");
    // Não expõe o token na mensagem de erro
    expect(res.error).not.toContain("123456789:INVALID_TOKEN");
  });

  it("3. Atualiza bot já existente na mesma loja sem violar constraint", async () => {
    const existingInStore = {
      id: "bot-existing",
      storeId: "store-1",
      botId: "123456789",
      username: "teste_bot",
      tokenEncrypted: encrypt("123456789:old_token"),
      secretToken: "secret_1",
      buttonText: "Abrir",
      photoUrl: "https://old.jpg",
    };
    const dbModule = await import("@/db");
    const findFirstMock = vi.mocked(dbModule.db.query.telegramBots.findFirst) as any;
    findFirstMock.mockResolvedValueOnce(null); // botInOtherStore -> null
    findFirstMock.mockResolvedValueOnce(existingInStore); // existingBotInStore -> found

    const formData = new FormData();
    formData.set("token", "123456789:ABCDEF_fresh_token");
    formData.set("buttonName", "Acessar Loja");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(true);
    expect(res.message).toContain("Bot configurado com sucesso");
  });

  it("4. Impede associação de bot pertencente a outra loja e informa o usuário", async () => {
    const botOtherStore = {
      id: "bot-other",
      storeId: "store-2", // Outra loja
      botId: "123456789",
      username: "teste_bot",
    };
    const dbModule = await import("@/db");
    const findFirstMock = vi.mocked(dbModule.db.query.telegramBots.findFirst) as any;
    findFirstMock.mockResolvedValueOnce(botOtherStore); // botInOtherStore

    const formData = new FormData();
    formData.set("token", "123456789:ABCDEF_token");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Este bot já está vinculado a outra loja no WebGran");
  });

  it("5. Trata falha de comunicação com o Telegram (webhook ou rede) com retorno estruturado", async () => {
    telegramApiMock.throwOnSetWebhook = true;

    const formData = new FormData();
    formData.set("token", "123456789:ABCDEF_token");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Não foi possível registrar o webhook no Telegram");
  });

  it("6. Preserva dados atuais da loja quando campos de personalização não forem alterados ou vazios", async () => {
    const formData = new FormData();
    formData.set("token", "123456789:ABCDEF_valid_token");
    formData.set("name", ""); // Vazio
    formData.set("logoUrl", ""); // Vazio

    const res = await saveBotAction(formData);

    expect(res.success).toBe(true);
    expect(mockStore.name).toBe("Minha Loja Original");
    expect(mockStore.logoUrl).toBe("https://cdn.webgran.com/old-logo.webp");
  });

  it("7. Edição de bot existente sem informar novo token preserva token e atualiza configurações", async () => {
    const existingInStore = {
      id: "bot-existing-1",
      storeId: "store-1",
      botId: "123456789",
      username: "teste_bot",
      tokenEncrypted: encrypt("123456789:existing_token"),
      secretToken: "secret_old",
      buttonText: "Abrir Antigo",
      photoUrl: "https://old.jpg",
    };
    const dbModule = await import("@/db");
    const findFirstMock = vi.mocked(dbModule.db.query.telegramBots.findFirst) as any;
    findFirstMock.mockResolvedValueOnce(existingInStore);

    const formData = new FormData();
    formData.set("token", "••••••••••••••••••••••••"); // Máscara do campo
    formData.set("existingBotId", "bot-existing-1");
    formData.set("buttonName", "Novo Botão App");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(true);
    expect(res.message).toContain("Bot configurado com sucesso");
  });

  it("8. Rejeita submissão sem token ao adicionar novo bot", async () => {
    const formData = new FormData();
    formData.set("token", "");

    const res = await saveBotAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toBe("O Token do Bot é obrigatório para cadastrar um novo bot.");
  });
});
