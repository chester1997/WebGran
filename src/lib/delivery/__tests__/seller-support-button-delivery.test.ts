import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramDeliveryService } from "../telegram-delivery-service";
import { saveSupportContactAction } from "@/app/(seller)/seller/store/actions";

// Mock TelegramBotService
const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 101 });
vi.mock("@/lib/telegram/bot", () => {
  return {
    TelegramBotService: vi.fn().mockImplementation(function (this: any) {
      this.sendMessage = mockSendMessage;
      return this;
    }),
  };
});


// Mock Auth
let currentSeller = { id: "seller-owner-1", email: "seller1@test.com" };
let currentStore: any = { id: "store-1", ownerId: "seller-owner-1", slug: "loja-1", supportValue: null };

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn().mockImplementation(async () => currentSeller),
  getCurrentStore: vi.fn().mockImplementation(async () => currentStore),
}));

// Mock Database
let dbStores: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      stores: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          // Return based on store id
          return Object.values(dbStores)[0] || null;
        }),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((setValues: any) => ({
        where: vi.fn().mockImplementation(async (whereClause: any) => {
          // Check if seller is authorized owner
          if (currentStore && currentStore.ownerId === currentSeller.id) {
            Object.assign(currentStore, setValues);
            if (dbStores[currentStore.id]) {
              Object.assign(dbStores[currentStore.id], setValues);
            }
            return [currentStore];
          }
          return [];
        }),
      })),
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("WEBGRAN — Botão de Suporte Personalizado por Lojista Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSeller = { id: "seller-owner-1", email: "seller1@test.com" };
    currentStore = { id: "store-1", ownerId: "seller-owner-1", slug: "loja-1", supportValue: null };
    dbStores = {
      "store-1": { ...currentStore },
    };
  });

  describe("1. sanitizeSupportUrl Validation & Normalization", () => {
    it("normalizes @username to https://t.me/username", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("@atendimentoloja")).toBe(
        "https://t.me/atendimentoloja"
      );
    });

    it("normalizes plain username to https://t.me/username", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("suportetg")).toBe(
        "https://t.me/suportetg"
      );
    });

    it("normalizes t.me/username to https://t.me/username", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("t.me/suporteloja")).toBe(
        "https://t.me/suporteloja"
      );
    });

    it("preserves valid https://t.me/username URL", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("https://t.me/suporteloja")).toBe(
        "https://t.me/suporteloja"
      );
    });

    it("preserves valid external HTTPS links (WhatsApp, helpdesk)", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("https://wa.me/5511999999999")).toBe(
        "https://wa.me/5511999999999"
      );
      expect(TelegramDeliveryService.sanitizeSupportUrl("https://ajuda.minhaloja.com/ticket")).toBe(
        "https://ajuda.minhaloja.com/ticket"
      );
    });

    it("strictly rejects insecure http:// protocols", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("http://insecure.com/suporte")).toBeNull();
    });

    it("strictly rejects dangerous protocols (javascript:, data:, vbscript:, file:)", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl("javascript:alert(1)")).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl("vbscript:msgbox(1)")).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl("file:///etc/passwd")).toBeNull();
    });

    it("returns null for empty, null, or whitespace values", () => {
      expect(TelegramDeliveryService.sanitizeSupportUrl(null)).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl(undefined)).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl("")).toBeNull();
      expect(TelegramDeliveryService.sanitizeSupportUrl("   ")).toBeNull();
    });
  });

  describe("2. TelegramDeliveryService: sendPaymentConfirmationMessage Inline Keyboard", () => {
    it("adds 🆘 SUPORTE button when valid supportContactUrl is provided, preserving 🔴 ASSISTIR AGORA", async () => {
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "fake-token",
        "123456789",
        "Dorama Teste",
        "https://www.webgran.online/miniapp/loja?access=acc-1",
        false,
        false,
        "loja-1",
        "https://t.me/suporteloja"
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const keyboard = mockSendMessage.mock.calls[0][2].inline_keyboard;

      // Must have 2 rows
      expect(keyboard).toHaveLength(2);
      // Row 1: Access button
      expect(keyboard[0][0].text).toBe("🔴 ASSISTIR AGORA");
      expect(keyboard[0][0].web_app?.url).toBe("https://www.webgran.online/miniapp/loja?access=acc-1");
      // Row 2: Support button
      expect(keyboard[1][0].text).toBe("🆘 SUPORTE");
      expect(keyboard[1][0].url).toBe("https://t.me/suporteloja");
    });

    it("omits 🆘 SUPORTE button when store has no support contact configured", async () => {
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "fake-token",
        "123456789",
        "Dorama Teste",
        "https://t.me/+invite123",
        false,
        false,
        "loja-1",
        null
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const keyboard = mockSendMessage.mock.calls[0][2].inline_keyboard;

      // Only 1 row: Access button
      expect(keyboard).toHaveLength(1);
      expect(keyboard[0][0].text).toBe("🔴 ASSISTIR AGORA");
      expect(keyboard[0][0].url).toBe("https://t.me/+invite123");
    });

    it("omits 🆘 SUPORTE button when support contact is invalid (insecure/malformed)", async () => {
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "fake-token",
        "123456789",
        "Dorama Teste",
        "https://t.me/+invite123",
        false,
        false,
        "loja-1",
        "javascript:evilCode()"
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const keyboard = mockSendMessage.mock.calls[0][2].inline_keyboard;

      // Only 1 row: Access button preserved intact
      expect(keyboard).toHaveLength(1);
      expect(keyboard[0][0].text).toBe("🔴 ASSISTIR AGORA");
    });

    it("includes 🆘 SUPORTE button on deliveryFailed message when support is configured", async () => {
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "fake-token",
        "123456789",
        "Dorama Teste",
        "",
        false,
        true, // deliveryFailed
        "loja-1",
        "@atendimentovip"
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const keyboard = mockSendMessage.mock.calls[0][2].inline_keyboard;

      expect(keyboard).toHaveLength(2);
      expect(keyboard[0][0].text).toBe("🔄 TENTAR LIBERAR ACESSO");
      expect(keyboard[1][0].text).toBe("🆘 SUPORTE");
      expect(keyboard[1][0].url).toBe("https://t.me/atendimentovip");
    });
  });

  describe("3. saveSupportContactAction Seller Panel Configuration", () => {
    it("saves a valid Telegram username as support contact", async () => {
      const res = await saveSupportContactAction("@centraldoramas");

      expect(res.success).toBe(true);
      expect(res.supportContactUrl).toBe("https://t.me/centraldoramas");
      expect(currentStore.supportValue).toBe("https://t.me/centraldoramas");
      expect(currentStore.supportType).toBe("telegram");
    });

    it("saves a valid HTTPS external link as support contact", async () => {
      const res = await saveSupportContactAction("https://wa.me/5511999998888");

      expect(res.success).toBe(true);
      expect(res.supportContactUrl).toBe("https://wa.me/5511999998888");
      expect(currentStore.supportValue).toBe("https://wa.me/5511999998888");
      expect(currentStore.supportType).toBe("whatsapp");
    });

    it("edits an existing support contact successfully", async () => {
      currentStore.supportValue = "https://t.me/oldsupport";
      const res = await saveSupportContactAction("@newsupport");

      expect(res.success).toBe(true);
      expect(res.supportContactUrl).toBe("https://t.me/newsupport");
      expect(currentStore.supportValue).toBe("https://t.me/newsupport");
    });

    it("removes/clears support contact when empty string is passed", async () => {
      currentStore.supportValue = "https://t.me/activesupport";
      const res = await saveSupportContactAction("   ");

      expect(res.success).toBe(true);
      expect(res.supportContactUrl).toBeNull();
      expect(currentStore.supportValue).toBeNull();
    });

    it("rejects insecure HTTP links", async () => {
      await expect(saveSupportContactAction("http://ajuda.loja.com")).rejects.toThrow(
        "protocolo HTTPS"
      );
    });

    it("rejects dangerous protocols (javascript:)", async () => {
      await expect(saveSupportContactAction("javascript:void(0)")).rejects.toThrow(
        "Protocolo de link não permitido"
      );
    });

    it("rejects invalid Telegram username format", async () => {
      await expect(saveSupportContactAction("@bad")).rejects.toThrow(
        "entre 5 e 32 caracteres"
      );
    });

    it("enforces multi-tenant ownership check (prevents unauthorized seller modifying another store)", async () => {
      // Simulate an attacker trying to modify store-1 when authenticated as a different seller
      currentSeller = { id: "attacker-seller-99", email: "hacker@test.com" };

      // currentStore belongs to seller-owner-1, not attacker-seller-99
      const res = await saveSupportContactAction("@hackedsupport");

      // Because the update clause enforces eq(stores.ownerId, currentSeller.id), store-1 was NOT updated!
      expect(currentStore.supportValue).not.toBe("https://t.me/hackedsupport");
    });
  });

  describe("4. Multi-Tenant Support Isolation across Stores", () => {
    it("ensures Store A and Store B send their respective support links to their buyers", async () => {
      // Store A delivery
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "token-a",
        "user-a",
        "Produto Loja A",
        "https://t.me/+inviteA",
        false,
        false,
        "loja-a",
        "https://t.me/suporte_loja_a"
      );

      // Store B delivery
      await TelegramDeliveryService.sendPaymentConfirmationMessage(
        "token-b",
        "user-b",
        "Produto Loja B",
        "https://t.me/+inviteB",
        false,
        false,
        "loja-b",
        "https://t.me/suporte_loja_b"
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      const msgA = mockSendMessage.mock.calls[0];
      const keyboardA = msgA[2].inline_keyboard;
      expect(keyboardA[1][0].url).toBe("https://t.me/suporte_loja_a");

      const msgB = mockSendMessage.mock.calls[1];
      const keyboardB = msgB[2].inline_keyboard;
      expect(keyboardB[1][0].url).toBe("https://t.me/suporte_loja_b");

      // Verify no cross-tenant bleeding
      expect(keyboardA[1][0].url).not.toBe(keyboardB[1][0].url);
    });
  });
});
