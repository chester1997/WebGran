import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock das dependências de Next e DB
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockDb: any = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };
  return { db: mockDb };
});

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { db } from "@/db";
import BoasVindasPage from "../page";
import WelcomeClientV2, { WelcomeSettings } from "../WelcomeClientV2";
import WelcomeClient from "../WelcomeClient";
import {
  getWelcomeSettingsAction,
  updateWelcomeSettingsAction,
} from "../actions";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

const MOCK_SETTINGS: WelcomeSettings = {
  welcomeMessage: "Olá {nome}, seja muito bem-vindo à nossa loja! 🛍️",
  welcomeBanners: ["https://example.com/banner-welcome.webp"],
  supportType: "telegram",
  supportValue: "Hexafiretv",
};

describe("ETAPA 4.3 — REDESIGN V2 DA PÁGINA DE BOAS-VINDAS (/seller/boas-vindas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getCurrentStore as any).mockResolvedValue({
      id: "store-1",
      name: "Loja Teste Boas-Vindas",
      slug: "loja-teste",
      welcomeMessage: MOCK_SETTINGS.welcomeMessage,
      welcomeBanners: MOCK_SETTINGS.welcomeBanners,
      supportType: MOCK_SETTINGS.supportType,
      supportValue: MOCK_SETTINGS.supportValue,
    });
  });

  describe("1. Isolamento de Segurança no Server Component", () => {
    it("deve renderizar WelcomeClientV2 exclusivamente para o OWNER_USER_ID", async () => {
      (requireSeller as any).mockResolvedValue({
        id: OWNER_USER_ID,
        role: "seller",
        email: "qualquer@email.com",
      });

      const jsx = await BoasVindasPage();
      const html = renderToStaticMarkup(jsx);

      // Elementos do V2 presentes
      expect(html).toContain("Mensagem de boas-vindas");
      expect(html).toContain("Texto de Boas-vindas no Bot");
      expect(html).toContain("+ Inserir {nome}");
      expect(html).toContain("Barra de alterações pendentes");
      expect(html).toContain("Configuração Ativa");
    });

    it("deve renderizar WelcomeClientV2 para admin com OWNER_EMAIL oficial normalizado", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: `  ${OWNER_EMAIL.toUpperCase()}  `,
      });

      const jsx = await BoasVindasPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Mensagem de boas-vindas");
      expect(html).toContain("Texto de Boas-vindas no Bot");
    });

    it("NÃO deve renderizar WelcomeClientV2 para outro admin com e-mail diferente", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "outro-admin-id",
        role: "admin",
        email: "outro.admin@webgran.app",
      });

      const jsx = await BoasVindasPage();
      const html = renderToStaticMarkup(jsx);

      // Deve renderizar versão clássica
      expect(html).not.toContain("+ Inserir {nome}");
      expect(html).not.toContain("Barra de alterações pendentes");
      expect(html).toContain("Mensagem de Boas-vindas no Bot");
    });

    it("NÃO deve renderizar WelcomeClientV2 para vendedor comum", async () => {
      (requireSeller as any).mockResolvedValue({
        id: "vendedor-comum-id",
        role: "seller",
        email: "vendedor@loja.com",
      });

      const jsx = await BoasVindasPage();
      const html = renderToStaticMarkup(jsx);

      expect(html).not.toContain("+ Inserir {nome}");
      expect(html).not.toContain("Barra de alterações pendentes");
      expect(html).toContain("Mensagem de Boas-vindas no Bot");
    });
  });

  describe("2. Renderização do Design System V2 em WelcomeClientV2", () => {
    it("renderiza PageHeader com título, subtítulo, badge de status e ações", () => {
      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={MOCK_SETTINGS} />
      );

      expect(html).toContain("Mensagem de boas-vindas");
      expect(html).toContain("Configure a mensagem e banner automáticos");
      expect(html).toContain("Configuração Ativa");
      expect(html).toContain("Salvar alterações");
    });

    it("renderiza card de mensagem com textarea, contador de caracteres e botão de variável", () => {
      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={MOCK_SETTINGS} />
      );

      expect(html).toContain("Texto de Boas-vindas no Bot");
      expect(html).toContain("+ Inserir {nome}");
      expect(html).toContain("Texto da Mensagem");
      expect(html).toContain("A variável");
      expect(html).toContain("{nome}");

      // Com banner presente, o limite é 1024 caracteres
      expect(html).toContain("/ 1024 caracteres");
    });

    it("renderiza limite de 4096 caracteres quando não há banner anexado", () => {
      const settingsWithoutBanner: WelcomeSettings = {
        ...MOCK_SETTINGS,
        welcomeBanners: [],
      };

      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={settingsWithoutBanner} />
      );

      // Sem banner, o limite do Telegram é 4096 caracteres
      expect(html).toContain("/ 4096 caracteres");
    });

    it("renderiza seção de suporte com seletor segmentado e validação", () => {
      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={MOCK_SETTINGS} />
      );

      expect(html).toContain("Botão de Suporte no Mini App");
      expect(html).toContain("Canal de Atendimento");
      expect(html).toContain("Telegram");
      expect(html).toContain("WhatsApp");
      expect(html).toContain("Link Externo");
      expect(html).toContain("Configuração válida:");
      expect(html).toContain("https://t.me/Hexafiretv");
    });

    it("renderiza seção de banner 16:9 com input e botão de upload", () => {
      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={MOCK_SETTINGS} />
      );

      expect(html).toContain("Banner de Boas-vindas");
      expect(html).toContain("Upload");
      expect(html).toContain("Remover");
      expect(html).toContain("https://example.com/banner-welcome.webp");
      expect(html).toContain("Proporção recomendada");
    });

    it("renderiza UnsavedBar para controle de alterações pendentes", () => {
      const html = renderToStaticMarkup(
        <WelcomeClientV2 initialSettings={MOCK_SETTINGS} />
      );

      expect(html).toContain("Barra de alterações pendentes");
      expect(html).toContain("Salvar alterações");
    });
  });

  describe("3. Regras Comerciais, Entitlements e Limites no Servidor", () => {
    it("bloqueia salvamento quando welcome_bot_message_enabled não estiver liberado", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (hasFeature as any).mockResolvedValue(false);

      await expect(
        updateWelcomeSettingsAction({
          welcomeMessage: "Teste",
        })
      ).rejects.toThrow("A mensagem de boas-vindas do bot não está disponível no seu plano");
    });

    it("rejeita mensagem que excede o limite de 1024 caracteres com banner", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-1",
        welcomeBanners: ["https://example.com/banner.jpg"],
      });
      (hasFeature as any).mockResolvedValue(true);

      const longMessage = "A".repeat(1025);

      await expect(
        updateWelcomeSettingsAction({
          welcomeMessage: longMessage,
          welcomeBanners: ["https://example.com/banner.jpg"],
        })
      ).rejects.toThrow("A mensagem de boas-vindas excede o limite de 1024 caracteres para mensagens com banner.");
    });

    it("permite mensagem de até 4096 caracteres quando não há banner", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-1",
        welcomeBanners: [],
      });
      (hasFeature as any).mockResolvedValue(true);

      const validTextMessage = "A".repeat(3000);

      const res = await updateWelcomeSettingsAction({
        welcomeMessage: validTextMessage,
        welcomeBanners: [],
      });

      expect(res).toEqual({ success: true });
      expect(db.update).toHaveBeenCalled();
    });

    it("rejeita mensagem que excede 4096 caracteres mesmo sem banner", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({
        id: "store-1",
        welcomeBanners: [],
      });
      (hasFeature as any).mockResolvedValue(true);

      const tooLongTextMessage = "A".repeat(4097);

      await expect(
        updateWelcomeSettingsAction({
          welcomeMessage: tooLongTextMessage,
          welcomeBanners: [],
        })
      ).rejects.toThrow("A mensagem de boas-vindas excede o limite de 4096 caracteres para mensagens de texto.");
    });

    it("valida e normaliza a configuração de suporte", async () => {
      (requireSeller as any).mockResolvedValue({ id: "seller-1" });
      (getCurrentStore as any).mockResolvedValue({ id: "store-1" });
      (hasFeature as any).mockResolvedValue(true);

      // Suporte inválido (WhatsApp com letras)
      await expect(
        updateWelcomeSettingsAction({
          supportType: "whatsapp",
          supportValue: "numero_invalido",
        })
      ).rejects.toThrow();

      // Suporte válido
      const res = await updateWelcomeSettingsAction({
        supportType: "telegram",
        supportValue: "@Hexafiretv",
      });

      expect(res).toEqual({ success: true });
      expect(db.update).toHaveBeenCalled();
    });
  });
});
