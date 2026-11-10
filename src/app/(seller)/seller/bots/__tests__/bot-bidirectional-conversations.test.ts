import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// In-memory data store para teste de persistência e isolamento multi-bot
let inMemoryMessages: any[] = [];
let inMemoryCustomers: any[] = [];

// Mock das dependências externas
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  getCurrentStore: vi.fn(),
  requireSeller: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        telegramBots: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        telegramCustomers: {
          findFirst: vi.fn().mockImplementation(() => inMemoryCustomers[0] || null),
          findMany: vi.fn().mockImplementation(() => [...inMemoryCustomers]),
        },
        telegramMessages: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockImplementation(() => [...inMemoryMessages]),
        },
        telegramWebhookUpdates: {
          findFirst: vi.fn(),
        },
      },
      execute: vi.fn().mockResolvedValue([{ id: "trans-id" }]),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(true),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((val: any) => {
          return {
            onConflictDoNothing: vi.fn().mockImplementation(() => {
              const isDuplicate = inMemoryMessages.some(
                (m) => m.telegramUpdateId && m.telegramUpdateId === val.telegramUpdateId
              );
              if (!isDuplicate) {
                inMemoryMessages.push({ ...val, id: val.id || `msg-${Date.now()}-${Math.random()}` });
              }
              return Promise.resolve(true);
            }),
            onConflictDoUpdate: vi.fn().mockImplementation(() => {
              return {
                returning: vi.fn().mockResolvedValue([val]),
              };
            }),
            returning: vi.fn().mockImplementation(() => {
              const inserted = { ...val, id: val.id || `msg-${Date.now()}` };
              inMemoryMessages.push(inserted);
              return Promise.resolve([inserted]);
            }),
          };
        }),
      })),
    },
  };
});

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val: string) => `enc_${val}`),
  decrypt: vi.fn((val: string) => val.replace(/^enc_/, "")),
}));

vi.mock("@/lib/telegram/resolver", () => ({
  StoreResolver: {
    resolveFromSecretToken: vi.fn(),
    resolveFromBotId: vi.fn(),
  },
}));

