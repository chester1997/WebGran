import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
export const mockFindFirstAccess = vi.fn();
export const mockFindFirstBot = vi.fn();
export const mockUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      accesses: {
        findFirst: (...args: any[]) => mockFindFirstAccess(...args),
      },
      telegramBots: {
        findFirst: (...args: any[]) => mockFindFirstBot(...args),
      },
      productVideoAssignments: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      productVideos: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

// Mock Encryption
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockImplementation((val: string) => `decrypted-${val}`),
}));

// Mock TelegramDeliveryService
export const mockCheckBuyerMembership = vi.fn();
export const mockCreateTelegramInvite = vi.fn();

vi.mock("@/lib/delivery/telegram-delivery-service", () => ({
  TelegramDeliveryService: {
    checkBuyerMembership: (...args: any[]) => mockCheckBuyerMembership(...args),
    createTelegramInvite: (...args: any[]) => mockCreateTelegramInvite(...args),
  },
}));

import { AccessLifecycleService } from "../access-lifecycle-service";

describe("AccessLifecycleService — Bot Resolution, Invite Preservation & Isolation Regression Suite", () => {
  const storeA = { id: "store-a", slug: "store-a-slug", bots: [] };
  const storeB = { id: "store-b", slug: "store-b-slug", bots: [] };

  const botA1 = {
    id: "bot-a1",
    storeId: "store-a",
    botId: "111111",
    username: "bot_a1",
    tokenEncrypted: "token-a1",
    status: "active",
  };

  const botA2 = {
    id: "bot-a2",
    storeId: "store-a",
    botId: "222222",
    username: "bot_a2",
    tokenEncrypted: "token-a2",
    status: "active",
  };

  const botAInactive = {
    id: "bot-a-inactive",
    storeId: "store-a",
    botId: "333333",
    username: "bot_a_inactive",
    tokenEncrypted: "token-a-inactive",
    status: "inactive",
  };

  const botAlien = {
    id: "bot-alien",
    storeId: "store-b",
    botId: "999999",
    username: "bot_alien",
    tokenEncrypted: "token-alien",
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBuyerMembership.mockResolvedValue(false);
    mockCreateTelegramInvite.mockResolvedValue({
      inviteLink: "https://t.me/+freshInvite",
      expireDate: 1800000000,
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  // 1. Produto com bot específico: resolve exclusivamente o bot vinculado
  it("1. Produto com bot específico resolve exclusivamente esse bot e gera convite com seu token", async () => {
    const access = {
      id: "acc-1",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-1",
        title: "Dorama VIP",
        botId: "bot-a2", // Vinculado especificamente ao bot A2
        deliveryType: "telegram",
        deliveryValue: "-100123",
        duration: "monthly",
      },
      inviteLink: null,
      inviteExpiresAt: null,
    };

    mockFindFirstAccess.mockResolvedValue(access);
    // Simula a busca estrita com botId = bot-a2 e storeId = store-a
    mockFindFirstBot.mockResolvedValue(botA2);

    const result = await AccessLifecycleService.resolveAccessDestination("acc-1", "store-a-slug");

    expect(result.success).toBe(true);
    expect(result.destinationType).toBe("INVITE");
    expect(result.destinationUrl).toBe("https://t.me/+freshInvite");
    // Verifica que createTelegramInvite recebeu o token descriptografado do botA2
    expect(mockCreateTelegramInvite).toHaveBeenCalledWith(
      "decrypted-token-a2",
      "-100123",
      "Dorama VIP",
      undefined,
      expect.any(Number)
    );
  });

  // 2. Produto sem bot específico (Loja Geral): seleciona bot ativo da mesma loja
  it("2. Produto sem bot específico (botId nulo) seleciona bot ativo da mesma loja", async () => {
    const storeWithActiveBot = {
      ...storeA,
      bots: [botA1],
    };

    const access = {
      id: "acc-2",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: null, // lifetime
      store: storeWithActiveBot,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-2",
        title: "Conteúdo Global",
        botId: null, // Global
        deliveryType: "telegram",
        deliveryValue: "-100123",
        duration: "lifetime",
      },
      inviteLink: null,
      inviteExpiresAt: null,
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(botA1);

    const result = await AccessLifecycleService.resolveAccessDestination("acc-2", "store-a-slug");

    expect(result.success).toBe(true);
    expect(mockCreateTelegramInvite).toHaveBeenCalledWith(
      "decrypted-token-a1",
      "-100123",
      "Conteúdo Global",
      undefined,
      undefined // sem expiração pois é lifetime
    );
  });

  // 3. Bot específico ausente / não encontrado: retorna erro sem fallback
  it("3. Bot vinculado ao produto não encontrado retorna erro seguro sem fazer fallback para outro bot da loja", async () => {
    const storeWithOtherBots = {
      ...storeA,
      bots: [botA1], // Há o botA1 na loja, mas o produto exige bot-inexistente!
    };

    const access = {
      id: "acc-3",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeWithOtherBots,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-3",
        title: "Produto Órfão",
        botId: "bot-inexistente",
        deliveryType: "telegram",
        deliveryValue: "-100123",
      },
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(null); // Não encontra bot-inexistente na store-a

    const result = await AccessLifecycleService.resolveAccessDestination("acc-3", "store-a-slug");

    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("Bot vinculado ao produto não foi encontrado");
    expect(mockCreateTelegramInvite).not.toHaveBeenCalled();
  });

  // 4. Bot específico inativo: retorna erro sem fallback
  it("4. Bot vinculado ao produto inativo retorna erro sem fazer fallback silencioso", async () => {
    const access = {
      id: "acc-4",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-4",
        title: "Produto Bot Inativo",
        botId: "bot-a-inactive",
        deliveryType: "telegram",
        deliveryValue: "-100123",
      },
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(botAInactive); // Encontra bot com status: 'inactive'

    const result = await AccessLifecycleService.resolveAccessDestination("acc-4", "store-a-slug");

    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("Bot vinculado ao produto não está ativo nesta loja.");
    expect(mockCreateTelegramInvite).not.toHaveBeenCalled();
  });

  // 5. Preservação de convite válido com data futura de expiração
  it("5. Preserva convite existente válido (inviteExpiresAt no futuro) sem invocar createChatInviteLink", async () => {
    const futureInviteDate = new Date(Date.now() + 3600000); // 1 hora no futuro
    const access = {
      id: "acc-5",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-5",
        title: "Produto com Convite Válido",
        botId: "bot-a1",
        deliveryType: "telegram",
        deliveryValue: "-100123",
      },
      inviteLink: "https://t.me/+existingValidInvite",
      inviteExpiresAt: futureInviteDate,
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(botA1);

    const result = await AccessLifecycleService.resolveAccessDestination("acc-5", "store-a-slug");

    expect(result.success).toBe(true);
    expect(result.destinationType).toBe("INVITE");
    expect(result.destinationUrl).toBe("https://t.me/+existingValidInvite");
    // Garante que NÃO chamou a API do Telegram desnecessariamente
    expect(mockCreateTelegramInvite).not.toHaveBeenCalled();
  });

  // 6. Preservação de convite existente quando inviteExpiresAt é nulo mas o acesso comercial é válido
  it("6. Preserva convite existente quando inviteExpiresAt é nulo se o acesso comercial estiver autorizado", async () => {
    const access = {
      id: "acc-6",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000), // Acesso comercial ativo
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-6",
        title: "Produto Vitalício / Sem data convite",
        botId: "bot-a1",
        deliveryType: "telegram",
        deliveryValue: "-100123",
      },
      inviteLink: "https://t.me/+existingLegacyInvite",
      inviteExpiresAt: null, // Sem validade registrada no convite
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(botA1);

    const result = await AccessLifecycleService.resolveAccessDestination("acc-6", "store-a-slug");

    expect(result.success).toBe(true);
    expect(result.destinationType).toBe("INVITE");
    expect(result.destinationUrl).toBe("https://t.me/+existingLegacyInvite");
    expect(mockCreateTelegramInvite).not.toHaveBeenCalled();
  });

  // 7. Isolamento entre lojas (Cross-store): bot de outra loja nunca é aceito
  it("7. Isolamento entre lojas: produto com botId de outra loja é rejeitado e não vaza credenciais", async () => {
    const access = {
      id: "acc-7",
      storeId: "store-a",
      telegramChatId: "-100123",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-7",
        title: "Tentativa Cross Store",
        botId: botAlien.id, // Pertence à loja B!
        deliveryType: "telegram",
        deliveryValue: "-100123",
      },
    };

    mockFindFirstAccess.mockResolvedValue(access);
    // A query no banco filtra where: and(eq(telegramBots.id, botAlien.id), eq(telegramBots.storeId, "store-a")) -> retorna null
    mockFindFirstBot.mockResolvedValue(null);

    const result = await AccessLifecycleService.resolveAccessDestination("acc-7", "store-a-slug");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Bot vinculado ao produto não foi encontrado ou não pertence a esta loja.");
    expect(mockCreateTelegramInvite).not.toHaveBeenCalled();
  });

  // 8. Tratamento de erro seguro da API do Telegram (ex: Chat Not Found / Permissão)
  it("8. Falha na chamada createChatInviteLink retorna erro seguro sem trocar de bot silenciosamente", async () => {
    const access = {
      id: "acc-8",
      storeId: "store-a",
      telegramChatId: "-100999",
      expiresAt: new Date(Date.now() + 86400000),
      store: storeA,
      customer: { telegramUserId: "user-1" },
      product: {
        id: "prod-8",
        title: "Produto com Erro TG",
        botId: "bot-a1",
        deliveryType: "telegram",
        deliveryValue: "-100999",
      },
      inviteLink: null,
      inviteExpiresAt: null,
    };

    mockFindFirstAccess.mockResolvedValue(access);
    mockFindFirstBot.mockResolvedValue(botA1);
    mockCreateTelegramInvite.mockRejectedValue(new Error("Bad Request: chat not found"));

    const result = await AccessLifecycleService.resolveAccessDestination("acc-8", "store-a-slug");

    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("Não foi possível gerar o link de acesso ao grupo: Bad Request: chat not found");
  });
});
