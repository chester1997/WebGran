import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import { clearProcessedTelegramUpdatesForTest } from "@/lib/telegram/update-dedup";

// Mocks
const mockResolveFromSecretToken = vi.fn();
const mockResolveFromBotId = vi.fn();
const mockHandleCartCommand = vi.fn();
const mockHandleCatalogCommand = vi.fn();
const mockHandleProgressiveOffersCommand = vi.fn();
const mockHandleAccessesCommand = vi.fn();
const mockHandleSupportCommand = vi.fn();
const mockHandleCartCallbackQuery = vi.fn();

vi.mock("@/lib/telegram/resolver", () => ({
  StoreResolver: {
    resolveFromSecretToken: (...args: any[]) => mockResolveFromSecretToken(...args),
    resolveFromBotId: (...args: any[]) => mockResolveFromBotId(...args),
  },
}));

vi.mock("@/lib/telegram/bot", () => ({
  TelegramBotService: class MockBot {
    token: string;
    constructor(token: string) {
      this.token = token;
    }
    sendMessage = vi.fn().mockResolvedValue({});
    sendPhoto = vi.fn().mockResolvedValue({});
    answerCallbackQuery = vi.fn().mockResolvedValue({});
    editMessageText = vi.fn().mockResolvedValue({});
  },
}));

const mockGetInitialBotKeyboard = vi.fn().mockReturnValue({
  inline_keyboard: [
    [{ text: "🛍️ ABRIR LOJA", web_app: { url: "https://webgran.online/miniapp/loja-teste" } }],
    [{ text: "🛒 Carrinho", callback_data: "cart_view" }, { text: "📺 Meus Acessos", callback_data: "my_accesses" }],
    [{ text: "📚 Catálogo", callback_data: "cart_cat" }],
    [{ text: "💬 Suporte", callback_data: "support_info" }],
  ],
});

vi.mock("@/lib/telegram/bot-cart-handler", () => ({
  handleCartCommand: (...args: any[]) => mockHandleCartCommand(...args),
  handleCatalogCommand: (...args: any[]) => mockHandleCatalogCommand(...args),
  handleCombosCommand: vi.fn(),
  handleProgressiveOffersCommand: (...args: any[]) => mockHandleProgressiveOffersCommand(...args),
  handleAccessesCommand: (...args: any[]) => mockHandleAccessesCommand(...args),
  handleSupportCommand: (...args: any[]) => mockHandleSupportCommand(...args),
  handleCartCallbackQuery: (...args: any[]) => mockHandleCartCallbackQuery(...args),
  getInitialBotKeyboard: (...args: any[]) => mockGetInitialBotKeyboard(...args),
}));

describe("Telegram Webhook Cart Integration Suite (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedTelegramUpdatesForTest();
  });

  const validResolved = {
    store: {
      id: "store-real-123",
      name: "Loja Teste",
      slug: "loja-teste",
    },
    bot: {
      id: "bot-123",
      buttonText: "Abrir App",
    },
    token: "bot-secret-token-123",
  };

  it("should process /carrinho message and delegate to handleCartCommand", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10001,
      message: {
        message_id: 42,
        chat: { id: 12345, type: "private" },
        from: { id: 98765, first_name: "Comprador", username: "comprador_tg" },
        text: "/carrinho",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleCartCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      12345,
      expect.objectContaining({ id: 98765 })
    );
  });

  it("should process /produtos message and delegate to handleCatalogCommand", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10002,
      message: {
        message_id: 43,
        chat: { id: 12345, type: "private" },
        from: { id: 98765, first_name: "Comprador" },
        text: "/produtos",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleCatalogCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      12345,
      expect.objectContaining({
        id: 98765,
      })
    );
  });

  it("should route cart callback query (e.g. cart_add:uuid) to handleCartCallbackQuery", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);
    mockHandleCartCallbackQuery.mockResolvedValueOnce(true);

    const updatePayload = {
      update_id: 10003,
      callback_query: {
        id: "cb-query-999",
        data: "cart_add:prod-uuid-1",
        from: { id: 98765, first_name: "Comprador" },
        message: {
          message_id: 100,
          chat: { id: 12345 },
        },
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleCartCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      "cb-query-999",
      12345,
      100,
      "cart_add:prod-uuid-1",
      expect.objectContaining({ id: 98765 })
    );
  });

  it("should detect duplicate update_id and return 200 without executing handler twice", async () => {
    mockResolveFromSecretToken.mockResolvedValue(validResolved);

    const updatePayload = {
      update_id: 88888,
      message: {
        message_id: 50,
        chat: { id: 12345 },
        from: { id: 98765 },
        text: "/carrinho",
      },
    };

    // First request
    const req1 = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    expect(mockHandleCartCommand).toHaveBeenCalledTimes(1);

    // Immediate duplicate retry from Telegram
    const req2 = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.duplicate).toBe(true);
    // Did NOT execute handler again
    expect(mockHandleCartCommand).toHaveBeenCalledTimes(1);
  });

  it("should process /ofertas message and delegate to handleProgressiveOffersCommand", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10005,
      message: {
        message_id: 60,
        chat: { id: 12345, type: "private" },
        from: { id: 98765, first_name: "Comprador" },
        text: "/ofertas",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleProgressiveOffersCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      12345
    );
  });

  it("should process prog_ callback and delegate to handleCartCallbackQuery", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10006,
      callback_query: {
        id: "cb-prog-123",
        data: "prog_view",
        message: {
          message_id: 102,
          chat: { id: 12345 },
        },
        from: { id: 98765, first_name: "Comprador" },
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleCartCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      "cb-prog-123",
      12345,
      102,
      "prog_view",
      expect.objectContaining({ id: 98765 })
    );
  });

  it("should process /acessos message and delegate to handleAccessesCommand", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10007,
      message: {
        message_id: 61,
        chat: { id: 12345, type: "private" },
        from: { id: 98765, first_name: "Comprador" },
        text: "/acessos",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleAccessesCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      12345,
      expect.objectContaining({ id: 98765 })
    );
  });

  it("should process /suporte message and delegate to handleSupportCommand", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10008,
      message: {
        message_id: 62,
        chat: { id: 12345, type: "private" },
        from: { id: 98765, first_name: "Comprador" },
        text: "/suporte",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleSupportCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      12345,
      expect.objectContaining({ id: validResolved.store.id })
    );
  });

  it("should process my_accesses and support_info callback queries", async () => {
    mockResolveFromSecretToken.mockResolvedValueOnce(validResolved);

    const updatePayload = {
      update_id: 10009,
      callback_query: {
        id: "cb-acc-999",
        data: "my_accesses",
        message: {
          message_id: 103,
          chat: { id: 12345 },
        },
        from: { id: 98765, first_name: "Comprador" },
      },
    };

    const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "valid-secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockHandleCartCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        store: validResolved.store,
      }),
      "cb-acc-999",
      12345,
      103,
      "my_accesses",
      expect.objectContaining({ id: 98765 })
    );
  });
});