vi.mock("@/lib/telegram/bot", () => ({
  TelegramBotService: vi.fn().mockImplementation(function (this: any) {
    this.sendMessage = vi.fn().mockResolvedValue({ message_id: 112233 });
    this.setWebhook = vi.fn().mockResolvedValue(true);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Imports reais do sistema
import { POST } from "@/app/api/telegram/webhook/route";
import {
  getBotCustomerMessagesAction,
  getBotCustomersAction,
  syncBotWebhookAction
} from "../actions";
import { getCurrentUser, getCurrentStore, requireSeller } from "@/lib/auth";
import { db } from "@/db";

const OWNER_USER = {
  id: "ead2ec50-ac72-4917-9d9c-1c68de270070",
  email: "lf49127@gmail.com",
  role: "admin",
};

const STORE_ID = "store-abc-123";
const BOT_A_UUID = "bot-uuid-aaaa-1111";
const BOT_A_TG_ID = "88990011";
const BOT_A_SECRET = "secret_token_bot_a_abcdef1234567890abcdef1234567890";

const BOT_B_UUID = "bot-uuid-bbbb-2222";
const BOT_B_TG_ID = "99887766";
const BOT_B_SECRET = "secret_token_bot_b_1234567890abcdef1234567890abcdef";

const BOT_A_DATA = {
  id: BOT_A_UUID,
  botId: BOT_A_TG_ID,
  storeId: STORE_ID,
  username: "bot_a",
  displayName: "Bot Alpha",
  tokenEncrypted: "enc_123456:BOT_A_TOKEN",
  secretToken: BOT_A_SECRET,
  store: { id: STORE_ID, slug: "loja-teste" },
};

const BOT_B_DATA = {
  id: BOT_B_UUID,
  botId: BOT_B_TG_ID,
  storeId: STORE_ID,
  username: "bot_b",
  displayName: "Bot Beta",
  tokenEncrypted: "enc_654321:BOT_B_TOKEN",
  secretToken: BOT_B_SECRET,
  store: { id: STORE_ID, slug: "loja-teste" },
};

const CUSTOMER_A = {
  id: "cust-uuid-1",
  storeId: STORE_ID,
  telegramUserId: "111222333",
  username: "cliente_joao",
  firstName: "João",
  lastName: "Silva",
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-09T20:00:00Z"),
};

const CUSTOMER_B = {
  id: "cust-uuid-2",
  storeId: STORE_ID,
  telegramUserId: "444555666",
  username: "cliente_maria",
  firstName: "Maria",
  lastName: "Oliveira",
  createdAt: new Date("2026-11-02T10:00:00Z"),
  updatedAt: new Date("2026-11-09T20:00:00Z"),
};

describe("WebGran Bots — Comunicação Bidirecional e Webhook Inbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryMessages = [];
    inMemoryCustomers = [CUSTOMER_A, CUSTOMER_B];

    vi.mocked(getCurrentUser).mockResolvedValue(OWNER_USER as any);
    vi.mocked(requireSeller).mockResolvedValue(OWNER_USER as any);
    vi.mocked(getCurrentStore).mockResolvedValue({
      id: STORE_ID,
      ownerId: OWNER_USER.id,
      name: "Loja Teste",
      slug: "loja-teste",
    } as any);

    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValue(CUSTOMER_A as any);
  });

  // Cenário 1 & 2: Cliente envia texto pelo Telegram, webhook recebe e persiste
  it("1 e 2. Recebe mensagem inbound de texto pelo webhook e persiste em telegramMessages", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);

    const updatePayload = {
      update_id: 887711,
      message: {
        message_id: 101,
        from: { id: 111222333, first_name: "João", username: "cliente_joao" },
        chat: { id: 111222333, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "Olá! Gostaria de saber como funciona o acesso.",
      },
    };

    const req = new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=${BOT_A_TG_ID}`, {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": BOT_A_SECRET,
        "content-type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const saved = inMemoryMessages.find((m) => m.text?.includes("como funciona o acesso"));
    expect(saved).toBeDefined();
    expect(saved.direction).toBe("inbound");
    expect(saved.messageType).toBe("text");
    expect(saved.status).toBe("delivered");
    expect(saved.telegramUserId).toBe("111222333");
  });

  // Cenário 3: Mensagem aparece na conversa correta
  it("3. Retorna a mensagem inbound na conversa do cliente através de getBotCustomerMessagesAction", async () => {
    inMemoryMessages.push({
      id: "msg-inbound-1",
      storeId: STORE_ID,
      botId: BOT_A_UUID,
      customerId: CUSTOMER_A.id,
      telegramUserId: CUSTOMER_A.telegramUserId,
      direction: "inbound",
      messageType: "text",
      status: "delivered",
      createdAt: new Date(),
    });

    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValue(CUSTOMER_A as any);
    vi.mocked(db.query.telegramMessages.findMany).mockResolvedValue([
      {
        id: "msg-inbound-1",
        direction: "inbound",
        messageType: "text",
        text: "Mensagem recebida do cliente",
        status: "delivered",
        createdAt: new Date(),
      }
    ] as any);

    const res = await getBotCustomerMessagesAction({
      botId: BOT_A_UUID,
      customerId: CUSTOMER_A.id,
    });

    expect(res.success).toBe(true);
    expect(res.data?.messages.length).toBe(1);
    expect(res.data?.messages[0].direction).toBe("inbound");
    expect(res.data?.messages[0].text).toBe("Mensagem recebida do cliente");
  });

  // Cenário 4: Dois bots diferentes recebem mensagens sem misturar clientes ou conversas
  it("4. Garante isolamento estrito: Bot A e Bot B não misturam conversas de clientes", async () => {
    // 1. Envio para Bot A
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);
    const reqA = new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=${BOT_A_TG_ID}`, {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": BOT_A_SECRET },
      body: JSON.stringify({
        update_id: 10001,
        message: {
          message_id: 501,
          from: { id: 111222333, first_name: "João" },
          chat: { id: 111222333 },
          text: "Mensagem para Bot A",
        },
      }),
    });
    await POST(reqA);

    // 2. Envio para Bot B
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_B_DATA as any);
    const reqB = new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=${BOT_B_TG_ID}`, {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": BOT_B_SECRET },
      body: JSON.stringify({
        update_id: 10002,
        message: {
          message_id: 502,
          from: { id: 444555666, first_name: "Maria" },
          chat: { id: 444555666 },
          text: "Mensagem para Bot B",
        },
      }),
    });
    await POST(reqB);

    const msgA = inMemoryMessages.find((m) => m.text === "Mensagem para Bot A");
    const msgB = inMemoryMessages.find((m) => m.text === "Mensagem para Bot B");

    expect(msgA).toBeDefined();
    expect(msgB).toBeDefined();
    expect(msgA.botId).toBe(BOT_A_UUID);
    expect(msgB.botId).toBe(BOT_B_UUID);
    expect(msgA.botId).not.toBe(msgB.botId);
  });

  // Cenário 5: Telegram reenvia o mesmo update e não ocorre duplicidade
  it("5. Deduplica updates reenviados pelo Telegram sem duplicar mensagens", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);

    const duplicatePayload = {
      update_id: 999111,
      message: {
        message_id: 701,
        from: { id: 111222333, first_name: "João" },
        chat: { id: 111222333 },
        text: "Mensagem com retry automático",
      },
    };

    const makeReq = () =>
      new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=${BOT_A_TG_ID}`, {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": BOT_A_SECRET },
        body: JSON.stringify(duplicatePayload),
      });

    const res1 = await POST(makeReq());
    expect(res1.status).toBe(200);

    const res2 = await POST(makeReq());
    expect(res2.status).toBe(200);

    const occurrences = inMemoryMessages.filter((m) => m.telegramUpdateId === "999111");
    expect(occurrences.length).toBe(1);
  });

  // Cenário 6: Webhook com secret inválido é rejeitado
  it("6. Rejeita requisição com 403 se o secretToken for divergente", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);

    const req = new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=${BOT_A_TG_ID}`, {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "secret_falso_hacker" },
      body: JSON.stringify({ update_id: 222333 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Invalid secret token");
  });

  // Cenário 7: Mensagem com identificação incompleta é tratada com segurança
  it("7. Trata com segurança requisição para botId inexistente retornando 404", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

    const req = new NextRequest(`https://www.webgran.online/api/telegram/webhook?botId=bot_fantasma_999`, {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "qualquer_secret" },
      body: JSON.stringify({ update_id: 444111 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  // Cenário 8: Sincronização e autoteste do webhook via syncBotWebhookAction
  it("8. syncBotWebhookAction valida e re-registra o webhook no Telegram com os parâmetros corretos", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);

    const res = await syncBotWebhookAction(BOT_A_UUID);
    expect(res.success).toBe(true);
    expect(res.data?.webhookUrl).toContain(`botId=${BOT_A_TG_ID}`);
  });

  // Cenário 9: Interface atualiza a conversa e a lista de clientes sem recarregar a página
  it("9. getBotCustomersAction retorna a lista de clientes atualizada com a última mensagem inbound no topo", async () => {
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_A_DATA as any);

    const recentDate = new Date("2026-11-10T00:08:00Z");
    const olderDate = new Date("2026-11-09T10:00:00Z");

    const mockMessages = [
      {
        id: "m-1",
        storeId: STORE_ID,
        botId: BOT_A_UUID,
        telegramUserId: CUSTOMER_A.telegramUserId,
        direction: "inbound",
        messageType: "text",
        text: "Olá! Quero comprar.",
        createdAt: recentDate,
      },
      {
        id: "m-2",
        storeId: STORE_ID,
        botId: BOT_A_UUID,
        telegramUserId: CUSTOMER_B.telegramUserId,
        direction: "inbound",
        messageType: "text",
        text: "Mensagem antiga",
        createdAt: olderDate,
      },
    ];

    vi.mocked(db.query.telegramCustomers.findMany).mockResolvedValue([CUSTOMER_B, CUSTOMER_A] as any);
    vi.mocked(db.query.telegramMessages.findMany).mockResolvedValue(mockMessages as any);

    const res = await getBotCustomersAction(BOT_A_UUID);
    expect(res.success).toBe(true);
    expect(res.data?.customers.length).toBe(2);

    // Cliente A com mensagem mais recente deve estar no topo
    expect(res.data?.customers[0].id).toBe(CUSTOMER_A.id);
    expect(res.data?.customers[0].lastMessageText).toBe("Olá! Quero comprar.");
    expect(res.data?.customers[0].lastMessageDirection).toBe("inbound");
  });
});
