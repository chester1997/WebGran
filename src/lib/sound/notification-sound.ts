/**
 * Utilitário de reprodução sonora e diagnóstico técnico para notificações do WebGran.
 * Suporta reprodução em memória via Base64 Data URI, carregamento HTTP (/sounds/commission.mp3),
 * Web Audio API (AudioBuffer decodificado) e sintetizador harmônico senoidal.
 */

import { COMMISSION_AUDIO_DATA_URI } from "./commission-audio-data";

const STORAGE_KEY = "webgran_notification_sound_enabled";

export interface DiagnosticLogEntry {
  timestamp: string;
  step: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
  details?: any;
}

const diagnosticLogs: DiagnosticLogEntry[] = [];
const playedSoundEvents = new Set<string>();
let cachedAudioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let decodedAudioBuffer: AudioBuffer | null = null;
let isAudioBufferLoading = false;
let isForegroundListenerRegistered = false;

/**
 * Adiciona um log estruturado ao buffer de diagnóstico técnico e ao console do navegador.
 */
export function recordAudioLog(
  step: string,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info",
  details?: any
): void {
  const now = new Date();
  const timeStr = `${now.toLocaleTimeString("pt-BR")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
  const entry: DiagnosticLogEntry = {
    timestamp: timeStr,
    step,
    message,
    level,
    details,
  };

  diagnosticLogs.unshift(entry);
  if (diagnosticLogs.length > 50) {
    diagnosticLogs.pop();
  }

  // Emite evento customizado para UI reativa
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("webgran-audio-log", { detail: entry }));
    } catch {}
  }

  const prefix = `[AudioDiag:${step}]`;
  if (level === "error") {
    console.error(prefix, message, details || "");
  } else if (level === "warn") {
    console.warn(prefix, message, details || "");
  } else {
    console.log(prefix, message, details || "");
  }
}

/**
 * Retorna os logs de diagnóstico registrados no ciclo de vida atual.
 */
export function getAudioDiagnosticLogs(): DiagnosticLogEntry[] {
  return [...diagnosticLogs];
}

/**
 * Limpa o histórico de logs de diagnóstico.
 */
export function clearAudioDiagnosticLogs(): void {
  diagnosticLogs.length = 0;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("webgran-audio-log-clear"));
    } catch {}
  }
}

/**
 * Retorna se o som de notificações está ativado pelo usuário.
 * Padrão: true.
 */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === null) return true; // padrão ativado
    return val === "true";
  } catch {
    return true;
  }
}

/**
 * Define e persiste a preferência de som de notificação no localStorage.
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    recordAudioLog("PREFERENCIA", `Som ${enabled ? "ativado" : "desativado"} pelo usuário no localStorage`, "info");
  } catch (err: any) {
    recordAudioLog("PREFERENCIA", `Erro ao salvar preferência: ${err?.message}`, "warn");
  }
}

/**
 * Retorna ou inicializa com segurança uma instância do AudioContext.
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        audioContext = new AudioCtx();
        recordAudioLog("3_AUDIOCONTEXT", `AudioContext criado com sucesso. Estado inicial: ${audioContext.state}`, "info", {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state,
        });
      } catch (err: any) {
        recordAudioLog("3_AUDIOCONTEXT", `Falha ao instanciar AudioContext: ${err?.message}`, "warn");
      }
    } else {
      recordAudioLog("3_AUDIOCONTEXT", "Navegador não possui suporte a AudioContext", "warn");
    }
  }
  return audioContext;
}

/**
 * Pré-carrega e decodifica o arquivo MP3 de notificação na memória via Web Audio API.
 * Utiliza o áudio Base64 embutido para garantir decodificação offline imediata sem Range requests.
 */
async function preloadAudioBuffer(): Promise<void> {
  if (typeof window === "undefined" || decodedAudioBuffer || isAudioBufferLoading) return;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  isAudioBufferLoading = true;
  recordAudioLog("4_CARREGAMENTO", "Iniciando pré-carregamento e decodificação do buffer de áudio na memória...", "info");

  try {
    // 1. Tenta carregar a partir do Base64 embutido (100% resiliente a problemas de rede/Range requests)
    const base64Data = COMMISSION_AUDIO_DATA_URI.split(",")[1];
    if (base64Data && typeof window.atob === "function") {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      decodedAudioBuffer = await ctx.decodeAudioData(bytes.buffer);
      recordAudioLog("4_CARREGAMENTO", `Buffer de áudio decodificado com sucesso em memória (${decodedAudioBuffer.duration.toFixed(2)}s, ${decodedAudioBuffer.numberOfChannels}ch, ${decodedAudioBuffer.sampleRate}Hz)`, "success");
      return;
    }

    // 2. Fallback: fetch HTTP caso Base64 não esteja disponível
    const response = await fetch(getNotificationSoundUrl(), { cache: "force-cache" });
    recordAudioLog("4_CARREGAMENTO", `Resposta HTTP para ${getNotificationSoundUrl()}: ${response.status} ${response.statusText}`, response.ok ? "info" : "warn");
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      decodedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
      recordAudioLog("4_CARREGAMENTO", `Buffer HTTP decodificado com sucesso (${decodedAudioBuffer.duration.toFixed(2)}s)`, "success");
    }
  } catch (err: any) {
    recordAudioLog("4_CARREGAMENTO", `Falha na decodificação do buffer: ${err?.message}`, "warn");
  } finally {
    isAudioBufferLoading = false;
  }
}

/**
 * Desbloqueia o AudioContext e o subsistema de áudio sob interação real do usuário.
 * Dispara um buffer silencioso para retirar a restrição de autoplay do Chrome e iOS Safari.
 */
export async function unlockAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    recordAudioLog("3_AUDIOCONTEXT", `unlockAudioContext invocado. Estado atual: ${ctx.state}`, "info");

    if (ctx.state === "suspended") {
      await ctx.resume().catch((err) => {
        recordAudioLog("3_AUDIOCONTEXT", `ctx.resume() rejeitado: ${err?.message}`, "warn");
      });
      const isRunning = (ctx.state as string) === "running";
      recordAudioLog("3_AUDIOCONTEXT", `ctx.resume() executado. Novo estado: ${ctx.state}`, isRunning ? "success" : "warn");
    }

    // Toca 1 sample de silêncio para desarmar a política de restrição de autoplay
    try {
      if (typeof ctx.createBuffer === "function" && typeof ctx.createBufferSource === "function") {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        recordAudioLog("3_AUDIOCONTEXT", "Buffer silencioso de 1 sample disparado para autorização de mídia", "info");
      }
    } catch (silentErr: any) {
      recordAudioLog("3_AUDIOCONTEXT", `Erro ao tocar buffer silencioso: ${silentErr?.message}`, "warn");
    }

    // Pré-carrega o buffer MP3 de forma não-bloqueante
    preloadAudioBuffer().catch(() => {});
  } catch (err: any) {
    recordAudioLog("3_AUDIOCONTEXT", `Exceção em unlockAudioContext: ${err?.message}`, "error");
  }
}

/**
 * Sintetiza o sino de notificação via Web Audio API caso o carregamento do arquivo estático falhe.
 * Harmônicos ajustados com base na análise espectral do áudio de referência (~1450 Hz, ~3850 Hz, ~6500 Hz).
 */
export async function synthesizeChimeFallback(ctx: AudioContext): Promise<boolean> {
  recordAudioLog("7_FALLBACK", "Iniciando sintetizador harmônico senoidal via Web Audio API...", "info");
  try {
    const now = ctx.currentTime;
    const frequencies = [1450, 3850, 6500];
    const gains = [0.4, 0.18, 0.1];

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.75, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      oscGain.gain.setValueAtTime(gains[idx] || 0.1, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 1.25);
    });

    recordAudioLog("7_FALLBACK", "Sintetizador harmônico senoidal disparado com sucesso!", "success");
    return true;
  } catch (err: any) {
    recordAudioLog("7_FALLBACK", `Falha ao executar sintetizador: ${err?.message}`, "error");
    return false;
  }
}

/**
 * Reproduz o som de notificação/comissão com diagnóstico e tripla redundância.
 * Respeita preferências, deduplicação por eventId e políticas de autoplay.
 */
export async function playCommissionChime(options?: {
  eventId?: string;
  force?: boolean;
  synchronousAudioInstance?: HTMLAudioElement | null;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const startTime = Date.now();
  const { eventId, force = false, synchronousAudioInstance } = options || {};

  recordAudioLog("2_CHAMADA", `playCommissionChime chamada. eventId=${eventId || "nenhum"}, force=${force}`, "info");

  // 1. Respeitar preferência salva (a menos que seja um teste forçado)
  if (!force && !isNotificationSoundEnabled()) {
    recordAudioLog("2_CHAMADA", "Som desativado nas preferências do usuário. Abortando.", "warn");
    return false;
  }

  // 2. Prevenir reprodução duplicada para o mesmo evento
  if (eventId) {
    if (!force && playedSoundEvents.has(eventId)) {
      recordAudioLog("2_CHAMADA", `Evento '${eventId}' já foi reproduzido anteriormente. Deduplicação ativa.`, "warn");
      return false;
    }
    playedSoundEvents.add(eventId);
  }

  // 3. Tentativa 1: HTMLAudioElement
  try {
    const audioEl = synchronousAudioInstance || cachedAudioElement || new Audio(COMMISSION_AUDIO_DATA_URI);
    if (!cachedAudioElement) {
      cachedAudioElement = audioEl;
    }

    recordAudioLog("5_HTML5_PLAY", `Disparando HTMLAudioElement.play(). readyState=${audioEl.readyState}, volume=${audioEl.volume}, muted=${audioEl.muted}`, "info");

    audioEl.currentTime = 0;
    const playPromise = audioEl.play();

    if (playPromise !== undefined) {
      await playPromise;
      const elapsed = Date.now() - startTime;
      recordAudioLog("5_HTML5_PLAY", `HTMLAudioElement.play() resolvido com sucesso! (${elapsed}ms)`, "success");
      recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via HTML5 Audio (${elapsed}ms)`, "success");
      return true;
    }
  } catch (audioErr: any) {
    recordAudioLog("6_ERRO_REJEICAO", `HTMLAudioElement falhou: [${audioErr?.name || "Error"}] ${audioErr?.message || "Erro desconhecido"}`, "warn", {
      name: audioErr?.name,
      message: audioErr?.message,
    });
    cachedAudioElement = null;
  }

  // 4. Tentativa 2: Web Audio API com Buffer Pré-decodificado em memória (zero latência)
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        recordAudioLog("3_AUDIOCONTEXT", "AudioContext suspenso. Tentando ctx.resume()...", "info");
        await ctx.resume().catch(() => {});
      }

      // Se o buffer não estava carregado, tenta carregar imediatamente
      if (!decodedAudioBuffer) {
        await preloadAudioBuffer();
      }

      if (decodedAudioBuffer && ctx.state === "running") {
        recordAudioLog("7_FALLBACK", "Reproduzindo via Web Audio AudioBufferSourceNode em memória...", "info");
        const source = ctx.createBufferSource();
        source.buffer = decodedAudioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.85, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);

        const elapsed = Date.now() - startTime;
        recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via Web Audio AudioBuffer (${elapsed}ms)`, "success");
        return true;
      }

      // 5. Tentativa 3: Sintetizador Harmônico senoidal
      if (ctx.state === "running") {
        const synthSuccess = await synthesizeChimeFallback(ctx);
        if (synthSuccess) {
          const elapsed = Date.now() - startTime;
          recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via Sintetizador Harmônico (${elapsed}ms)`, "success");
          return true;
        }
      }
    }
  } catch (ctxErr: any) {
    recordAudioLog("6_ERRO_REJEICAO", `Fallback Web Audio falhou: ${ctxErr?.message}`, "error");
  }

  const elapsed = Date.now() - startTime;
  recordAudioLog("8_RESULTADO", `Todas as tentativas de reprodução falharam após ${elapsed}ms`, "error");
  return false;
}

