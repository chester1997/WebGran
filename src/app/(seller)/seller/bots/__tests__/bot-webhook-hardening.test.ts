import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock das dependências externas
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        telegramBots: {
          findFirst: vi.fn(),
        },
        telegramCustomers: {
          findFirst: vi.fn().mockResolvedValue({ id: "cust-1", telegramUserId: "777111" }),
        },
        telegramWebhookUpdates: {
          findFirst: vi.fn(),
        },
      },
      execute: vi.fn(),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(true),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(true),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cust-uuid" }]),
          }),
          returning: vi.fn().mockResolvedValue([{ id: "msg-uuid" }]),
        })),
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

let mockSendMessageImpl: (chatId: string | number, text: string) => Promise<any> = async () => ({
  message_id: 12345,
});

vi.mock("@/lib/telegram/bot", () => ({
  TelegramBotService: vi.fn().mockImplementation(function (this: any) {
    this.sendMessage = vi.fn().mockImplementation((chatId: string | number, text: string) => {
      return mockSendMessageImpl(chatId, text);
    });
    this.sendPhoto = vi.fn().mockResolvedValue({ message_id: 54321 });
    this.answerCallbackQuery = vi.fn().mockResolvedValue(true);
    this.deleteWebhook = vi.fn().mockResolvedValue(true);
  }),
}));

