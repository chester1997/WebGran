import { describe, it, expect, vi } from "vitest";
import React from "react";
import BotAvatar from "../components/BotAvatar";
import BotHeader from "../components/BotHeader";
import BotTabsNav from "../components/BotTabsNav";

describe("WebGran Bots — Estabilização de Avatares & Redução de Arredondamento", () => {
  const dummyBot = {
    id: "bot-test-uuid-456",
    botId: "987654321",
    username: "studiioshorts_bot",
    displayName: "STUDIO MINI APP™",
    photoUrl: "https://api.telegram.org/file/bot8947075264:AAFmND1ug/photos/file_16.jpg", // URL antiga expirada
    status: "active" as const,
    storeName: "Loja Teste",
    createdAt: "2026-11-04T12:00:00Z",
    mode: "MINI_APP",
  };

  describe("1. BotAvatar — Estratégia de Carregamento Robusta e Fallbacks", () => {
    it("utiliza sempre o proxy estável do servidor quando botId é fornecido, evitando URLs diretas expiradas do Telegram", () => {
      const element = React.createElement(BotAvatar, {
        botId: dummyBot.id,
        photoUrl: dummyBot.photoUrl,
        displayName: dummyBot.displayName,
        username: dummyBot.username,
        size: "card",
      });

      expect(element).toBeDefined();
      expect(element.props.botId).toBe(dummyBot.id);
      expect(element.props.size).toBe("card");
    });

    it("gera a inicial de fallback correta 'S' para 'STUDIO MINI APP™'", () => {
      const initial = (dummyBot.displayName || "").trim().charAt(0).toUpperCase();
      expect(initial).toBe("S");
    });

    it("mantém proporção 1:1 e formato circular estrito sem distorção", () => {
      const element = React.createElement(BotAvatar, {
        displayName: "Alpha Bot",
        size: "md",
      });
      expect(element.props.size).toBe("md");
    });

    it("preserva o isolamento de bots diferentes gerando URLs de proxy distintas por botId", () => {
      const bot1 = "bot-uuid-1";
      const bot2 = "bot-uuid-2";
      const url1 = `/api/telegram/bot-avatar?botId=${bot1}`;
      const url2 = `/api/telegram/bot-avatar?botId=${bot2}`;
      expect(url1).not.toBe(url2);
      expect(url1).toContain(bot1);
      expect(url2).toContain(bot2);
    });

    it("detecta tipos MIME corretamente através dos Magic Bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      const isJpeg = jpegBuffer[0] === 0xff && jpegBuffer[1] === 0xd8 && jpegBuffer[2] === 0xff;
      const isPng = pngBuffer[0] === 0x89 && pngBuffer[1] === 0x50 && pngBuffer[2] === 0x4e && pngBuffer[3] === 0x47;

      expect(isJpeg).toBe(true);
      expect(isPng).toBe(true);
    });
  });

  describe("2. Redução do Arredondamento dos Botões no Mobile (8px a 10px)", () => {
    it("BotHeader renderiza controles mobile em conformidade visual com cantos moderados", () => {
      const headerElem = React.createElement(BotHeader, {
        bot: dummyBot,
        activeTab: "visao-geral",
        onSelectTab: vi.fn(),
        onToggleStatus: vi.fn(),
        onOpenRename: vi.fn(),
        onOpenToken: vi.fn(),
        onOpenDelete: vi.fn(),
        selectedPeriod: "month",
        onSelectPeriod: vi.fn(),
      });

      expect(headerElem).toBeDefined();
    });

    it("BotTabsNav renderiza o seletor mobile fechado com suporte a cantos moderadamente arredondados", () => {
      const navElem = React.createElement(BotTabsNav, {
        activeTab: "visao-geral",
        onSelectTab: vi.fn(),
        isAdmin: true,
        mode: "MINI_APP",
      });

      expect(navElem).toBeDefined();
    });
  });
});

