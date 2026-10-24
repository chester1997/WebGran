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
