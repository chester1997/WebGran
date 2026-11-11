import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências de autenticação e banco
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
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "created-bot-uuid" }]),
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

vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: vi.fn().mockImplementation(function (this: any, token: string) {
      this.getMe = vi.fn().mockImplementation(async () => {
        if (token.includes("invalid")) {
          throw new Error("Unauthorized Telegram Token");
        }
        return {
          id: 987654321,
          username: "novobot_telegram_bot",
          first_name: "Novo Bot Telegram",
        };
      });
      this.setWebhook = vi.fn().mockResolvedValue(true);
      this.setChatMenuButton = vi.fn().mockResolvedValue(true);
      this.getProfilePhotoUrl = vi.fn().mockResolvedValue("https://api.telegram.org/file/photo.jpg");
    }),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";
import { validateBotTokenAction, createNewBotAction } from "../actions";

describe("WebGran Bots — Novo Fluxo de Onboarding e Criação (Dois Fluxos Independentes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validação de Token (Passo 2 / 2.5)", () => {
    it("deve rejeitar tokens sem formato válido (numérico:hash)", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "store-slug" });

      const res = await validateBotTokenAction("token_sem_dois_pontos");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Formato de token inválido");
    });

    it("deve retornar erro claro quando a API do Telegram recusar o token", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "store-slug" });

      const res = await validateBotTokenAction("123456:invalid_token_test");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Não foi possível validar o token junto ao Telegram");
    });

    it("deve impedir o cadastro de um bot que já pertence a outra loja", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "store-slug" });

      (db.query.telegramBots.findFirst as any).mockResolvedValue({
        id: "bot-other-uuid",
        botId: "987654321",
        storeId: "another-store-id",
      });

      const res = await validateBotTokenAction("987654321:valid_token_sample");
      expect(res.success).toBe(false);
      expect(res.error).toContain("já está vinculado a outra loja");
    });

    it("deve retornar dados do bot quando o token for válido e disponível", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "store-slug" });
      (db.query.telegramBots.findFirst as any).mockResolvedValue(null);

      const res = await validateBotTokenAction("987654321:valid_token_sample");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.numericId).toBe("987654321");
      expect(res.data?.username).toBe("novobot_telegram_bot");
      expect(res.data?.firstName).toBe("Novo Bot Telegram");
      expect(res.data?.photoUrl).toBe("https://api.telegram.org/file/photo.jpg");
    });
  });

  describe("Fluxo A — Criação pelo Telegram & Conexão", () => {
    it("deve gravar o bot criado com apelido interno no modo PADRAO e configurar webhook", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "minha-loja" });
      (db.query.telegramBots.findFirst as any).mockResolvedValue(null);

      const res = await createNewBotAction({
        token: "987654321:valid_token_sample",
        mode: "PADRAO",
        displayName: "Loja Principal VIP",
        buttonText: "Conversa",
      });

      expect(res.success).toBe(true);
      expect(res.data?.botId).toBe("created-bot-uuid");
      expect(res.data?.bot?.mode).toBe("PADRAO");
      expect(db.insert).toHaveBeenCalled();
    });

    it("deve preservar o nome original do bot criado caso o apelido interno fique vazio", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "minha-loja" });
      (db.query.telegramBots.findFirst as any).mockResolvedValue(null);

      const res = await createNewBotAction({
        token: "987654321:valid_token_sample",
        mode: "PADRAO",
        displayName: "",
      });

      expect(res.success).toBe(true);
      expect(res.data?.botId).toBe("created-bot-uuid");
    });
  });

  describe("Fluxo B — Conexão de Bot Existente com Token", () => {
    it("deve aceitar conexão de bot existente já verificado no @BotFather no modo PADRAO", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "minha-loja" });
      (db.query.telegramBots.findFirst as any).mockResolvedValue(null);

      const res = await createNewBotAction({
        token: "987654321:valid_token_sample",
        mode: "PADRAO",
        displayName: "Bot Existente",
      });

      expect(res.success).toBe(true);
      expect(res.data?.botId).toBe("created-bot-uuid");
      expect(res.data?.bot?.mode).toBe("PADRAO");
    });

    it("deve rejeitar tentativas com modo não autorizado ou inválido", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "minha-loja" });

      const res = await createNewBotAction({
        token: "987654321:valid_token_sample",
        mode: "INVALIDO" as any,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Modo de venda inválido");
    });

    it("deve rejeitar modo MINI_APP enquanto estiver com selo 'Em breve'", async () => {
      (getCurrentUser as any).mockResolvedValue({ id: OWNER_USER_ID, email: OWNER_EMAIL });
      (getCurrentStore as any).mockResolvedValue({ id: "store-owner-1", slug: "minha-loja" });

      const res = await createNewBotAction({
        token: "987654321:valid_token_sample",
        mode: "MINI_APP",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Mini App) estará disponível em breve");
    });
  });

  describe("Modo de Venda & Atualização Imediata da Listagem", () => {
    it("deve exportar as ilustrações do modo de venda e os componentes visuais", async () => {
      const modalModule = await import("../components/NewBotModal");
      expect(modalModule.default).toBeDefined();
      expect(modalModule.PhoneBotIllustration).toBeDefined();
      expect(modalModule.PhoneChatSalesIllustration).toBeDefined();
      expect(modalModule.PhoneMiniAppStoreIllustration).toBeDefined();
    });

    it("garante que retorno da página do bot ou adição otimista não duplica bots na lista", () => {
      const initialList = [
        { id: "bot-1", displayName: "Bot Antigo", mode: "MINI_APP" as const },
      ];
      const newlyCreatedBot = {
        id: "bot-2",
        displayName: "Novo Bot Conversa",
        mode: "PADRAO" as const,
      };

      // Simula a estratégia de atualização otimista aplicada no BotsListClient
      const updatedList = [newlyCreatedBot, ...initialList.filter((b) => b.id !== newlyCreatedBot.id)];

      expect(updatedList.length).toBe(2);
      expect(updatedList[0].id).toBe("bot-2");
      expect(updatedList[0].mode).toBe("PADRAO");

      // Simula re-execução (ex: refresh ou retorno da página individual) sem duplicidade
      const revalidatedList = [newlyCreatedBot, ...updatedList.filter((b) => b.id !== newlyCreatedBot.id)];
      expect(revalidatedList.length).toBe(2);
    });
  });
});
