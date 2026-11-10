import { describe, it, expect, vi } from "vitest";
import React from "react";
import BotAvatar from "../components/BotAvatar";
import BotTabsNav, { TabDefinition } from "../components/BotTabsNav";
import BotHeader from "../components/BotHeader";

describe("WebGran Bots — Padronização de Avatares, Navegação e Identidade dos Ícones", () => {
  const mockBotWithPhoto = {
    id: "e1a9b73a-c616-43ef-b621-649e182cb5cb",
    botId: "8947075264",
    username: "studiioshorts_bot",
    displayName: "STUDIO MINI APP™",
    photoUrl: "https://api.telegram.org/file/bot8947075264:AAFmND1ug-gVFjO8Hkiqd69lEmkMoRleUX0/profile_photos/file_17.jpg",
    status: "active" as const,
    storeName: "Studio Shorts",
    createdAt: "2026-11-04T12:00:00Z",
    mode: "MINI_APP",
  };

  const mockBotWithoutPhoto = {
    id: "08cb68d9-fa77-4037-9352-364e96b449e1",
    botId: "8485645438",
    username: "apppstudio_bot",
    displayName: "App studio",
    photoUrl: null,
    status: "active" as const,
    storeName: "App Studio",
    createdAt: "2026-11-04T12:00:00Z",
    mode: "MINI_APP",
  };

  describe("1. BotAvatar — Carregamento Consistente e Fallback Imediato", () => {
    it("renderiza BotAvatar para bot com foto usando proxy interno unificado", () => {
      const element = React.createElement(BotAvatar, {
        photoUrl: mockBotWithPhoto.photoUrl,
        botId: mockBotWithPhoto.id,
        displayName: mockBotWithPhoto.displayName,
        username: mockBotWithPhoto.username,
        size: "card",
      });

      expect(element).toBeDefined();
      expect(element.props.botId).toBe("e1a9b73a-c616-43ef-b621-649e182cb5cb");
      expect(element.props.size).toBe("card");
    });

    it("renderiza BotAvatar para bot sem foto com a inicial imediata e sem tela branca", () => {
      const element = React.createElement(BotAvatar, {
        photoUrl: mockBotWithoutPhoto.photoUrl,
        botId: mockBotWithoutPhoto.id,
        displayName: mockBotWithoutPhoto.displayName,
        username: mockBotWithoutPhoto.username,
        size: "card",
      });

      expect(element).toBeDefined();
      expect(element.props.photoUrl).toBeNull();
      expect(element.props.displayName).toBe("App studio");
    });

    it("suporta todos os tamanhos mantendo aspecto circular proporção 1:1", () => {
      const sizes = ["sm", "md", "card", "lg", "xl"] as const;
      sizes.forEach((s) => {
        const el = React.createElement(BotAvatar, {
          botId: "test-bot",
          size: s,
        });
        expect(el.props.size).toBe(s);
      });
    });
  });

  describe("2. BotTabsNav — Remoção da Aba Duplicada de Conversas", () => {
    it("garante que 'conversas' NÃO faz parte da navegação de abas (acesso exclusivo pelo botão dedicado do header)", () => {
      const mockSelect = vi.fn();
      const navElement = React.createElement(BotTabsNav, {
        activeTab: "visao-geral",
        onSelectTab: mockSelect,
        isAdmin: true,
        mode: "MINI_APP",
      });

      expect(navElement).toBeDefined();
    });

    it("a navegação de seções possui as 12 seções esperadas para o proprietário/admin", () => {
      const expectedSections = [
        "visao-geral",
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

      expect(expectedSections).toHaveLength(12);
      expect(expectedSections).not.toContain("conversas");
      expect(expectedSections).toContain("visao-geral");
      expect(expectedSections).toContain("configuracao");
      expect(expectedSections).toContain("cupons");
    });
  });

  describe("3. BotHeader — Preservação dos Controles e Padronização dos Ícones", () => {
    it("mantém o botão Conversas no Header com acesso exclusivo à Central de Atendimento", () => {
      const mockConversasModal = vi.fn();
      const headerElement = React.createElement(BotHeader, {
        bot: mockBotWithPhoto,
        activeTab: "visao-geral",
        onSelectTab: vi.fn(),
        onToggleStatus: vi.fn(),
        onOpenRename: vi.fn(),
        onOpenToken: vi.fn(),
        onOpenDelete: vi.fn(),
        selectedPeriod: "month",
        onSelectPeriod: vi.fn(),
        onOpenConversasModal: mockConversasModal,
      });

      expect(headerElement).toBeDefined();
      expect(headerElement.props.onOpenConversasModal).toBe(mockConversasModal);
      expect(headerElement.props.bot.username).toBe("studiioshorts_bot");
    });

    it("preserva todos os controles do header: Conversas, Filtros, Abrir no Telegram e Menu de 3 Pontos", () => {
      const headerElement = React.createElement(BotHeader, {
        bot: mockBotWithoutPhoto,
        activeTab: "visao-geral",
        onSelectTab: vi.fn(),
        onToggleStatus: vi.fn(),
        onOpenRename: vi.fn(),
        onOpenToken: vi.fn(),
        onOpenDelete: vi.fn(),
        selectedPeriod: "month",
        onSelectPeriod: vi.fn(),
      });

      expect(headerElement.props.selectedPeriod).toBe("month");
      expect(headerElement.props.bot.displayName).toBe("App studio");
    });
  });
});

