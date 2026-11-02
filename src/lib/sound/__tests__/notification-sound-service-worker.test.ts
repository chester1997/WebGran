import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  setupForegroundNotificationSoundListener,
  _resetNotificationSoundStateForTesting,
  getNotificationSoundPreferences,
  saveNotificationSoundPreferences,
  playCommissionChime,
  unlockAudioSystem,
  isIOS,
  isEventRecentlyPlayed,
  markEventAsPlayed,
} from "../notification-sound";
import {
  buildPushNotificationOptions,
  buildSaleNotificationPayload,
  buildPlatformCommissionPayload,
} from "@/lib/push/notification-payload-builder";

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
        localStorageMock[key] = String(value);
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      key: (i: number) => Object.keys(localStorageMock)[i] ?? null,
      get length() {
        return Object.keys(localStorageMock).length;
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
    clientResponders?: Array<(event: any, port: MessagePort) => Promise<void> | void>;
    timeoutMs?: number;
    customData?: any;
  }): Promise<{ silent: boolean; notificationTitle: string; finalOptions: any }> {
    const { clientResponder, clientResponders, timeoutMs = 1000, customData } = params;

    const data = customData || {
      title: "🛒 Nova venda no WebGran",
      body: "Você recebeu R$ 97,00",
      tag: "sale-123",
      data: { orderId: "ord-123", url: "/seller/financeiro" },
    };

    let clientHandledSilently = false;

    // Prioriza tag única para distinguir vendas e comissões (conforme sw.js atualizado)
    const notificationTag = typeof data.tag === "string" && data.tag.trim().length > 0 ? data.tag.trim() : null;
    const notificationId = notificationTag || data.data?.orderId || `push-${Date.now()}`;

    const responders = clientResponders || (clientResponder ? [clientResponder] : []);

    // Simula MessageChannel do Service Worker
    const channelPromise = new Promise<{ confirmed: boolean }>((resolve) => {
      let positiveResolved = false;
      let pendingResponses = responders.length;

      const timeoutId = setTimeout(() => {
        if (!positiveResolved) {
          resolve({ confirmed: false });
        }
      }, timeoutMs);

      if (responders.length === 0) {
        clearTimeout(timeoutId);
        resolve({ confirmed: false });
        return;
      }

      for (const responder of responders) {
        let port1MessageListener: ((e: any) => void) | null = null;

        const port1 = {
          set onmessage(fn: (e: any) => void) {
            port1MessageListener = fn;
          },
        };

        const port2 = {
          postMessage: (responsePayload: any) => {
            if (port1MessageListener) {
              port1MessageListener({ data: responsePayload });
            }
          },
        };

        port1.onmessage = (msgEvent: any) => {
          pendingResponses--;
          const res = msgEvent.data;

          if (!positiveResolved && res && res.confirmed) {
            positiveResolved = true;
            clearTimeout(timeoutId);
            resolve(res);
            return;
          }

          if (!positiveResolved && pendingResponses <= 0) {
            clearTimeout(timeoutId);
            resolve({ confirmed: false });
          }
        };

        responder(
          {
            data: {
              type: "SALE_SOUND",
              soundId: "commission",
              notificationId,
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

  describe("Cenários Obrigatórios de Vendas e Comissões Reais", () => {
    it("1. Venda real com página visível reproduz som e silencia notificação do sistema", async () => {
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

      const salePayload = buildSaleNotificationPayload({
        orderId: "ord-sale-real-1",
        amount: 199.90,
        itemTitle: "Acesso VIP",
        storeId: "store-vip",
      });

      const result = await simulateSwPushNegotiation({
        customData: salePayload,
        clientResponder: async (event, port) => {
          await swMessageListeners[0](event);
        },
      });

      expect(result.silent).toBe(true);
      expect(result.finalOptions.silent).toBe(true);
      expect(result.finalOptions.vibrate).toBeUndefined();
      expect(result.finalOptions.tag).toBe("sale-ord-sale-real-1");
      expect(mockPlay).toHaveBeenCalled();
    });

    it("2. Comissão real com página visível reproduz som e silencia notificação do sistema", async () => {
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

      const commPayload = buildPlatformCommissionPayload({
        orderId: "ord-comm-real-2",
        feeReais: 0.50,
        eventType: "SPLIT_PROCESSED",
      });

      const result = await simulateSwPushNegotiation({
        customData: commPayload,
        clientResponder: async (event, port) => {
          await swMessageListeners[0](event);
        },
      });

      expect(result.silent).toBe(true);
      expect(result.finalOptions.silent).toBe(true);
      expect(result.finalOptions.vibrate).toBeUndefined();
      expect(result.finalOptions.tag).toBe("commission-ord-comm-real-2-split_processed");
      expect(mockPlay).toHaveBeenCalled();
    });

    it("3. Venda e comissão simultâneas do mesmo pedido possuem identificadores independentes e não colidem", async () => {
      const salePayload = buildSaleNotificationPayload({
        orderId: "ord-shared-3",
        amount: 250,
      });
      const commPayload = buildPlatformCommissionPayload({
        orderId: "ord-shared-3",
        feeReais: 0.50,
        eventType: "SPLIT_PROCESSED",
      });

      // Tags e notificationIds gerados são completamente distintos
      expect(salePayload.tag).toBe("sale-ord-shared-3");
      expect(commPayload.tag).toBe("commission-ord-shared-3-split_processed");
      expect(salePayload.tag).not.toBe(commPayload.tag);

      const optSale = buildPushNotificationOptions(salePayload, true);
      const optComm = buildPushNotificationOptions(commPayload, true);

      expect(optSale.data.notificationId).toBe("sale-ord-shared-3");
      expect(optComm.data.notificationId).toBe("commission-ord-shared-3-split_processed");
      expect(optSale.data.notificationId).not.toBe(optComm.data.notificationId);
    });

    it("4. Duas abas, uma visível e outra oculta: a resposta positiva da aba visível prevalece", async () => {
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      class MockAudio {
        volume = 1;
        muted = false;
        currentTime = 0;
        play = mockPlay;
        pause = vi.fn();
      }
      vi.stubGlobal("Audio", MockAudio);

      const salePayload = buildSaleNotificationPayload({ orderId: "ord-multi-tab-4", amount: 100 });

      // Simula Tab 1 (oculta) e Tab 2 (visível)
      let tab1Replied = false;
      let tab2Replied = false;

      const responderTab1Hidden = async (event: any, port: MessagePort) => {
        // Tab 1 está oculta: responde imediatamente negativo
        tab1Replied = true;
        port.postMessage({ confirmed: false, playedSound: false, reason: "hidden_or_unfocused" });
      };

      const responderTab2Visible = async (event: any, port: MessagePort) => {
        // Tab 2 está visível: toca som com sucesso
        tab2Replied = true;
        await playCommissionChime({ eventId: event.data.notificationId });
        port.postMessage({ confirmed: true, playedSound: true, showedToast: true });
      };

      const result = await simulateSwPushNegotiation({
        customData: salePayload,
        clientResponders: [responderTab1Hidden, responderTab2Visible],
      });

      expect(tab1Replied).toBe(true);
      expect(tab2Replied).toBe(true);
      // Confirmação positiva da Tab 2 deve vencer, silenciando o SO
      expect(result.silent).toBe(true);
      expect(result.finalOptions.silent).toBe(true);
    });

    it("5. Duas abas visíveis: sem som duplicado através de trava cross-tab", async () => {
      let playCount = 0;
      class MockAudio {
        volume = 1;
        muted = false;
        currentTime = 0;
        play = vi.fn().mockImplementation(() => {
          playCount++;
          return Promise.resolve();
        });
        pause = vi.fn();
      }
      vi.stubGlobal("Audio", MockAudio);

      const eventId = "sale-two-visible-tabs";

      // Tab 1 executa primeiro
      const playedTab1 = await playCommissionChime({ eventId });
      expect(playedTab1).toBe(true);
      expect(playCount).toBe(1);

      // Tab 2 executa em seguida para o mesmo evento: trava cross-tab impede duplicação
      const playedTab2 = await playCommissionChime({ eventId });
      expect(playedTab2).toBe(false);
      expect(playCount).toBe(1); // Manteve 1, não tocou duplicado!
    });

    it("6. Autoplay bloqueado com fallback disponível: AudioContext running executa com sucesso", async () => {
      // HTMLAudioElement falha com NotAllowedError
      class MockFailingAudio {
        volume = 1;
        muted = false;
        currentTime = 0;
        play = vi.fn().mockRejectedValue(new DOMException("Autoplay not allowed", "NotAllowedError"));
        pause = vi.fn();
      }
      vi.stubGlobal("Audio", MockFailingAudio);

      // Web Audio API com AudioContext running
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

      class MockRunningAudioContext {
        state = "running";
        currentTime = 0;
        destination = {};
        createOscillator = mockCreateOscillator;
        createGain = mockCreateGain;
        resume = vi.fn().mockResolvedValue(undefined);
      }
      vi.stubGlobal("AudioContext", MockRunningAudioContext);
      (window as any).AudioContext = MockRunningAudioContext;

      // Não interrompe prematuramente: cai no fallback sintetizado com sucesso
      const played = await playCommissionChime({ eventId: "test-fallback-chime" });
      expect(played).toBe(true);
      expect(mockCreateOscillator).toHaveBeenCalled();
    });

    it("7. Todos os mecanismos de áudio bloqueados: responde playedSound: false e ativa notificação normal do SO", async () => {
      // HTMLAudioElement falha
      class MockFailingAudio {
        volume = 1;
        muted = false;
        currentTime = 0;
        play = vi.fn().mockRejectedValue(new DOMException("Autoplay not allowed", "NotAllowedError"));
        pause = vi.fn();
      }
      vi.stubGlobal("Audio", MockFailingAudio);

      // AudioContext suspenso que não consegue resumir
      class MockSuspendedAudioContext {
        state = "suspended";
        currentTime = 0;
        destination = {};
        resume = vi.fn().mockRejectedValue(new DOMException("Cannot resume", "NotAllowedError"));
      }
      vi.stubGlobal("AudioContext", MockSuspendedAudioContext);
      (window as any).AudioContext = MockSuspendedAudioContext;

      setupForegroundNotificationSoundListener();

      const salePayload = buildSaleNotificationPayload({ orderId: "ord-all-blocked-7", amount: 100 });

      const result = await simulateSwPushNegotiation({
        customData: salePayload,
        clientResponder: async (event, port) => {
          await swMessageListeners[0](event);
        },
      });

      // Como todos os mecanismos de áudio falharam, o Service Worker deve tocar som normal do SO com vibração
      expect(result.silent).toBe(false);
      expect(result.finalOptions.silent).toBe(false);
      expect(result.finalOptions.vibrate).toEqual([200, 100, 200]);

      // E deve ter disparado o evento do banner de ativação
      const blockedEvent = dispatchedCustomEvents.find((e) => e.type === "webgran-audio-autoplay-blocked");
      expect(blockedEvent).toBeDefined();
    });

    it("8. Preferências de volume com chave antiga e nova: preserva volume customizado", () => {
      // Usuário salvou volume 45% com userId
      saveNotificationSoundPreferences({ volume: 45, enabled: true }, "user-seller-uuid-88");

      // Leitura sem userId (como feita no listener global em segundo plano)
      const readGlobal = getNotificationSoundPreferences();
      expect(readGlobal.volume).toBe(45);
      expect(readGlobal.enabled).toBe(true);

      // Compatibilidade com chave antiga única sem userId
      localStorageMock = {
        webgran_sound_config: JSON.stringify({ volume: 60, enabled: true, soundId: "commission" }),
      };
      const readLegacyConfig = getNotificationSoundPreferences();
      expect(readLegacyConfig.volume).toBe(60);
      expect(readLegacyConfig.enabled).toBe(true);

      // Compatibilidade com flag booleana legada
      localStorageMock = {
        webgran_notification_sound_enabled: "false",
      };
      const readLegacyBoolean = getNotificationSoundPreferences();
      expect(readLegacyBoolean.enabled).toBe(false);
      expect(readLegacyBoolean.volume).toBe(80); // padrão
    });

    it("9. Administrador recebendo comissão da plataforma", async () => {
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

      const commPayload = buildPlatformCommissionPayload({
        orderId: "ord-admin-comm-9",
        feeReais: 1.50,
        eventType: "COMMISSION_SETTLED",
      });

      expect(commPayload.url).toBe("/admin/commission");
      expect(commPayload.title).toBe("💰 Comissão recebida");
      expect(commPayload.tag).toBe("commission-ord-admin-comm-9-commission_settled");

      const result = await simulateSwPushNegotiation({
        customData: commPayload,
        clientResponder: async (event, port) => {
          await swMessageListeners[0](event);
        },
      });

      expect(result.silent).toBe(true);
      expect(mockPlay).toHaveBeenCalled();
    });

    it("10. Deduplicação de retries do mesmo evento não toca som repetido", async () => {
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      class MockAudio {
        volume = 1;
        muted = false;
        currentTime = 0;
        play = mockPlay;
        pause = vi.fn();
      }
      vi.stubGlobal("Audio", MockAudio);

      const eventTag = "sale-order-retry-10";

      // Primeiro disparo
      const first = await playCommissionChime({ eventId: eventTag });
      expect(first).toBe(true);
      expect(mockPlay).toHaveBeenCalledTimes(1);

      // Segundo disparo (retry legítimo do gateway com mesma tag)
      const second = await playCommissionChime({ eventId: eventTag });
      expect(second).toBe(false); // Ignorado por deduplicação
      expect(mockPlay).toHaveBeenCalledTimes(1); // Não tocou novamente
    });
  });
});
