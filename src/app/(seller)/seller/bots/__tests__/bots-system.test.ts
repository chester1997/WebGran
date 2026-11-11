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
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-bot-uuid" }]),
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
          id: 1234567890,
          username: "test_webgran_bot",
          first_name: "Test Bot Display",
        };
      });
      this.setWebhook = vi.fn().mockResolvedValue(true);
      this.setChatMenuButton = vi.fn().mockResolvedValue(true);
      this.getProfilePhotoUrl = vi.fn().mockResolvedValue(null);
      this.deleteWebhook = vi.fn().mockResolvedValue(true);
    }),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";
import { 
  validateBotTokenAction, 
  createNewBotAction, 
  toggleBotStatusAction, 
  renameBotAction, 
  deleteBotAction 
} from "../actions";

describe("WebGran — Sistema de Gerenciamento de Bots (Fases B & C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. ISOLAMENTO DO PROPRIETÁRIO
  describe("1. Isolamento Exclusivo do Proprietário no Backend", () => {
    it("bloqueia validateBotTokenAction para vendedores comuns", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "outro-vendedor-id",
        email: "vendedor@outro.com",
        name: "Outro Vendedor",
        role: "seller",
      });

      const res = await validateBotTokenAction("123456:ABC-VALID-TOKEN");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito ao proprietário");
    });

    it("bloqueia createNewBotAction para vendedores comuns", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "outro-vendedor-id",
        email: "vendedor@outro.com",
        name: "Outro Vendedor",
        role: "seller",
      });

      const res = await createNewBotAction({
        token: "123456:ABC-VALID-TOKEN",
        mode: "MINI_APP",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso restrito ao proprietário");
    });

    it("autoriza o proprietário real pelo ID único", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        name: "STUDIO ADM",
        role: "admin",
      });
      vi.mocked(getCurrentStore).mockResolvedValue({
        id: "store-owner-id",
        slug: "studio-shorts-6025",
        name: "APP STD",
      } as any);

      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

      const res = await validateBotTokenAction("123456:VALID_TELEGRAM_TOKEN");
      expect(res.success).toBe(true);
      expect(res.data?.username).toBe("test_webgran_bot");
      expect(res.data?.numericId).toBe("1234567890");
    });
  });

  // 2. VALIDAÇÃO DE TOKENS E TRATAMENTO DE ERROS
  describe("2. Validação e Segurança de Tokens", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        name: "STUDIO ADM",
        role: "admin",
      });
      vi.mocked(getCurrentStore).mockResolvedValue({
        id: "store-owner-id",
        slug: "studio-shorts-6025",
        name: "APP STD",
      } as any);
    });

    it("rejeita tokens malformados sem dois pontos ou vazios", async () => {
      const res = await validateBotTokenAction("token_invalido_sem_formato");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Formato de token inválido");
    });

    it("rejeita token inválido rejeitado pela API do Telegram", async () => {
      const res = await validateBotTokenAction("12345:invalid_secret_token");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Não foi possível validar o token junto ao Telegram");
    });

    it("impede conexão se o bot já pertencer a outra loja cadastrada no banco", async () => {
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({
        id: "bot-outro-uuid",
        storeId: "outra-loja-uuid",
        botId: "1234567890",
      } as any);

      const res = await validateBotTokenAction("123456:TOKEN_DUPLICADO");
      expect(res.success).toBe(false);
      expect(res.error).toContain("vinculado a outra loja no WebGran");
    });
  });

  // 3. SELEÇÃO DO MODO DE VENDA (PADRÃO / VENDA NA CONVERSA VS MINI APP EM BREVE)
  describe("3. Seleção de Modos de Funcionamento", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        name: "STUDIO ADM",
        role: "admin",
      });
      vi.mocked(getCurrentStore).mockResolvedValue({
        id: "store-owner-id",
        slug: "studio-shorts-6025",
        name: "APP STD",
      } as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);
    });

    it("rejeita modos não autorizados ou inválidos", async () => {
      const res = await createNewBotAction({
        token: "123456:VALID_TOKEN",
        mode: "BASICO" as any,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Modo de venda inválido");
    });

    it("rejeita modo MINI_APP indicando que estará disponível em breve", async () => {
      const res = await createNewBotAction({
        token: "123456:VALID_TOKEN",
        mode: "MINI_APP",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Mini App) estará disponível em breve");
    });

    it("conclui o cadastro com sucesso no modo PADRAO (Venda na conversa)", async () => {
      const res = await createNewBotAction({
        token: "123456:VALID_TOKEN",
        mode: "PADRAO",
        buttonText: "Conversa",
      });

      expect(res.success).toBe(true);
      expect(res.data?.botId).toBe("new-bot-uuid");
      expect(res.data?.slug).toBe("studio-shorts-6025");
      expect(res.data?.bot?.mode).toBe("PADRAO");
    });
  });

  // 4. AÇÕES DE GERENCIAMENTO (STATUS, RENOMEAR, EXCLUIR)
  describe("4. Ações de Gerenciamento do Bot", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        name: "STUDIO ADM",
        role: "admin",
      });
      vi.mocked(getCurrentStore).mockResolvedValue({
        id: "store-owner-id",
        slug: "studio-shorts-6025",
        name: "APP STD",
      } as any);
      vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue({
        id: "bot-uuid",
        storeId: "store-owner-id",
        username: "test_bot",
        displayName: "Apelido Antigo",
        tokenEncrypted: "iv:cifrado",
      } as any);
    });

    it("pausa e reativa o bot com sucesso", async () => {
      const resPause = await toggleBotStatusAction("bot-uuid", "paused");
      expect(resPause.success).toBe(true);
      expect(resPause.message).toContain("pausado com sucesso");

      const resActive = await toggleBotStatusAction("bot-uuid", "active");
      expect(resActive.success).toBe(true);
      expect(resActive.message).toContain("reativado com sucesso");
    });

    it("renomeia o apelido do bot", async () => {
      const res = await renameBotAction("bot-uuid", "Novo Apelido do Bot");
      expect(res.success).toBe(true);
      expect(res.message).toContain("Apelido atualizado");
    });

    it("exclui o bot e desvincula produtos", async () => {
      const res = await deleteBotAction("bot-uuid");
      expect(res.success).toBe(true);
      expect(res.message).toContain("excluído com sucesso");
    });
  });
});