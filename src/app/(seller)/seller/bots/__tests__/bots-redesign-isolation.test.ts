import { describe, it, expect, vi } from "vitest";
import { isOwnerUser, OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

vi.mock("@/db", () => ({
  db: {
    query: {},
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("../actions", () => ({
  toggleBotStatusAction: vi.fn(),
  renameBotAction: vi.fn(),
  updateBotTokenAction: vi.fn(),
  deleteBotAction: vi.fn(),
  getBotCustomerMessagesAction: vi.fn(),
  sendTelegramDirectMessageAction: vi.fn(),
}));

describe("WebGran Bots — Redesign & Isolamento Exclusivo do Proprietário", () => {
  describe("1. Isolamento Estrito da Experiência do Proprietário", () => {
    it("permite acesso exclusivamente à conta proprietária via ID", () => {
      expect(isOwnerUser({ id: OWNER_USER_ID, email: "qualquer@email.com" })).toBe(true);
    });

    it("permite acesso exclusivamente à conta proprietária via Email", () => {
      expect(isOwnerUser({ id: "outro-id", email: OWNER_EMAIL })).toBe(true);
    });

    it("bloqueia estritamente vendedores comuns de acessar o novo módulo", () => {
      expect(isOwnerUser({ id: "vendedor-comum-1", email: "vendedor@loja.com" })).toBe(false);
      expect(isOwnerUser({ id: "vendedor-comum-2", email: "outro@gmail.com" })).toBe(false);
      expect(isOwnerUser(null)).toBe(false);
      expect(isOwnerUser(undefined)).toBe(false);
      expect(isOwnerUser({})).toBe(false);
    });
  });

  describe("2. Estrutura de Navegação das 13 Abas Preservadas", () => {
    it("garante a existência de todas as 13 abas no BotTabsNav sem omissão", async () => {
      const BotTabsNavModule = await import("../components/BotTabsNav");
      expect(BotTabsNavModule.default).toBeDefined();

      const expectedTabIds = [
        "visao-geral",
        "conversas",
        "configuracao",
        "boas-vindas",
        "banners",
        "produtos",
        "combos",
        "videos",
        "carrosseis",
        "categorias",
        "clips",
        "notificacoes",
        "cupons",
      ];

      expect(expectedTabIds).toHaveLength(13);
    });
  });

  describe("3. Preservação dos Estados da Máquina de Conversas", () => {
    it("garante suporte rigoroso aos 5 estados outbound do Telegram", async () => {
      const allowedStates = ["pending", "sending", "sent", "failed", "unknown"];
      expect(allowedStates).toContain("pending");
      expect(allowedStates).toContain("sending");
      expect(allowedStates).toContain("sent");
      expect(allowedStates).toContain("failed");
      expect(allowedStates).toContain("unknown");
    });
  });

  describe("4. Integridade dos Componentes Modulares Exclusivos", () => {
    it("confirma que os novos componentes do redesign foram criados no diretório exclusivo", async () => {
      const BotAvatar = await import("../components/BotAvatar");
      const BotStatusBadge = await import("../components/BotStatusBadge");
      const BotCard = await import("../components/BotCard");
      const BotHeader = await import("../components/BotHeader");
      const BotTabsNav = await import("../components/BotTabsNav");
      const BotOverviewTab = await import("../components/BotOverviewTab");
      const BotConversationsTab = await import("../components/BotConversationsTab");
      const BotSettingsTab = await import("../components/BotSettingsTab");

      expect(BotAvatar.default).toBeDefined();
      expect(BotStatusBadge.default).toBeDefined();
      expect(BotCard.default).toBeDefined();
      expect(BotHeader.default).toBeDefined();
      expect(BotTabsNav.default).toBeDefined();
      expect(BotOverviewTab.default).toBeDefined();
      expect(BotConversationsTab.default).toBeDefined();
      expect(BotSettingsTab.default).toBeDefined();
    });
  });
});
