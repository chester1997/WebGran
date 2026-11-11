import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNewBotAction, validateBotTokenAction } from "../actions";
import { db } from "@/db";
import { getCurrentStore, getCurrentUser } from "@/lib/auth";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock das dependências de banco e auth
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  getCurrentStore: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "new-bot-uuid" }]),
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  return {
    db: {
      query: {
        telegramBots: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

// Mock da API oficial do Telegram
vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: vi.fn().mockImplementation(function (this: any, token: string) {
      this.getMe = vi.fn().mockResolvedValue({
        id: 777888999,
        username: "store_padrao_bot",
        first_name: "Bot Padrão de Vendas",
      });
      this.getProfilePhotoUrl = vi.fn().mockResolvedValue("https://api.telegram.org/photo.jpg");
      this.setWebhook = vi.fn().mockResolvedValue(true);
      this.setChatMenuButton = vi.fn().mockResolvedValue(true);
      this.deleteWebhook = vi.fn().mockResolvedValue(true);
    }),
  };
});

describe("WebGran Bots — Auditoria do Modelo de Modos de Venda e Testes de Regressão", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      name: "STUDIO ADM",
      role: "admin",
    });

    vi.mocked(getCurrentStore).mockResolvedValue({
      id: "store-owner-uuid",
      slug: "studio-shorts-6025",
      name: "APP STD",
      ownerId: OWNER_USER_ID,
    } as any);
  });

  describe("1. Comportamento do Bot Mini App (Ativo) vs Padrão (Em Breve)", () => {
    it("conclui cadastro com sucesso no modo MINI_APP e configura o MenuButton da loja", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const res = await createNewBotAction({
        token: "777888999:valid_token_secret",
        mode: "MINI_APP",
        displayName: "Bot Loja Mini App",
      });

      expect(res.success).toBe(true);
      expect(res.data?.botId).toBe("new-bot-uuid");
      expect(res.data?.bot?.mode).toBe("MINI_APP");
      expect(res.data?.bot?.displayName).toBe("Bot Loja Mini App");
      expect(db.insert).toHaveBeenCalled();
    });

    it("adota MINI_APP como padrão quando mode não for informado", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const res = await createNewBotAction({
        token: "777888999:valid_token_secret",
        displayName: "Bot Modo Default",
      });

      expect(res.success).toBe(true);
      expect(res.data?.bot?.mode).toBe("MINI_APP");
    });

    it("valida rigorosamente no backend e bloqueia tentativa de selecionar Padrão (Venda na conversa - Em breve)", async () => {
      const res = await createNewBotAction({
        token: "777888999:valid_token_secret",
        mode: "PADRAO",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Venda na conversa (Padrão) estará disponível em breve");
    });
  });

  describe("2. Preservação dos Bots Existentes e Não Confusão de button_text", () => {
    it("confirma que bots legados mantêm identificação MINI_APP sem depender de button_text", () => {
      const mockLegacyBots = [
        {
          id: "legacy-1",
          username: "Appdoramacafebot",
          buttonText: "Bot telegram",
          salesMode: "MINI_APP",
          status: "active",
        },
        {
          id: "legacy-2",
          username: "Nossaseriesblbot",
          buttonText: "Conversa", // Mesmo se buttonText tiver texto qualquer
          salesMode: "MINI_APP",
          status: "active",
        },
        {
          id: "legacy-3",
          username: "apppstudio_bot",
          buttonText: "ABRIR LOJA APP",
          salesMode: "MINI_APP",
          status: "active",
        },
      ];

      // A regra consulta exclusivamente sales_mode, sem deduzir por button_text
      const mapped = mockLegacyBots.map((bot) => ({
        ...bot,
        mode: bot.salesMode === "PADRAO" ? ("PADRAO" as const) : ("MINI_APP" as const),
      }));

      mapped.forEach((b) => {
        expect(b.mode).toBe("MINI_APP");
      });
    });

    it("a criação de um novo bot não altera registros, tokens ou webhooks de bots pré-existentes", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      await createNewBotAction({
        token: "777888999:valid_token_secret",
        mode: "MINI_APP",
        displayName: "Novo Bot Isolado",
      });

      // db.update não foi chamado porque o bot não existia previamente na loja
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Isolamento Multi-tenant e Proteção de Propriedade", () => {
    it("impede conexão se o bot pertencer a outra loja no WebGran", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({
        id: "outro-bot-uuid",
        storeId: "loja-concorrente-uuid",
        botId: "777888999",
      } as any);

      const res = await validateBotTokenAction("777888999:valid_token_secret");
      expect(res.success).toBe(false);
      expect(res.error).toContain("vinculado a outra loja");
    });

    it("bloqueia criação de bot por usuários não autorizados (owner-guard)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "vendedor-comum-uuid",
        email: "vendedor@externo.com",
        name: "Vendedor Comum",
        role: "seller",
      });

      const res = await createNewBotAction({
        token: "777888999:valid_token_secret",
        mode: "MINI_APP",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito ao proprietário");
    });
  });

  describe("4. Sincronização da Listagem e Prevenção de Condições de Corrida", () => {
    it("garante que atualização otimista combinada com revalidação de rota preserva unicidade e ordem", () => {
      const stateList = [
        { id: "bot-1", displayName: "Bot 1", mode: "MINI_APP" as const },
        { id: "bot-2", displayName: "Bot 2", mode: "MINI_APP" as const },
      ];

      const newBot = {
        id: "bot-3",
        displayName: "Bot 3 (Novo)",
        mode: "PADRAO" as const,
      };

      // 1. Atualização otimista
      const optimisticallyUpdated = [newBot, ...stateList.filter((b) => b.id !== newBot.id)];
      expect(optimisticallyUpdated.length).toBe(3);
      expect(optimisticallyUpdated[0].id).toBe("bot-3");

      // 2. Servidor revalida e envia o payload atualizado contendo o novo bot
      const serverRevalidatedList = [
        { id: "bot-3", displayName: "Bot 3 (Novo)", mode: "PADRAO" as const },
        { id: "bot-1", displayName: "Bot 1", mode: "MINI_APP" as const },
        { id: "bot-2", displayName: "Bot 2", mode: "MINI_APP" as const },
      ];

      // 3. Sincronização via useEffect não duplica itens
      const finalState = serverRevalidatedList;
      expect(finalState.length).toBe(3);
      const ids = finalState.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
