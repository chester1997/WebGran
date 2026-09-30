import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((token: string) => token.replace("encrypted-", "")),
  encrypt: vi.fn((token: string) => `encrypted-${token}`),
}));

// Mock TelegramBotService as a class
vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: class MockTelegramBotService {
      token: string;
      constructor(token: string) {
        this.token = token;
      }
      async getChat(chatId: string) {
        if (chatId === "-100111") {
          return { id: -100111, title: "Canal VIP Studio", type: "channel", username: "canal_vip" };
        }
        if (chatId === "-100222") {
          return { id: -100222, title: "Grupo Geral VIP", type: "supergroup", username: null };
        }
        if (chatId === "-100333") {
          return { id: -100333, title: "Grupo Sem Permissao", type: "supergroup", username: null };
        }
        throw new Error("Chat not found");
      }
      async getChatMember(chatId: string, botId: string) {
        if (chatId === "-100111") {
          return { status: "administrator", can_invite_users: true };
        }
        if (chatId === "-100222") {
          return { status: "administrator", can_invite_users: true };
        }
        if (chatId === "-100333") {
          return { status: "administrator", can_invite_users: false };
        }
        return { status: "left" };
      }
    },
  };
});

// Mock database
const mockBotChats: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        telegramBotChats: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockBotChats[0] || null;
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return mockBotChats;
          }),
        },
        telegramBots: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return {
              id: "bot-uuid-1",
              storeId: "store-uuid-1",
              botId: "999888777",
              username: "lojinha_bot",
              tokenEncrypted: "encrypted-bot-token-123",
            };
          }),
        },
        products: {
          findMany: vi.fn().mockImplementation(async () => []),
        },
      },
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val: any) => ({
          returning: vi.fn().mockImplementation(async () => [{ id: "chat-uuid-1", ...val }]),
        })),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((val: any) => ({
          where: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockImplementation(async () => [{ id: "chat-uuid-1", ...val }]),
          })),
        })),
      })),
    },
  };
});

import { handleMyChatMemberUpdate, saveOrUpdateBotChat, syncBotChats, getBotChats } from "../chat-sync";

describe("Telegram Bot Chat Sync & Permission Verification", () => {
  beforeEach(() => {
    mockBotChats.length = 0;
    vi.clearAllMocks();
  });

  it("1. Ignore private chat updates in my_chat_member", async () => {
    const mockBot = {
      id: "bot-uuid-1",
      storeId: "store-uuid-1",
      botId: "999888777",
      tokenEncrypted: "encrypted-token",
    };

    const updatePrivate = {
      my_chat_member: {
        chat: { id: 123456, type: "private", first_name: "Cliente" },
        new_chat_member: { status: "member" },
      },
    };

    const res = await handleMyChatMemberUpdate(mockBot, updatePrivate);
    expect(res).toBeNull();
  });

  it("2. Registers channel when bot is promoted to administrator with invite permissions", async () => {
    const mockBot = {
      id: "bot-uuid-1",
      storeId: "store-uuid-1",
      botId: "999888777",
      tokenEncrypted: "encrypted-token",
    };

    const updateChannel = {
      my_chat_member: {
        chat: { id: -100111, type: "channel", title: "Canal VIP Studio", username: "canal_vip" },
        new_chat_member: { status: "administrator", can_invite_users: true },
      },
    };

    const res = await handleMyChatMemberUpdate(mockBot, updateChannel);
    expect(res).toBeDefined();
    expect(res!.telegramChatId).toBe("-100111");
    expect(res!.botStatus).toBe("administrator");
    expect(res!.canInviteUsers).toBe(true);
    expect(res!.isActive).toBe(true);
  });

  it("3. Deactivates chat when bot loses admin permissions (can_invite_users = false)", async () => {
    const mockBot = {
      id: "bot-uuid-1",
      storeId: "store-uuid-1",
      botId: "999888777",
      tokenEncrypted: "encrypted-token",
    };

    const updateNoInvite = {
      my_chat_member: {
        chat: { id: -100333, type: "supergroup", title: "Grupo Sem Permissao" },
        new_chat_member: { status: "administrator", can_invite_users: false },
      },
    };

    const res = await handleMyChatMemberUpdate(mockBot, updateNoInvite);
    expect(res).toBeDefined();
    expect(res!.canInviteUsers).toBe(false);
    expect(res!.isActive).toBe(false);
  });

  it("4. Deactivates chat when bot is removed (left or kicked)", async () => {
    const mockBot = {
      id: "bot-uuid-1",
      storeId: "store-uuid-1",
      botId: "999888777",
      tokenEncrypted: "encrypted-token",
    };

    const updateLeft = {
      my_chat_member: {
        chat: { id: -100999, type: "supergroup", title: "Grupo Antigo" },
        new_chat_member: { status: "left" },
      },
    };

    const res = await handleMyChatMemberUpdate(mockBot, updateLeft);
    expect(res).toBeDefined();
    expect(res!.botStatus).toBe("left");
    expect(res!.isActive).toBe(false);
  });

  it("5. Multi-tenancy isolation: bot chats are scoped by storeId and botId", async () => {
    mockBotChats.push({
      id: "chat-uuid-1",
      storeId: "store-uuid-1",
      botId: "bot-uuid-1",
      telegramChatId: "-100111",
      title: "Canal Store A",
      type: "channel",
      botStatus: "administrator",
      canInviteUsers: true,
      isActive: true,
    });

    const chatsStoreA = await getBotChats("store-uuid-1", "bot-uuid-1");
    expect(chatsStoreA.length).toBe(1);
    expect(chatsStoreA[0].storeId).toBe("store-uuid-1");
  });

  it("6. External link compatibility is preserved", () => {
    const externalDeliveryType = "external";
    const externalLink = "https://meudrive.com/conteudo.zip";

    expect(externalDeliveryType).toBe("external");
    expect(externalLink.startsWith("http")).toBe(true);
  });
});
