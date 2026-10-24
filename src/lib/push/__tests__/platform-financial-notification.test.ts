import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database and services
const { mockDb, mockSendToSeller } = vi.hoisted(() => ({
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      platformFinancialNotificationEvents: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    })),
  },
  mockSendToSeller: vi.fn().mockResolvedValue({
    success: true,
    totalSubscriptions: 1,
    sentCount: 1,
    failedCount: 0,
    deactivatedCount: 0,
  }),
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/push/seller-push-service", () => ({
  SellerPushService: {
    sendToSeller: mockSendToSeller,
  },
}));

import { PlatformFinancialNotificationService } from "../platform-financial-notification-service";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  playCommissionChime,
} from "@/lib/sound/notification-sound";

describe("WebGran — Platform Owner Commission Notifications & Custom Sound Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Identificação Segura do Proprietário da Plataforma (Isolamento Multi-Tenant)", () => {
    it("resolve o proprietário a partir de PLATFORM_OWNER_USER_ID explícito", async () => {
      process.env.PLATFORM_OWNER_USER_ID = "owner-uuid-explicit";
      const ownerId = await PlatformFinancialNotificationService.getPlatformOwnerId();
      expect(ownerId).toBe("owner-uuid-explicit");
    });

    it("resolve o proprietário a partir de PLATFORM_OWNER_EMAIL consultando a base", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      process.env.PLATFORM_OWNER_EMAIL = "proprietario@webgran.online";

      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: "owner-uuid-from-email",
        email: "proprietario@webgran.online",
      });

      const ownerId = await PlatformFinancialNotificationService.getPlatformOwnerId();
      expect(ownerId).toBe("owner-uuid-from-email");
      expect(mockDb.query.users.findFirst).toHaveBeenCalled();
    });

    it("resolve o proprietário a partir da loja oficial configurada (PUSHINPAY_PLATFORM_STORE_ID)", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      delete process.env.PLATFORM_OWNER_EMAIL;
      process.env.PUSHINPAY_PLATFORM_STORE_ID = "official-store-uuid";

      mockDb.query.stores.findFirst.mockResolvedValueOnce({
        id: "official-store-uuid",
        ownerId: "owner-uuid-from-store",
      });

      const ownerId = await PlatformFinancialNotificationService.getPlatformOwnerId();
      expect(ownerId).toBe("owner-uuid-from-store");
    });

    it("interrompe o envio e não inventa destinatário caso o proprietário não esteja configurado", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      delete process.env.PLATFORM_OWNER_EMAIL;
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-123",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("PLATFORM_OWNER_NOT_IDENTIFIED");
      expect(mockSendToSeller).not.toHaveBeenCalled();
    });

    it("garante que vendedor comum nunca receba notificações financeiras da plataforma", async () => {
      process.env.PLATFORM_OWNER_USER_ID = "owner-uuid-legit";
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-seller-1",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.ownerId).toBe("owner-uuid-legit");
      expect(mockSendToSeller).toHaveBeenCalledWith(
        "owner-uuid-legit",
        expect.objectContaining({
          title: "Split processado",
          url: "/admin/commission",
        })
      );
    });
  });

  describe("2. Distinção Rigorosa dos Eventos Financeiros", () => {
    beforeEach(() => {
      process.env.PLATFORM_OWNER_USER_ID = "owner-uuid-1";
    });

    it("bloqueia notificação para comissão calculada/prevista (COMMISSION_CALCULATED)", async () => {
      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-calc",
        eventType: "COMMISSION_CALCULATED",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("PREDICTED_OR_REQUESTED_COMMISSION_NOT_ELIGIBLE");
      expect(mockSendToSeller).not.toHaveBeenCalled();
    });

    it("bloqueia notificação para split apenas solicitado (SPLIT_REQUESTED)", async () => {
      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-requested",
        eventType: "SPLIT_REQUESTED",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("PREDICTED_OR_REQUESTED_COMMISSION_NOT_ELIGIBLE");
      expect(mockSendToSeller).not.toHaveBeenCalled();
    });

    it("envia 'Split processado' com valor real quando comprovado na API oficial (SPLIT_PROCESSED)", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-proc-1",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(true);
      expect(mockSendToSeller).toHaveBeenCalledWith(
        "owner-uuid-1",
        expect.objectContaining({
          title: "Split processado",
          body: expect.stringMatching(/0,50/),
          url: "/admin/commission",
          tag: "commission-order-proc-1-split_processed",
        })
      );
    });

    it("envia 'Comissão confirmada!' quando confirmado por reconciliação formal (COMMISSION_CONFIRMED)", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-conf-1",
        eventType: "COMMISSION_CONFIRMED",
        platformFeeReais: "1.50",
        splitAmountCents: 150,
      });

      expect(result.success).toBe(true);
      expect(mockSendToSeller).toHaveBeenCalledWith(
        "owner-uuid-1",
        expect.objectContaining({
          title: "Comissão confirmada!",
          body: expect.stringMatching(/1,50/),
          url: "/admin/commission",
        })
      );
    });

    it("envia 'Comissão liquidada!' quando houver evidência bancária (COMMISSION_SETTLED)", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-settle-1",
        eventType: "COMMISSION_SETTLED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(true);
      expect(mockSendToSeller).toHaveBeenCalledWith(
        "owner-uuid-1",
        expect.objectContaining({
          title: "Comissão liquidada!",
          body: expect.stringContaining("liquidada na conta bancária"),
        })
      );
    });
  });

  describe("3. Idempotência e Prevenção de Duplicatas", () => {
    beforeEach(() => {
      process.env.PLATFORM_OWNER_USER_ID = "owner-uuid-1";
    });

    it("não dispara notificação duplicada para o mesmo evento se já constar no banco", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce({
        id: "existing-event-id",
        orderId: "order-dup-1",
        eventType: "SPLIT_PROCESSED",
      });

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-dup-1",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.alreadySent).toBe(true);
      expect(mockSendToSeller).not.toHaveBeenCalled();
    });

    it("não duplica em webhooks repetidos ou retries em memória", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);

      // Primeira chamada: despacha
      const first = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-retry-mem",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });
      expect(first.success).toBe(true);

      // Segunda chamada (retry imediato do webhook na mesma instância): ignora via cache em memória
      const second = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-retry-mem",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });
      expect(second.alreadySent).toBe(true);
      expect(mockSendToSeller).toHaveBeenCalledTimes(1);
    });

    it("falha no push não lança exceção nem afeta fluxos financeiros", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);
      mockSendToSeller.mockRejectedValueOnce(new Error("Push gateway down"));

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-fail-safe",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe("4. Preferência Sonora e Áudio de Notificação", () => {
    let storageStore: Record<string, string> = {};

    beforeEach(() => {
      storageStore = {};
      vi.stubGlobal("window", {});
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => storageStore[k] ?? null,
        setItem: (k: string, v: string) => { storageStore[k] = String(v); },
        clear: () => { storageStore = {}; },
        removeItem: (k: string) => { delete storageStore[k]; },
      });
    });

    it("gerencia preferência de som de notificação no localStorage", () => {
      expect(isNotificationSoundEnabled()).toBe(true); // Padrão é true

      setNotificationSoundEnabled(false);
      expect(isNotificationSoundEnabled()).toBe(false);

      setNotificationSoundEnabled(true);
      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it("não reproduz som se a preferência estiver desativada, a menos que force=true", async () => {
      storageStore["webgran_notification_sound_enabled"] = "false";

      const played = await playCommissionChime({ eventId: "evt-1" });
      expect(played).toBe(false);
    });

    it("bloqueia reprodução duplicada de áudio para o mesmo eventId", async () => {
      storageStore["webgran_notification_sound_enabled"] = "true";

      // Simula Audio global
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("Audio", class {
        play = mockPlay;
        preload = "";
        currentTime = 0;
      });

      const firstPlay = await playCommissionChime({ eventId: "chime-once-test" });
      expect(firstPlay).toBe(true);

      const secondPlay = await playCommissionChime({ eventId: "chime-once-test" });
      expect(secondPlay).toBe(false);
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });
  });
});
