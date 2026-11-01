import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  setupForegroundNotificationSoundListener,
  _resetNotificationSoundStateForTesting,
  getNotificationSoundPreferences,
  saveNotificationSoundPreferences,
  playCommissionChime,
  unlockAudioSystem,
  isIOS,
} from "../notification-sound";
import { buildPushNotificationOptions } from "@/lib/push/notification-payload-builder";

describe("Notification Sound & Service Worker Bidirectional Negotiation Suite", () => {
  let localStorageMock: Record<string, string> = {};
  let windowListeners: Record<string, any[]> = {};
  let swMessageListeners: Array<(event: any) => void> = [];
  let dispatchedCustomEvents: CustomEvent[] = [];

  beforeEach(() => {
    _resetNotificationSoundStateForTesting();
    localStorageMock = {};
    windowListeners = {};
    swMessageListeners = [];
    dispatchedCustomEvents = [];

    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });

    // Mock document & window
    vi.stubGlobal("document", {
      visibilityState: "visible",
      hasFocus: () => true,
    });

    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: any) => {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(listener);
      },
      removeEventListener: (type: string, listener: any) => {
        if (windowListeners[type]) {
          windowListeners[type] = windowListeners[type].filter((l) => l !== listener);
        }
      },
      dispatchEvent: (event: CustomEvent) => {
        dispatchedCustomEvents.push(event);
        return true;
      },
    });

    // Mock navigator.serviceWorker
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      serviceWorker: {
        addEventListener: (type: string, listener: any) => {
          if (type === "message") swMessageListeners.push(listener);
        },
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetNotificationSoundStateForTesting();
  });

  // Helper que simula o fluxo exato de handlePushEvent em public/sw.js
  async function simulateSwPushNegotiation(params: {
    clientResponder?: (event: any, port: MessagePort) => Promise<void> | void;
    timeoutMs?: number;
    customData?: any;
  }): Promise<{ silent: boolean; notificationTitle: string; finalOptions: any }> {
    const { clientResponder, timeoutMs = 1000, customData } = params;

    const data = customData || {
      title: "🛒 Nova venda no WebGran",
      body: "Você recebeu R$ 97,00",
      tag: "sale-123",
      data: { orderId: "ord-123", url: "/seller/financeiro" },
    };

    let clientHandledSilently = false;

    // Simula MessageChannel do Service Worker
    const channelPromise = new Promise<{ confirmed: boolean }>((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ confirmed: false });
        }
      }, timeoutMs);

      // Simula port1 e port2
      let port1MessageListener: ((e: any) => void) | null = null;

      const port1 = {
        set onmessage(fn: (e: any) => void) {
          port1MessageListener = fn;
        },
      };

      const port2 = {
        postMessage: (responsePayload: any) => {
          if (port1MessageListener) {
            clearTimeout(timeoutId);
            port1MessageListener({ data: responsePayload });
          }
        },
      };

      port1.onmessage = (msgEvent: any) => {
        if (!resolved && msgEvent.data) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(msgEvent.data);
        }
      };

      // Dispara para o cliente se houver responder
      if (clientResponder) {
        clientResponder(
          {
            data: {
              type: "SALE_SOUND",
              soundId: "commission",
              notificationId: data.data?.orderId || "ord-test",
              payload: data,
            },
            ports: [port2 as unknown as MessagePort],
          },
          port2 as unknown as MessagePort
        );
      }
    });

    const result = await channelPromise;
    if (result && result.confirmed) {
      clientHandledSilently = true;
    }

    const finalOptions = buildPushNotificationOptions(data, clientHandledSilently, "https://webgran.com.br");

    return {
      silent: finalOptions.silent,
      notificationTitle: data.title,
      finalOptions,
    };
  }

  it("(a) som tocou com sucesso na página aberta -> notificação do sistema deve ser silenciosa (silent: true SEM vibrate)", async () => {
    // Configura áudio com play() bem-sucedido
    const mockPlay = vi.fn().mockResolvedValue(undefined);
    class MockAudio {
      volume = 1;
      muted = false;
      currentTime = 0;
      play = mockPlay;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", MockAudio);

    setupForegroundNotificationSoundListener();
    expect(swMessageListeners.length).toBeGreaterThan(0);

    const result = await simulateSwPushNegotiation({
      clientResponder: async (event, port) => {
        await swMessageListeners[0](event);
      },
    });

    // Como o som tocou com sucesso, a notificação deve ser SILENCIOSA no SO
    expect(result.silent).toBe(true);
    expect(result.finalOptions.silent).toBe(true);
    // W3C: silent: true NUNCA pode ter vibrate (lançaria TypeError)
    expect(result.finalOptions.vibrate).toBeUndefined();
    expect("vibrate" in result.finalOptions).toBe(false);
    // renotify deve ser true pois tag foi definida
    expect(result.finalOptions.tag).toBe("sale-123");
    expect(result.finalOptions.renotify).toBe(true);
    expect(mockPlay).toHaveBeenCalled();
  });

  it("(b) play bloqueado (NotAllowedError) -> notificação do sistema deve ser NORMAL (silent: false COM vibrate)", async () => {
    // Configura áudio simulando bloqueio de autoplay do navegador
    const mockPlay = vi.fn().mockRejectedValue(new DOMException("Autoplay not allowed", "NotAllowedError"));
    class MockAudio {
      volume = 1;
      muted = false;
      currentTime = 0;
      play = mockPlay;
      pause = vi.fn();
    }
    vi.stubGlobal("Audio", MockAudio);

    setupForegroundNotificationSoundListener();

    const result = await simulateSwPushNegotiation({
      clientResponder: async (event, port) => {
        await swMessageListeners[0](event);
      },
    });

    // Se o play foi bloqueado, o SW NÃO silencia: notificação deve ser NORMAL com som e vibração nativos do SO
    expect(result.silent).toBe(false);
    expect(result.finalOptions.silent).toBe(false);
    expect(result.finalOptions.vibrate).toEqual([200, 100, 200]);
    // E deve ter disparado evento para o banner de toque
    const blockedEvent = dispatchedCustomEvents.find((e) => e.type === "webgran-audio-autoplay-blocked");
    expect(blockedEvent).toBeDefined();
  });

  it("(c) preferência desligada com página visível e em foco -> notificação silenciosa (silent: true) e aviso na tela", async () => {
    // Preferência desativada pelo usuário
    saveNotificationSoundPreferences({ enabled: false });

    setupForegroundNotificationSoundListener();

    const result = await simulateSwPushNegotiation({
      clientResponder: async (event, port) => {
        await swMessageListeners[0](event);
      },
    });

    // Página visível com som desligado confirma exibição visual -> notificação do SO é silenciosa sem vibrate
    expect(result.silent).toBe(true);
    expect(result.finalOptions.vibrate).toBeUndefined();
    // Dispara evento visual para a tela
    const visualEvent = dispatchedCustomEvents.find((e) => e.type === "webgran-sale-received");
    expect(visualEvent).toBeDefined();
  });

  it("(d) página oculta (visibilityState === 'hidden') -> notificação NORMAL (silent: false COM vibrate)", async () => {
    // Simula aba em background / tela desligada
    vi.stubGlobal("document", {
      visibilityState: "hidden",
      hasFocus: () => false,
    });

    setupForegroundNotificationSoundListener();

    const result = await simulateSwPushNegotiation({
      clientResponder: async (event, port) => {
        await swMessageListeners[0](event);
      },
    });

    // Página oculta não confirma -> SO toca som normal e vibra
    expect(result.silent).toBe(false);
    expect(result.finalOptions.vibrate).toEqual([200, 100, 200]);
  });

  it("(e) sem resposta da página em até 1 s (timeout) -> notificação NORMAL (silent: false COM vibrate)", async () => {
    setupForegroundNotificationSoundListener();

    const result = await simulateSwPushNegotiation({
      clientResponder: async (event, port) => {
        // Simula página congelada ou que não responde
      },
      timeoutMs: 50, // Timeout acelerado para o teste
    });

    // Sem confirmação em 1s: notificação deve ser NORMAL com som e vibração
    expect(result.silent).toBe(false);
    expect(result.finalOptions.vibrate).toEqual([200, 100, 200]);
  });

  it("(f) W3C: showNotification com silent: true NUNCA inclui vibrate; silent: false SEMPRE inclui vibrate; renotify exige tag", () => {
    // 1. Ramo silencioso COM tag
    const optSilentWithTag = buildPushNotificationOptions(
      { title: "Venda", body: "R$ 10", tag: "order-999", data: { orderId: "999" } },
      true
    );
    expect(optSilentWithTag.silent).toBe(true);
    expect(optSilentWithTag.vibrate).toBeUndefined();
    expect("vibrate" in optSilentWithTag).toBe(false);
    expect(optSilentWithTag.tag).toBe("order-999");
    expect(optSilentWithTag.renotify).toBe(true);

    // 2. Ramo silencioso SEM tag
    const optSilentNoTag = buildPushNotificationOptions(
      { title: "Venda", body: "R$ 10", tag: "", data: {} },
      true
    );
    expect(optSilentNoTag.silent).toBe(true);
    expect(optSilentNoTag.vibrate).toBeUndefined();
    // Sem tag, renotify NÃO pode ser true
    expect(optSilentNoTag.renotify).toBeUndefined();

    // 3. Ramo sonoro do SO COM tag
    const optSoundWithTag = buildPushNotificationOptions(
      { title: "Venda", body: "R$ 10", tag: "order-888", data: { orderId: "888" } },
      false
    );
    expect(optSoundWithTag.silent).toBe(false);
    expect(optSoundWithTag.vibrate).toEqual([200, 100, 200]);
    expect(optSoundWithTag.tag).toBe("order-888");
    expect(optSoundWithTag.renotify).toBe(true);

    // 4. Ramo sonoro do SO SEM tag
    const optSoundNoTag = buildPushNotificationOptions(
      { title: "Venda", body: "R$ 10", tag: "", data: {} },
      false
    );
    expect(optSoundNoTag.silent).toBe(false);
    expect(optSoundNoTag.vibrate).toEqual([200, 100, 200]);
    expect(optSoundNoTag.renotify).toBeUndefined();
  });

  it("(g) desbloqueio: usa click, pointerup, touchend e keydown; NÃO usa { once: true }; remove listeners só após sucesso", async () => {
    let playMutedDuringUnlock = false;
    let playCallCount = 0;
    let pauseCallCount = 0;

    class MockAudio {
      volume = 1;
      muted = false;
      currentTime = 0;
      play = vi.fn().mockImplementation(function (this: any) {
        // Verifica se muted = true foi usado durante o desbloqueio (em vez de volume 0)
        playMutedDuringUnlock = this.muted === true;
        playCallCount++;
        return Promise.resolve();
      });
      pause = vi.fn().mockImplementation(() => {
        pauseCallCount++;
      });
    }
    vi.stubGlobal("Audio", MockAudio);

    setupForegroundNotificationSoundListener();

    // Eventos obrigatórios de desbloqueio registrados
    expect(windowListeners["click"]).toBeDefined();
    expect(windowListeners["pointerup"]).toBeDefined();
    expect(windowListeners["touchend"]).toBeDefined();
    expect(windowListeners["keydown"]).toBeDefined();

    // Não deve registrar pointerdown ou touchstart
    expect(windowListeners["pointerdown"]).toBeUndefined();
    expect(windowListeners["touchstart"]).toBeUndefined();

    // Dispara touchend do usuário
    await windowListeners["touchend"][0]();

    // Deve ter chamado play com muted = true e pause
    expect(playCallCount).toBeGreaterThan(0);
    expect(pauseCallCount).toBeGreaterThan(0);
    expect(playMutedDuringUnlock).toBe(true);

    // Após desbloqueio bem-sucedido, listeners devem ter sido removidos
    expect(windowListeners["click"]?.length ?? 0).toBe(0);
    expect(windowListeners["pointerup"]?.length ?? 0).toBe(0);
    expect(windowListeners["touchend"]?.length ?? 0).toBe(0);
    expect(windowListeners["keydown"]?.length ?? 0).toBe(0);
  });
});
