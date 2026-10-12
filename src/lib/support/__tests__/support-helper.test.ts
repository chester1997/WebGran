import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateAndNormalizeTelegram,
  validateAndNormalizeWhatsApp,
  validateAndNormalizeExternalLink,
  parseSupportConfig,
  openSupportLink,
} from "../support-helper";

describe("Support Helper & Bottom Nav Support Integration Suite", () => {
  // 4. Telegram com username contendo @ e sem @
  describe("4. Telegram username handling (@ and without @)", () => {
    it("normalizes username with @ and generates direct t.me link", () => {
      const result = validateAndNormalizeTelegram("@Hexafiretv");
      expect(result.isValid).toBe(true);
      expect(result.cleanUsername).toBe("Hexafiretv");
      expect(result.url).toBe("https://t.me/Hexafiretv");
    });

    it("normalizes username without @ and generates direct t.me link", () => {
      const result = validateAndNormalizeTelegram("Hexafiretv");
      expect(result.isValid).toBe(true);
      expect(result.cleanUsername).toBe("Hexafiretv");
      expect(result.url).toBe("https://t.me/Hexafiretv");
    });

    it("handles full t.me link or https://t.me link gracefully", () => {
      const result = validateAndNormalizeTelegram("https://t.me/Hexafiretv");
      expect(result.isValid).toBe(true);
      expect(result.cleanUsername).toBe("Hexafiretv");
      expect(result.url).toBe("https://t.me/Hexafiretv");
    });
  });

  // 5. Username vazio ou com formato inválido
  describe("5. Username vazio ou com formato inválido", () => {
    it("rejects empty string or whitespace only", () => {
      expect(validateAndNormalizeTelegram("").isValid).toBe(false);
      expect(validateAndNormalizeTelegram("   ").isValid).toBe(false);
    });

    it("rejects username shorter than 5 characters", () => {
      const result = validateAndNormalizeTelegram("abc");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("5 e 32");
    });

    it("rejects username longer than 32 characters", () => {
      const tooLong = "a".repeat(33);
      const result = validateAndNormalizeTelegram(tooLong);
      expect(result.isValid).toBe(false);
    });

    it("rejects username with invalid special characters", () => {
      expect(validateAndNormalizeTelegram("@user!name").isValid).toBe(false);
      expect(validateAndNormalizeTelegram("@user-name").isValid).toBe(false);
      expect(validateAndNormalizeTelegram("@user name").isValid).toBe(false);
    });
  });

  // 6. WhatsApp com número formatado e número contendo somente dígitos
  describe("6. WhatsApp com número formatado e contendo somente dígitos", () => {
    it("handles formatted number with spaces, parens, hyphens, and +", () => {
      const result = validateAndNormalizeWhatsApp("+55 (11) 99999-9999");
      expect(result.isValid).toBe(true);
      expect(result.cleanDigits).toBe("5511999999999");
      expect(result.url).toBe("https://wa.me/5511999999999");
    });

    it("handles digits-only number", () => {
      const result = validateAndNormalizeWhatsApp("5511999999999");
      expect(result.isValid).toBe(true);
      expect(result.cleanDigits).toBe("5511999999999");
      expect(result.url).toBe("https://wa.me/5511999999999");
    });

    it("handles international numbers with valid country code", () => {
      // US number with +1: +1 (212) 555-1234
      const result = validateAndNormalizeWhatsApp("+1 212 555 1234");
      expect(result.isValid).toBe(true);
      expect(result.cleanDigits).toBe("12125551234");
      expect(result.url).toBe("https://wa.me/12125551234");
    });
  });

  // 7. Número sem código de país
  describe("7. Número sem código de país", () => {
    it("rejects local 9-digit Brazilian number lacking DDD and country code", () => {
      const result = validateAndNormalizeWhatsApp("999999999");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("código do país e DDD");
    });

    it("rejects Brazilian number with DDD but missing country code 55", () => {
      const result = validateAndNormalizeWhatsApp("11999999999");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Número sem código de país");
    });

    it("rejects formatted Brazilian number with DDD but missing country code", () => {
      const result = validateAndNormalizeWhatsApp("(11) 99999-9999");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Número sem código de país");
    });

    it("does NOT auto-prepend country code or invent destination", () => {
      const raw = "11999999999";
      const result = validateAndNormalizeWhatsApp(raw);
      expect(result.isValid).toBe(false);
      expect(result.url).toBeNull();
    });
  });

  // 8. Link externo HTTPS válido
  describe("8. Link externo HTTPS válido", () => {
    it("accepts valid HTTPS URL", () => {
      const result = validateAndNormalizeExternalLink("https://suporte.exemplo.com/atendimento");
      expect(result.isValid).toBe(true);
      expect(result.url).toBe("https://suporte.exemplo.com/atendimento");
    });

    it("accepts valid HTTP URL", () => {
      const result = validateAndNormalizeExternalLink("http://central.exemplo.com");
      expect(result.isValid).toBe(true);
      expect(result.url).toBe("http://central.exemplo.com/");
    });
  });

  // 9. URL inválida e protocolos perigosos
  describe("9. URL inválida e protocolos perigosos", () => {
    it("rejects javascript: pseudo-protocol", () => {
      const result = validateAndNormalizeExternalLink("javascript:alert(1)");
      expect(result.isValid).toBe(false);
      expect(result.url).toBeNull();
      expect(result.errorMessage).toContain("Protocolo de link não permitido");
    });

    it("rejects data: URI scheme", () => {
      const result = validateAndNormalizeExternalLink("data:text/html,<script>alert(1)</script>");
      expect(result.isValid).toBe(false);
      expect(result.url).toBeNull();
    });

    it("rejects non-URL plain text", () => {
      const result = validateAndNormalizeExternalLink("just plain text");
      expect(result.isValid).toBe(false);
      expect(result.url).toBeNull();
    });
  });

  // 10. Configuração de suporte vazia
  describe("10. Configuração de suporte vazia", () => {
    it("returns isValid = false when supportValue is empty, null or undefined", () => {
      expect(parseSupportConfig("telegram", "").isValid).toBe(false);
      expect(parseSupportConfig("telegram", null).isValid).toBe(false);
      expect(parseSupportConfig("whatsapp", undefined).isValid).toBe(false);
      expect(parseSupportConfig("link", "   ").isValid).toBe(false);
    });

    it("returns null url and openType when invalid or empty", () => {
      const parsed = parseSupportConfig("telegram", "");
      expect(parsed.url).toBeNull();
      expect(parsed.openType).toBeNull();
      expect(parsed.isValid).toBe(false);
    });
  });

  // 11. Isolamento entre lojas e bots
  describe("11. Isolamento entre lojas e bots", () => {
    it("correctly parses separate store configs without bleeding state", () => {
      const storeA = parseSupportConfig("telegram", "@StoreASupport");
      const storeB = parseSupportConfig("whatsapp", "+55 11 98888-7777");
      const storeC = parseSupportConfig("link", "https://help.storec.com");
      const storeD = parseSupportConfig("telegram", "");

      expect(storeA.url).toBe("https://t.me/StoreASupport");
      expect(storeA.openType).toBe("telegram");

      expect(storeB.url).toBe("https://wa.me/5511988887777");
      expect(storeB.openType).toBe("external");

      expect(storeC.url).toBe("https://help.storec.com/");
      expect(storeC.openType).toBe("external");

      expect(storeD.isValid).toBe(false);
      expect(storeD.url).toBeNull();
    });
  });

  // 12. Abertura do destino dentro e fora do Telegram Mini App
  describe("12. Abertura do destino dentro e fora do Telegram Mini App", () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
      vi.restoreAllMocks();
    });

    it("calls tgWebApp.openTelegramLink when in TMA and openType is telegram", () => {
      const openTelegramLinkMock = vi.fn();
      const openLinkMock = vi.fn();

      global.window = {
        Telegram: {
          WebApp: {
            openTelegramLink: openTelegramLinkMock,
            openLink: openLinkMock,
          },
        },
      } as any;

      openSupportLink({
        url: "https://t.me/Hexafiretv",
        openType: "telegram",
      });

      expect(openTelegramLinkMock).toHaveBeenCalledWith("https://t.me/Hexafiretv");
      expect(openLinkMock).not.toHaveBeenCalled();
    });

    it("calls tgWebApp.openLink when in TMA and openType is external (WhatsApp/link)", () => {
      const openTelegramLinkMock = vi.fn();
      const openLinkMock = vi.fn();

      global.window = {
        Telegram: {
          WebApp: {
            openTelegramLink: openTelegramLinkMock,
            openLink: openLinkMock,
          },
        },
      } as any;

      openSupportLink({
        url: "https://wa.me/5511999999999",
        openType: "external",
      });

      expect(openLinkMock).toHaveBeenCalledWith("https://wa.me/5511999999999");
      expect(openTelegramLinkMock).not.toHaveBeenCalled();
    });

    it("calls window.open fallback with noopener,noreferrer when outside TMA", () => {
      const windowOpenMock = vi.fn();

      global.window = {
        open: windowOpenMock,
      } as any;

      openSupportLink({
        url: "https://t.me/Hexafiretv",
        openType: "telegram",
      });

      expect(windowOpenMock).toHaveBeenCalledWith(
        "https://t.me/Hexafiretv",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });
});
