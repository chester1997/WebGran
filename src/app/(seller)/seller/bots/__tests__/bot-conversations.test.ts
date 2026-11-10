import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências externas
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  getCurrentStore: vi.fn(),
  requireSeller: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramCustomers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramMessages: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    execute: vi.fn().mockResolvedValue([{ id: "trans-id" }]),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-msg-uuid", createdAt: new Date() }]),
        onConflictDoNothing: vi.fn().mockResolvedValue(true),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "cust-uuid" }]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(true),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val: string) => `enc_${val}`),
  decrypt: vi.fn((val: string) => val.replace(/^enc_/, "")),
}));

let mockSendMessageImpl: (chatId: string | number, text: string) => Promise<any> = async () => ({
  message_id: 998877,
});

let mockSendVoiceImpl = vi.fn().mockResolvedValue({ message_id: 88881 });
let mockSendAudioImpl = vi.fn().mockResolvedValue({ message_id: 88885 });
let mockSendPhotoImpl = vi.fn().mockResolvedValue({ message_id: 88882 });
let mockSendDocImpl = vi.fn().mockResolvedValue({ message_id: 88883 });

vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: vi.fn().mockImplementation(function (this: any, token: string) {
      this.sendMessage = vi.fn().mockImplementation((chatId: string | number, text: string) => {
        return mockSendMessageImpl(chatId, text);
      });
      this.sendVoice = vi.fn().mockImplementation((chatId: string | number, buffer: any, name: string, caption?: string) => {
        return mockSendVoiceImpl(chatId, buffer, name, caption);
      });
      this.sendAudio = vi.fn().mockImplementation((chatId: string | number, buffer: any, name: string, caption?: string) => {
        return mockSendAudioImpl(chatId, buffer, name, caption);
      });
      this.sendPhotoUpload = vi.fn().mockImplementation((chatId: string | number, buffer: any, name: string, caption?: string) => {
        return mockSendPhotoImpl(chatId, buffer, name, caption);
      });
      this.sendDocument = vi.fn().mockImplementation((chatId: string | number, buffer: any, name: string, caption?: string) => {
        return mockSendDocImpl(chatId, buffer, name, caption);
      });
    }),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { 
  getBotCustomerMessagesAction, 
  sendTelegramDirectMessageAction,
  toggleBotCustomerManualModeAction,
} from "../actions";

