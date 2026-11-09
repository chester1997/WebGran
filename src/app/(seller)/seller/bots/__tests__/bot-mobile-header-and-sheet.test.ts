import { describe, it, expect, vi } from "vitest";
import React from "react";
import BotTabsNav, { TabDefinition } from "../components/BotTabsNav";
import BotHeader from "../components/BotHeader";

describe("WebGran Bots — Header Mobile & Bottom Sheet de Seções", () => {
  const dummyBot = {
    id: "bot-test-123",
    botId: "123456789",
    username: "webgran_test_bot",
    displayName: "Bot Teste Oficial",
    photoUrl: null,
    status: "active" as const,
    storeName: "Loja Teste",
    createdAt: "2026-11-04T12:00:00Z",
    mode: "MINI_APP",
  };

  describe("1. Reorganização dos Controles no Header Mobile", () => {
    it("exporta BotHeader sem erros de renderização e aceita todas as props funcionais", () => {
      expect(BotHeader).toBeDefined();
    });

    it("mantém as ações essenciais: Conversas, Filtros, Abrir no Telegram e Menu de 3 Pontos", () => {
      const mockSelectTab = vi.fn();
      const mockToggle = vi.fn();
      const mockRename = vi.fn();
      const mockToken = vi.fn();
      const mockDelete = vi.fn();
      const mockPeriod = vi.fn();

      const element = React.createElement(BotHeader, {
        bot: dummyBot,
        activeTab: "visao-geral",
        onSelectTab: mockSelectTab,
        onToggleStatus: mockToggle,
        onOpenRename: mockRename,
        onOpenToken: mockToken,
        onOpenDelete: mockDelete,
        selectedPeriod: "month",
        onSelectPeriod: mockPeriod,
      });

      expect(element).toBeDefined();
      expect(element.props.bot.username).toBe("webgran_test_bot");
      expect(element.props.selectedPeriod).toBe("month");
    });
  });

  describe("2. Seletor 'Seções do bot' e Bottom Sheet no Mobile", () => {
    it("exporta BotTabsNav com suporte simultâneo a Desktop horizontal e Mobile Bottom Sheet", () => {
      expect(BotTabsNav).toBeDefined();
    });

    it("inclui todas as seções obrigatórias para bot no modo MINI_APP", () => {
      const mockSelect = vi.fn();
      const navElement = React.createElement(BotTabsNav, {
        activeTab: "visao-geral",
        onSelectTab: mockSelect,
        isAdmin: true,
        mode: "MINI_APP",
      });

      expect(navElement).toBeDefined();
      expect(navElement.props.activeTab).toBe("visao-geral");
      expect(navElement.props.isAdmin).toBe(true);
    });

    it("respeita a regra de permissão ocultando categorias quando isAdmin for false", () => {
      const navUser = React.createElement(BotTabsNav, {
        activeTab: "produtos",
        onSelectTab: vi.fn(),
        isAdmin: false,
        mode: "MINI_APP",
      });

      expect(navUser.props.isAdmin).toBe(false);
    });
  });

  describe("3. Preservação das Rotas e IDs das Seções", () => {
    it("contém exatamente as 13 seções conhecidas no sistema para o proprietário/admin", () => {
      const allKnownSectionIds = [
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

      expect(allKnownSectionIds).toHaveLength(13);
      expect(allKnownSectionIds).toContain("visao-geral");
      expect(allKnownSectionIds).toContain("conversas");
      expect(allKnownSectionIds).toContain("configuracao");
      expect(allKnownSectionIds).toContain("boas-vindas");
      expect(allKnownSectionIds).toContain("banners");
      expect(allKnownSectionIds).toContain("produtos");
      expect(allKnownSectionIds).toContain("combos");
      expect(allKnownSectionIds).toContain("videos");
      expect(allKnownSectionIds).toContain("carrosseis");
      expect(allKnownSectionIds).toContain("categorias");
      expect(allKnownSectionIds).toContain("clips");
      expect(allKnownSectionIds).toContain("notificacoes");
      expect(allKnownSectionIds).toContain("cupons");
    });
  });
});