vi.mock("@/lib/telegram/update-dedup", () => ({
  isDuplicateTelegramUpdate: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/telegram/chat-sync", () => ({
  handleMyChatMemberUpdate: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/db";
import { StoreResolver } from "@/lib/telegram/resolver";
import { POST } from "@/app/api/telegram/webhook/route";

describe("WebGran — Hardening de Segurança do Webhook, Controle por Lease e Recuperação", () => {
  const STORE_DATA = {
    id: "store-uuid-1",
    name: "Loja Teste",
    slug: "loja-teste",
    ownerId: "owner-1",
    welcomeMessage: "Bem-vindo!",
    welcomeBanners: [],
  };

  const BOT_WITH_SECRET = {
    id: "bot-uuid-1",
    storeId: STORE_DATA.id,
    botId: "1234567890",
    secretToken: "secret_token_1234567890_abc",
    tokenEncrypted: "enc_1234567890:TOKEN",
    store: STORE_DATA,
  };

  const BOT_LEGACY = {
    id: "bot-uuid-legacy",
    storeId: STORE_DATA.id,
    botId: "9876543210",
    secretToken: null,
    tokenEncrypted: "enc_9876543210:TOKEN",
    store: STORE_DATA,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessageImpl = async () => ({ message_id: 12345 });
  });

  // -------------------------------------------------------------------------
  // 1. AUTENTICAÇÃO E HARDENING DO SECRET TOKEN
  // -------------------------------------------------------------------------
  describe("1. Autenticação e Hardening do Webhook", () => {
    it("rejeita com 403 se bot tem secretToken cadastrado e requisição vem SEM header", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {},
        body: JSON.stringify({ update_id: 1001 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("X-Telegram-Bot-Api-Secret-Token is required");
    }, 20000);

    it("rejeita com 403 se header possui secret divergente do bot (comparação em tempo constante)", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": "wrong_secret_attack",
        },
        body: JSON.stringify({ update_id: 1002 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Invalid secret token");
    });

    it("rejeita com 404 se botIdParam fornecido na URL não existe no banco", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=non_existent_bot", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": "any_secret",
        },
        body: JSON.stringify({ update_id: 1003 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Bot not found");
    });

    it("permite acesso se secretToken for exato e válido", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      vi.mocked(db.execute).mockResolvedValue([{ id: "reservation-uuid", execution_id: "exec-1" }] as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({ update_id: 1004 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("permite fallback por botIdParam para bot legado sem secretToken configurado", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_LEGACY as any);
      vi.mocked(db.execute).mockResolvedValue([{ id: "reservation-uuid", execution_id: "exec-1" }] as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=9876543210", {
        method: "POST",
        headers: {},
        body: JSON.stringify({ update_id: 1005 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. CONTROLE DE EXECUÇÃO POR LEASE, DEDUPLICAÇÃO E RECUPERAÇÃO SEGURA
  // -------------------------------------------------------------------------
  describe("2. Controle de Execução por Lease e Checkpoints", () => {
    it("reserva update inicial com status 'processing', execution_id e step 'reserved'", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      vi.mocked(db.execute).mockResolvedValue([{ id: "res-1", execution_id: "exec-init" }] as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554433,
          message: {
            message_id: 1,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/start",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(db.execute).toHaveBeenCalled(); // Inserção com execution_id e lease_expires_at
    });

    it("descarta update concluído duplicado sem reexecutar comandos (duplicate: true)", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      vi.mocked(db.execute).mockResolvedValue([] as any); // Conflito no insert
      vi.mocked(db.query.telegramWebhookUpdates.findFirst).mockResolvedValue({
        id: "update-uuid-1",
        botId: BOT_WITH_SECRET.id,
        updateId: "554433",
        status: "completed",
        step: "completed",
        leaseExpiresAt: new Date(Date.now() - 5000),
      } as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554433,
          message: {
            message_id: 1,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/start",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.duplicate).toBe(true);
    });

    it("descarta requisições concorrentes enquanto lease está válida (in_progress: true)", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.query.telegramWebhookUpdates.findFirst).mockResolvedValue({
        id: "update-uuid-2",
        botId: BOT_WITH_SECRET.id,
        updateId: "554434",
        status: "processing",
        step: "command_started",
        leaseExpiresAt: new Date(Date.now() + 20000), // Válida por mais 20 segundos
      } as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554434,
          message: {
            message_id: 2,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/help",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.in_progress).toBe(true);
    });

    it("recupera update com lease expirada via atualização condicional otimista", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      // 1. Falha no insert (já existe)
      // 2. Sucesso no update condicional (recuperou a lease expirada)
      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any) // insert conflito
        .mockResolvedValueOnce([{ id: "update-uuid-3", execution_id: "new-exec-recovered" }] as any) // update condicional
        .mockResolvedValue({} as any);

      vi.mocked(db.query.telegramWebhookUpdates.findFirst).mockResolvedValue({
        id: "update-uuid-3",
        botId: BOT_WITH_SECRET.id,
        updateId: "554435",
        status: "processing",
        step: "reserved",
        leaseExpiresAt: new Date(Date.now() - 10000), // Expirada há 10s
      } as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554435,
          message: {
            message_id: 3,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/produtos",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("retorna HTTP 503 se colidir com outro worker ao tentar recuperar lease expirada", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      // 1. Falha no insert
      // 2. Falha no update condicional (outro worker pegou no mesmo milissegundo)
      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(db.query.telegramWebhookUpdates.findFirst).mockResolvedValue({
        id: "update-uuid-4",
        botId: BOT_WITH_SECRET.id,
        updateId: "554436",
        status: "processing",
        step: "reserved",
        leaseExpiresAt: new Date(Date.now() - 10000),
      } as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554436,
          message: {
            message_id: 4,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/start",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("Transient conflict acquiring update lease");
    });

    it("bloqueia repetição automática se etapa anterior foi 'ambiguous_external_failure'", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_WITH_SECRET as any);
      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.query.telegramWebhookUpdates.findFirst).mockResolvedValue({
        id: "update-uuid-5",
        botId: BOT_WITH_SECRET.id,
        updateId: "554437",
        status: "failed",
        step: "ambiguous_external_failure",
        leaseExpiresAt: new Date(Date.now() - 10000),
      } as any);

      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 554437,
          message: {
            message_id: 5,
            from: { id: 777111, first_name: "Cliente" },
            chat: { id: 777111 },
            text: "/start",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.ambiguous).toBe(true);
    });
  });

  describe("3. Homologação Inbound Isolada e Mensagens Conversacionais", () => {
    it("bloqueia homologação inbound se _isHomologationTest estiver em produção", async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";

        const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
          method: "POST",
          headers: {
            "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
          },
          body: JSON.stringify({
            update_id: 990011,
            _isHomologationTest: true,
            message: {
              message_id: 1,
              from: { id: 1795655200 },
              chat: { id: 1795655200 },
              text: "Teste inbound",
            },
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toContain("Homologation mode disabled in production");
      } finally {
        (process.env as any).NODE_ENV = prevEnv;
      }
    });

    it("bloqueia homologação inbound se _isHomologationTest vier de Chat ID não autorizado", async () => {
      const req = new NextRequest("https://webgran.com/api/telegram/webhook?botId=1234567890", {
        method: "POST",
        headers: {
          "x-telegram-bot-api-secret-token": BOT_WITH_SECRET.secretToken,
        },
        body: JSON.stringify({
          update_id: 990012,
          _isHomologationTest: true,
          message: {
            message_id: 1,
            from: { id: 888999000 },
            chat: { id: 888999000 },
            text: "Teste inbound não autorizado",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Inbound homologation allowed only for authorized owner Chat ID");
    });
  });
});
