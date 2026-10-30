import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database and services
const { mockDb, mockSendToSeller } = vi.hoisted(() => ({
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
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
      values: vi.fn().mockResolvedValue({ rowCount: 1 }),
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
  unlockAudioContext,
  setupForegroundNotificationSoundListener,
  _resetNotificationSoundStateForTesting,
  getNotificationSoundUrl,
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

    it("interrompe o envio e não inventa destinatário caso o proprietário não esteja configurado e não haja admin único", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      delete process.env.PLATFORM_OWNER_EMAIL;
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;
      mockDb.query.users.findMany.mockResolvedValueOnce([]); // Nenhum admin

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

    it("resolve com segurança para o único administrador caso não haja env var explícita", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      delete process.env.PLATFORM_OWNER_EMAIL;
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;
      mockDb.query.users.findMany.mockResolvedValueOnce([{ id: "single-admin-id" }]);

      const ownerId = await PlatformFinancialNotificationService.getPlatformOwnerId();
      expect(ownerId).toBe("single-admin-id");
    });

    it("bloqueia e não adivinha se existirem múltiplos administradores sem env var explícita", async () => {
      delete process.env.PLATFORM_OWNER_USER_ID;
      delete process.env.PLATFORM_OWNER_EMAIL;
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;
      mockDb.query.users.findMany.mockResolvedValueOnce([{ id: "admin-1" }, { id: "admin-2" }]);

      const ownerId = await PlatformFinancialNotificationService.getPlatformOwnerId();
      expect(ownerId).toBeNull();
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
          title: "💰 Comissão WebGran",
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

    it("envia '💰 Comissão WebGran' com valor real quando comprovado na API oficial (SPLIT_PROCESSED)", async () => {
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
          title: "💰 Comissão WebGran",
          body: expect.stringMatching(/0,50/),
          url: "/admin/commission",
          tag: "commission-order-proc-1-split_processed",
        })
      );
    });

    it("envia '💰 Comissão WebGran' quando confirmado por reconciliação formal (COMMISSION_CONFIRMED)", async () => {
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
          title: "💰 Comissão WebGran",
          body: expect.stringMatching(/1,50/),
          url: "/admin/commission",
        })
      );
    });

    it("envia '💰 Comissão recebida' quando houver evidência bancária (COMMISSION_SETTLED)", async () => {
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
          title: "💰 Comissão recebida",
          body: expect.stringContaining("Você recebeu"),
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
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("quando vendedor não tem inscrição ativa, não insere no banco como enviado e permite retentativa futura", async () => {
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);
      mockSendToSeller.mockResolvedValueOnce({
        success: true,
        skipped: true,
        reason: "Seller has no active push subscriptions.",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      });

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "order-no-sub",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "0.50",
        splitAmountCents: 50,
      });

      expect(result.skipped).toBe(true);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("4. Preferência Sonora e Áudio de Notificação", () => {
    let storageStore: Record<string, string> = {};

    beforeEach(() => {
      storageStore = {};
      _resetNotificationSoundStateForTesting();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
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

    it("setupForegroundNotificationSoundListener registra listener do service worker e toca áudio no primeiro plano", async () => {
      const messageListeners: Array<(event: any) => void> = [];
      vi.stubGlobal("navigator", {
        serviceWorker: {
          addEventListener: vi.fn((type: string, listener: any) => {
            if (type === "message") messageListeners.push(listener);
          }),
        },
      });

      const mockPlay = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("Audio", class {
        play = mockPlay;
        preload = "";
        currentTime = 0;
      });

      setupForegroundNotificationSoundListener();

      expect(messageListeners.length).toBeGreaterThan(0);

      // Dispara evento vindo do Service Worker
      messageListeners[0]({
        data: {
          type: "WEBGRAN_PUSH_RECEIVED",
          payload: {
            title: "💰 Comissão WebGran",
            body: "Comissão de R$ 0,50 confirmada",
            data: { orderId: "order-fg-sound-test" },
          },
        },
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(mockPlay).toHaveBeenCalled();
    });

    it("retorna o caminho oficial do áudio do WebGran", () => {
      expect(getNotificationSoundUrl()).toBe("/sounds/commission.mp3");
    });

    it("prime o elemento HTML5 Audio na primeira interação do usuário para compatibilidade com Chrome Android", () => {
      _resetNotificationSoundStateForTesting();
      const windowListeners: Record<string, (e?: any) => void> = {};
      const mockLoad = vi.fn();
      class MockAudio {
        play = vi.fn().mockResolvedValue(undefined);
        load = mockLoad;
        preload = "";
        currentTime = 0;
        constructor(public src?: string) {}
      }

      vi.stubGlobal("window", {
        addEventListener: vi.fn((type: string, listener: any) => {
          windowListeners[type] = listener;
        }),
        removeEventListener: vi.fn(),
      });
      vi.stubGlobal("Audio", MockAudio);

      setupForegroundNotificationSoundListener();

      expect(windowListeners["touchstart"]).toBeDefined();
      // Simula primeiro toque do usuário
      windowListeners["touchstart"]();

      expect(mockLoad).toHaveBeenCalled();
    });

    it("executa fallback sintetizado via Web Audio API caso o carregamento do MP3 seja rejeitado pelo navegador", async () => {
      _resetNotificationSoundStateForTesting();
      storageStore["webgran_notification_sound_enabled"] = "true";

      // Simula Audio falhando (ex: Autoplay Policy bloqueado ou erro de decodificação)
      class MockFailingAudio {
        play = vi.fn().mockRejectedValue(new Error("NotAllowedError: play() failed"));
        load = vi.fn();
        preload = "";
        currentTime = 0;
      }
      vi.stubGlobal("Audio", MockFailingAudio);

      // Simula Web Audio API funcionando
      const mockCreateOscillator = vi.fn().mockReturnValue({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      });
      const mockCreateGain = vi.fn().mockReturnValue({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      });

      class MockAudioContext {
        state = "running";
        currentTime = 0;
        destination = {};
        createOscillator = mockCreateOscillator;
        createGain = mockCreateGain;
        resume = vi.fn().mockResolvedValue(undefined);
      }

      vi.stubGlobal("AudioContext", MockAudioContext);
      (window as any).AudioContext = MockAudioContext;

      const played = await playCommissionChime({ eventId: "test-synth-fallback", force: true });
      expect(played).toBe(true);
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it("permite repetições sucessivas de cliques de teste com force=true sem ser bloqueado por deduplicação", async () => {
      _resetNotificationSoundStateForTesting();
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("Audio", class {
        play = mockPlay;
        preload = "";
        currentTime = 0;
      });

      // Primeiro clique
      const first = await playCommissionChime({ eventId: "manual-test", force: true });
      expect(first).toBe(true);

      // Segundo clique com mesmo ID mas force: true (não pode ser bloqueado)
      const second = await playCommissionChime({ eventId: "manual-test", force: true });
      expect(second).toBe(true);
      expect(mockPlay).toHaveBeenCalledTimes(2);
    });

    it("unlockAudioContext inicializa buffer silencioso para destravar autoplay do navegador", async () => {
      _resetNotificationSoundStateForTesting();
      const mockCreateBuffer = vi.fn().mockReturnValue({ length: 1 });
      const mockCreateBufferSource = vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      });
      const mockResume = vi.fn().mockResolvedValue(undefined);

      class MockCtx {
        state = "suspended";
        destination = {};
        createBuffer = mockCreateBuffer;
        createBufferSource = mockCreateBufferSource;
        resume = mockResume;
      }
      vi.stubGlobal("AudioContext", MockCtx);
      (window as any).AudioContext = MockCtx;

      await unlockAudioContext();

      expect(mockResume).toHaveBeenCalled();
      expect(mockCreateBuffer).toHaveBeenCalledWith(1, 1, 22050);
      expect(mockCreateBufferSource).toHaveBeenCalled();
    });
  });
});