describe("WebGran — Sistema Real de Conversas do Bot", () => {
  const OWNER_USER = {
    id: "ead2ec50-ac72-4917-9d9c-1c68de270070",
    email: "lf49127@gmail.com",
    role: "admin",
  };

  const NON_OWNER_USER = {
    id: "6baf2bf5-f6b2-43d1-97e2-d4434fc9eaa0",
    email: "seller@outros.com",
    role: "seller",
  };

  const STORE_DATA = {
    id: "27d28329-7e24-4688-b04d-d3587d7d261f",
    slug: "studio-shorts-6025",
    name: "APP STD",
  };

  const BOT_DATA = {
    id: "bot-uuid-1",
    storeId: STORE_DATA.id,
    botId: "8947075264",
    username: "studiioshorts_bot",
    displayName: "STUDIO MINI APP™",
    tokenEncrypted: "enc_8947075264:ABCDEFGHIJKLMN",
    status: "active",
  };

  const CUSTOMER_DATA = {
    id: "cust-uuid-1",
    storeId: STORE_DATA.id,
    telegramUserId: "7088169854",
    username: "hany_lead",
    firstName: "Hany",
    lastName: "Hany",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(OWNER_USER as any);
    vi.mocked(getCurrentStore).mockResolvedValue(STORE_DATA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(BOT_DATA as any);
    vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValue(CUSTOMER_DATA as any);
    mockSendMessageImpl = async () => ({ message_id: 998877 });
  });

  // -------------------------------------------------------------
  // 1. ISOLAMENTO E PROTEÇÃO DE ACESSO
  // -------------------------------------------------------------
  describe("1. Isolamento e Proteção de Acesso", () => {
    it("bloqueia consulta de histórico para vendedor não proprietário", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(NON_OWNER_USER as any);
      const res = await getBotCustomerMessagesAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito");
    });

    it("bloqueia envio de mensagem para vendedor não proprietário", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(NON_OWNER_USER as any);
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        text: "Tentativa de envio não autorizada",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito");
    });

    it("bloqueia acesso se o bot pertencer a outra loja", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);
      const res = await sendTelegramDirectMessageAction({
        botId: "outro-bot",
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        text: "Olá cliente",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Bot não encontrado para esta loja.");
    });

    it("bloqueia acesso se o destinatário pertencer a outra loja", async () => {
      vi.mocked(db.query.telegramCustomers.findFirst).mockResolvedValue(null as any);
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: "outro-cliente",
        clientMessageId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        text: "Olá cliente",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Destinatário não encontrado na loja.");
    });
  });

  // -------------------------------------------------------------
  // 2. CONSULTA DO HISTÓRICO DE MENSAGENS (PAGINAÇÃO E ORDEM)
  // -------------------------------------------------------------
  describe("2. Consulta do Histórico de Mensagens", () => {
    it("retorna mensagens em ordem cronológica com paginação", async () => {
      const mockMsgs = [
        {
          id: "msg-1",
          direction: "inbound",
          messageType: "text",
          text: "Olá, gostaria de saber sobre a assinatura",
          status: "delivered",
          createdAt: new Date("2026-11-04T10:00:00Z"),
          errorMessage: null,
        },
        {
          id: "msg-2",
          direction: "outbound",
          messageType: "text",
          text: "Olá Hany! Temos planos a partir de R$ 9,90",
          status: "sent",
          createdAt: new Date("2026-11-04T10:05:00Z"),
          errorMessage: null,
        },
      ];
      vi.mocked(db.query.telegramMessages.findMany).mockResolvedValue(mockMsgs as any);

      const res = await getBotCustomerMessagesAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        limit: 20,
        offset: 0,
      });

      expect(res.success).toBe(true);
      expect(res.data?.messages.length).toBe(2);
      expect(res.data?.messages[0].direction).toBe("inbound");
      expect(res.data?.messages[1].direction).toBe("outbound");
    });
  });

  // -------------------------------------------------------------
  // 3. ENVIO REAL DE MENSAGENS E PERSISTÊNCIA
  // -------------------------------------------------------------
  describe("3. Envio Real de Mensagens e Persistência", () => {
    const TEST_CLIENT_MSG_ID = "c08bf60e-b7e6-4d1a-8530-1c64073d7f95";

    it("valida que mensagem vazia é rejeitada", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "   ",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("não pode ficar vazio");
    });

    it("valida limite máximo de 4.096 caracteres do Telegram", async () => {
      const longText = "a".repeat(4097);
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: longText,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("4.096 caracteres");
    });

    it("envia mensagem com sucesso e grava com status 'sent'", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "Seu acesso VIP foi liberado!",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(res.data?.telegramMessageId).toBe("998877");
      expect(db.insert).toHaveBeenCalled();
    });

    it("trata erro 403 (usuário bloqueou o bot) e persiste log de falha definitiva", async () => {
      mockSendMessageImpl = async () => {
        const err: any = new Error("Forbidden: bot was blocked by the user");
        err.code = 403;
        throw err;
      };

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "Mensagem para usuário bloqueado",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("bloqueou o bot");
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it("trata erro 400 (chat não encontrado) com mensagem amigável", async () => {
      mockSendMessageImpl = async () => {
        const err: any = new Error("Bad Request: chat not found");
        err.code = 400;
        throw err;
      };

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "Mensagem para chat inexistente",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Chat não encontrado");
    });

    it("trata erro 429 (Too Many Requests / rate limit) com mensagem amigável", async () => {
      mockSendMessageImpl = async () => {
        const err: any = new Error("Too Many Requests: retry after 30");
        err.code = 429;
        throw err;
      };

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "Mensagem sob rate limit",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Limite de mensagens temporariamente excedido");
    });

    it("trata falha de rede/timeout marcando status como 'unknown' e orientando verificação", async () => {
      mockSendMessageImpl = async () => {
        throw new Error("ECONNREFUSED network timeout");
      };

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: TEST_CLIENT_MSG_ID,
        text: "Mensagem durante queda de rede",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("instabilidade de conexão");
      expect(res.error).toContain("Verifique o chat no Telegram antes de tentar reenviar");
    });
  });

  // -------------------------------------------------------------
  // 4. IDEMPOTÊNCIA E HARDENING DE ENVIO OUTBOUND (clientMessageId)
  // -------------------------------------------------------------
  describe("4. Idempotência e Hardening de Envio Outbound (clientMessageId)", () => {
    it("rejeita envio se clientMessageId for ausente ou formato inválido", async () => {
      const res1 = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "",
        text: "Mensagem teste",
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("Identificador de idempotência (clientMessageId) inválido");

      const res2 = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "not-a-valid-uuid",
        text: "Mensagem teste",
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("Identificador de idempotência (clientMessageId) inválido");
    });

    it("não reexecuta envio se mensagem com o mesmo clientMessageId já foi confirmada (status: sent)", async () => {
      const existingSentMsg = {
        id: "msg-already-sent",
        botId: BOT_DATA.id,
        clientMessageId: "e9f0d4ba-7bf8-466d-a6aa-a8da9810bb84",
        status: "sent",
        telegramMessageId: "888123",
        text: "Mensagem já entregue anteriormente",
        createdAt: new Date("2026-11-04T12:00:00Z"),
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(existingSentMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: existingSentMsg.clientMessageId,
        text: "Mensagem já entregue anteriormente",
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("já confirmada e enviada");
      expect(res.data?.id).toBe("msg-already-sent");
      expect(res.data?.telegramMessageId).toBe("888123");
    });

    it("bloqueia retry automático se envio anterior ficou com status 'unknown' para evitar duplicatas", async () => {
      const existingUnknownMsg = {
        id: "msg-timeout",
        botId: BOT_DATA.id,
        clientMessageId: "f1a2b3c4-d5e6-4a7b-8c9d-0e1f2a3b4c5d",
        status: "unknown",
        createdAt: new Date(),
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(existingUnknownMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: existingUnknownMsg.clientMessageId,
        text: "Tentativa de retry cego",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("status do envio anterior não pôde ser confirmado");
      expect(res.error).toContain("verifique a conversa no Telegram");
    });

    it("rejeita requisição se status estiver como 'pending' recente (concorrência em andamento)", async () => {
      const existingPendingMsg = {
        id: "msg-pending",
        botId: BOT_DATA.id,
        clientMessageId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        status: "pending",
        createdAt: new Date(), // recente (< 30s)
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(existingPendingMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: existingPendingMsg.clientMessageId,
        text: "Tentativa paralela",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("já está em processamento de envio");
    });

    it("recupera 'pending' abandonado há mais de 30s antes de virar sending", async () => {
      const abandonedPendingMsg = {
        id: "msg-pending-abandoned",
        botId: BOT_DATA.id,
        clientMessageId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        status: "pending",
        createdAt: new Date(Date.now() - 40 * 1000), // abandonado há 40s
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(abandonedPendingMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: abandonedPendingMsg.clientMessageId,
        text: "Recuperando envio pendente abandonado",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(db.update).toHaveBeenCalled();
    });

    it("marca 'sending' abandonado há mais de 30s como 'unknown' e bloqueia retry cego", async () => {
      const abandonedSendingMsg = {
        id: "msg-sending-abandoned",
        botId: BOT_DATA.id,
        clientMessageId: "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f",
        status: "sending",
        sendingAt: new Date(Date.now() - 45 * 1000), // abandonado em sending há 45s
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(abandonedSendingMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: abandonedSendingMsg.clientMessageId,
        text: "Tentativa sobre sending abandonado",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("resultado desconhecido");
      expect(res.error).toContain("Verifique a conversa no Telegram");
      expect(db.update).toHaveBeenCalled(); // Marcado como 'unknown'
    });

    it("permite retry explícito de mensagem com falha definitiva (429) usando o mesmo clientMessageId", async () => {
      const previousFailedMsg = {
        id: "msg-failed-429",
        botId: BOT_DATA.id,
        clientMessageId: "d4e5f6a7-b8c9-4d0e-8f2a-3b4c5d6e7f8a",
        status: "failed",
        errorMessage: "Limite de mensagens temporariamente excedido pelo Telegram (Rate Limit).",
        createdAt: new Date("2026-11-04T12:00:00Z"),
      };

      vi.mocked(db.query.telegramMessages.findFirst).mockResolvedValue(previousFailedMsg as any);

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: previousFailedMsg.clientMessageId,
        text: "Tentativa explícita de reenvio após liberação de rate limit",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      // Reutilizou o id existente sem tentar um novo INSERT concorrente
      expect(res.data?.id).toBe("msg-failed-429");
    });

    it("bloqueia envio se destinatário não corresponder ao AUTHORIZED_TEST_CHAT_ID configurado", async () => {
      const prevEnv = process.env.AUTHORIZED_TEST_CHAT_ID;
      const prevNodeEnv = process.env.NODE_ENV;
      try {
        process.env.AUTHORIZED_TEST_CHAT_ID = "999888777";
        (process.env as any).NODE_ENV = "development";

        const res = await sendTelegramDirectMessageAction({
          botId: BOT_DATA.id,
          customerId: CUSTOMER_DATA.id, // targetChatId é "11223344", divergente de "999888777"
          clientMessageId: "12345678-1234-4234-8234-123456789012",
          text: "Mensagem para cliente não autorizado",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("[ISOLAMENTO DE SEGURANÇA]");
        expect(res.error).toContain("Apenas a conta pessoal do operador pode receber mensagens");
      } finally {
        process.env.AUTHORIZED_TEST_CHAT_ID = prevEnv;
        (process.env as any).NODE_ENV = prevNodeEnv;
      }
    });
  });

  // -------------------------------------------------------------
  // 4. ATENDIMENTO MANUAL E MULTIMÍDIA
  // -------------------------------------------------------------
  describe("4. Atendimento Manual e Multimídia", () => {
    it("ativa modo manual e insere evento de sistema na timeline com expiração", async () => {
      const res = await toggleBotCustomerManualModeAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        enabled: true,
        durationMinutes: 60,
      });

      expect(res.success).toBe(true);
      expect(res.data?.isManualMode).toBe(true);
      expect(res.data?.expiresAt).toBeDefined();
      expect(res.data?.systemMessage.messageType).toBe("system");
      expect(res.data?.systemMessage.text).toContain("Modo manual ativado");
    });

    it("desativa modo manual e insere evento de encerramento", async () => {
      const res = await toggleBotCustomerManualModeAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        enabled: false,
      });

      expect(res.success).toBe(true);
      expect(res.data?.isManualMode).toBe(false);
      expect(res.data?.systemMessage.text).toBe("Modo manual desativado");
    });

    it("detecta modo manual ativo ao carregar mensagens do cliente", async () => {
      const mockMsgs = [
        {
          id: "sys-1",
          direction: "outbound",
          messageType: "system",
          text: "Modo manual ativado até 20:00",
          status: "delivered",
          createdAt: new Date(),
          metadata: {
            event: "manual_mode_toggle",
            enabled: true,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        },
      ];
      vi.mocked(db.query.telegramMessages.findMany).mockResolvedValue(mockMsgs as any);

      const res = await getBotCustomerMessagesAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
      });

      expect(res.success).toBe(true);
      expect(res.data?.isManualMode).toBe(true);
      expect(res.data?.manualModeExpiresAt).toBeDefined();
    });

    it("envia mensagem de voz/áudio com sucesso", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "b08bf60e-b7e6-4d1a-8530-1c64073d7f96",
        mediaType: "voice",
        mediaBase64: Buffer.from("fake-audio-data").toString("base64"),
        mediaName: "voice_note.ogg",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(res.data?.messageType).toBe("voice");
      expect(mockSendVoiceImpl).toHaveBeenCalled();
    });

    it("envia imagem/foto com sucesso", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "c08bf60e-b7e6-4d1a-8530-1c64073d7f97",
        mediaType: "photo",
        mediaBase64: Buffer.from("fake-image-data").toString("base64"),
        mediaName: "banner.png",
        text: "Veja o novo produto",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(res.data?.messageType).toBe("photo");
      expect(mockSendPhotoImpl).toHaveBeenCalled();
    });

    it("envia documento com sucesso", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "d08bf60e-b7e6-4d1a-8530-1c64073d7f98",
        mediaType: "document",
        mediaBase64: Buffer.from("fake-doc-data").toString("base64"),
        mediaName: "catalogo.pdf",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(res.data?.messageType).toBe("document");
      expect(mockSendDocImpl).toHaveBeenCalled();
    });

    it("rejeita arquivo executável potencialmente perigoso", async () => {
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "e08bf60e-b7e6-4d1a-8530-1c64073d7f99",
        mediaType: "document",
        mediaBase64: Buffer.from("malicious-code").toString("base64"),
        mediaName: "trojan.exe",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("não permitida");
    });

    it("rejeita anexo maior que o limite de 20MB", async () => {
      // 21 MB payload
      const hugeBuffer = Buffer.alloc(21 * 1024 * 1024);
      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "f08bf60e-b7e6-4d1a-8530-1c64073d7f00",
        mediaType: "document",
        mediaBase64: hugeBuffer.toString("base64"),
        mediaName: "huge.zip",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("20 MB");
    });

    it("executa fallback gracioso para documento se sendVoice for recusado por formato incompatível", async () => {
      mockSendVoiceImpl.mockRejectedValueOnce(new Error("Bad Request: wrong file format"));
      mockSendDocImpl.mockResolvedValueOnce({ message_id: 998877 });

      const res = await sendTelegramDirectMessageAction({
        botId: BOT_DATA.id,
        customerId: CUSTOMER_DATA.id,
        clientMessageId: "a18bf60e-b7e6-4d1a-8530-1c64073d7f01",
        mediaType: "voice",
        mediaBase64: Buffer.from("webm-opus-data").toString("base64"),
        mediaName: "recording.webm",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("sent");
      expect(mockSendDocImpl).toHaveBeenCalled();
    });
  });
});