/**
 * Retorna o caminho do arquivo de áudio oficial do WebGran.
 */
export function getNotificationSoundUrl(): string {
  return "/sounds/commission.mp3";
}

/**
 * Reseta o estado interno de som para suítes de teste automatizadas.
 */
export function _resetNotificationSoundStateForTesting(): void {
  playedSoundEvents.clear();
  cachedAudioElement = null;
  audioContext = null;
  decodedAudioBuffer = null;
  isAudioBufferLoading = false;
  isForegroundListenerRegistered = false;
  diagnosticLogs.length = 0;
}

/**
 * Registra o listener global para tocar o som de notificação no primeiro plano
 * quando o Service Worker receber um evento Web Push.
 */
export function setupForegroundNotificationSoundListener(): void {
  if (typeof window === "undefined" || isForegroundListenerRegistered) return;
  isForegroundListenerRegistered = true;

  recordAudioLog("INICIALIZACAO", "setupForegroundNotificationSoundListener ativado com sucesso.", "info");

  // 1. Desbloqueio preventivo de autoplay sob primeira interação do usuário (toque, clique ou tecla)
  if (typeof window.addEventListener === "function") {
    const handleFirstInteraction = () => {
      recordAudioLog("INTERACAO_USUARIO", "Primeira interação do usuário detectada (toque/clique). Destravando áudio...", "info");
      unlockAudioContext().catch(() => {});

      // Prepara o elemento HTML5 Audio para compatibilidade com Chrome Android
      try {
        if (!cachedAudioElement) {
          cachedAudioElement = new Audio(getNotificationSoundUrl());
          cachedAudioElement.preload = "auto";
        }
        if (typeof cachedAudioElement.load === "function") {
          cachedAudioElement.load();
        }
      } catch {}

      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("click", handleFirstInteraction);
        window.removeEventListener("touchstart", handleFirstInteraction);
        window.removeEventListener("keydown", handleFirstInteraction);
      }
    };

    window.addEventListener("click", handleFirstInteraction, { once: true, passive: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true, passive: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true, passive: true });
  }

  // 2. Escutar eventos enviados pelo Service Worker
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "WEBGRAN_PUSH_RECEIVED") {
        const payload = event.data.payload;
        const eventId = payload?.data?.orderId || payload?.tag || `push-${Date.now()}`;
        recordAudioLog("1_EVENTO", `Mensagem WEBGRAN_PUSH_RECEIVED recebida do Service Worker para eventId=${eventId}`, "info", payload);

        playCommissionChime({ eventId }).catch((err) => {
          recordAudioLog("6_ERRO_REJEICAO", `Falha ao reproduzir áudio vindo de evento push: ${err?.message}`, "error");
        });
      }
    });
  }
}
