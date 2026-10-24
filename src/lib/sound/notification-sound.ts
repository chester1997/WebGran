/**
 * Utilitário de reprodução sonora para notificações do WebGran.
 * Baseado no áudio de referência fornecido, com áudio leve pré-carregado
 * e fallback sintetizado via Web Audio API.
 */

const STORAGE_KEY = "webgran_notification_sound_enabled";

const playedSoundEvents = new Set<string>();
let cachedAudioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

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
  } catch (err) {
    console.warn("[NotificationSound] Erro ao salvar preferência:", err);
  }
}

/**
 * Desbloqueia o AudioContext sob interação do usuário para compatibilidade com autoplay.
 */
export async function unlockAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch (err) {
    // Autoplay policy or browser limitation
  }
}

/**
 * Sintetiza o sino de notificação via Web Audio API caso o carregamento do arquivo estático falhe.
 * Harmônicos ajustados com base na análise espectral do áudio de referência (~1450 Hz, ~3850 Hz, ~6500 Hz).
 */
async function synthesizeChimeFallback(ctx: AudioContext): Promise<void> {
  const now = ctx.currentTime;
  const frequencies = [1450, 3850, 6500];
  const gains = [0.35, 0.15, 0.08];

  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.7, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    oscGain.gain.setValueAtTime(gains[idx] || 0.1, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 1.2);
  });
}

/**
 * Reproduz o som de notificação/comissão.
 * Respeita preferências, deduplicação por eventId e políticas de autoplay.
 */
export async function playCommissionChime(options?: {
  eventId?: string;
  force?: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const { eventId, force = false } = options || {};

  // 1. Respeitar preferência salva (a menos que seja um teste forçado)
  if (!force && !isNotificationSoundEnabled()) {
    return false;
  }

  // 2. Prevenir reprodução duplicada para o mesmo evento
  if (eventId) {
    if (playedSoundEvents.has(eventId)) {
      return false;
    }
    playedSoundEvents.add(eventId);
  }

  // 3. Tentativa 1: HTMLAudioElement com o arquivo otimizado (/sounds/commission.mp3)
  try {
    if (!cachedAudioElement) {
      cachedAudioElement = new Audio("/sounds/commission.mp3");
      cachedAudioElement.preload = "auto";
    }

    cachedAudioElement.currentTime = 0;
    const playPromise = cachedAudioElement.play();
    if (playPromise !== undefined) {
      await playPromise;
      return true;
    }
  } catch (audioErr: any) {
    // Se o HTMLAudioElement for bloqueado por política ou falhar carregamento, tenta o sintetizador
    console.warn("[NotificationSound] Audio elemento falhou, tentando fallback Web Audio:", audioErr?.message);
  }

  // 4. Tentativa 2: Web Audio API Oscillator Chime
  try {
    await unlockAudioContext();
    if (audioContext && audioContext.state === "running") {
      await synthesizeChimeFallback(audioContext);
      return true;
    }
  } catch (ctxErr) {
    console.warn("[NotificationSound] Fallback sintetizador indisponível:", ctxErr);
  }

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
  isForegroundListenerRegistered = false;
}

/**
 * Registra o listener global para tocar o som de notificação no primeiro plano
 * quando o Service Worker receber um evento Web Push.
 * Inclui desbloqueio preventivo de autoplay sob o primeiro toque/clique do usuário
 * tanto para o Web Audio API quanto para o elemento HTML5 Audio.
 */
let isForegroundListenerRegistered = false;

export function setupForegroundNotificationSoundListener(): void {
  if (typeof window === "undefined" || isForegroundListenerRegistered) return;
  isForegroundListenerRegistered = true;

  // 1. Desbloqueio preventivo de autoplay sob primeira interação do usuário (toque, clique ou tecla)
  if (typeof window.addEventListener === "function") {
    const handleFirstInteraction = () => {
      // Desbloqueia AudioContext
      unlockAudioContext().catch(() => {});

      // Pré-carrega e prepara o elemento HTML5 Audio para contornar o bloqueio de Autoplay no Chrome Android
      try {
        if (!cachedAudioElement) {
          cachedAudioElement = new Audio(getNotificationSoundUrl());
          cachedAudioElement.preload = "auto";
        }
        if (typeof cachedAudioElement.load === "function") {
          cachedAudioElement.load();
        }
      } catch {
        // Ignora caso o ambiente não suporte Audio
      }

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
        // Toca o sino no primeiro plano respeitando as preferências do usuário e deduplicação
        playCommissionChime({ eventId }).catch((err) => {
          console.warn("[NotificationSound] Falha ao reproduzir áudio em primeiro plano:", err);
        });
      }
    });
  }
}

