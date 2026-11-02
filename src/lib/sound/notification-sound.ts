/**
 * Utilitário de reprodução sonora e diagnóstico técnico para notificações do WebGran.
 * Suporta reprodução em memória via Base64 Data URI, carregamento HTTP (/sounds/commission.mp3),
 * Web Audio API (AudioBuffer decodificado) e sintetizador harmônico senoidal.
 */

import { COMMISSION_AUDIO_DATA_URI } from "./commission-audio-data";

const STORAGE_KEY = "webgran_notification_sound_enabled";
const PREFS_STORAGE_PREFIX = "webgran_sound_config";

export interface NotificationSoundPreferences {
  enabled: boolean;
  soundId: string;
  volume: number; // 0 to 100
}

export interface DiagnosticLogEntry {
  timestamp: string;
  step: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
  details?: any;
}

const diagnosticLogs: DiagnosticLogEntry[] = [];
const playedSoundEvents = new Set<string>();
let sharedAudioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let decodedAudioBuffer: AudioBuffer | null = null;
let isAudioBufferLoading = false;
let isForegroundListenerRegistered = false;
let isSystemUnlocked = false;
let lastSoundPlayedAt = 0;

/**
 * Verifica se um evento sonoro já foi reproduzido recentemente neste dispositivo (cross-tab / em memória).
 */
export function isEventRecentlyPlayed(eventId: string): boolean {
  if (playedSoundEvents.has(eventId)) return true;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const val = localStorage.getItem(`webgran_sound_played_${eventId}`);
      if (val) {
        const diff = Date.now() - parseInt(val, 10);
        if (diff < 15000) return true; // 15 segundos de retenção contra duplicatas
      }
    } catch {}
  }
  return false;
}

/**
 * Marca o evento como reproduzido na memória e no storage compartilhado entre abas.
 */
export function markEventAsPlayed(eventId: string): void {
  playedSoundEvents.add(eventId);
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`webgran_sound_played_${eventId}`, Date.now().toString());
      // Limpeza de chaves antigas se houver acúmulo
      if (localStorage.length > 25) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("webgran_sound_played_")) {
            const v = localStorage.getItem(k);
            if (v && Date.now() - parseInt(v, 10) > 60000) {
              localStorage.removeItem(k);
            }
          }
        }
      }
    } catch {}
  }
}

/**
 * Retorna as preferências completas de som de notificação para o usuário (por dispositivo).
 */
export function getNotificationSoundPreferences(userId?: string): NotificationSoundPreferences {
  if (typeof window === "undefined") {
    return { enabled: true, soundId: "commission", volume: 80 };
  }

  try {
    // 1. Tenta chave específica do usuário se userId for informado
    if (userId) {
      const userKey = `${PREFS_STORAGE_PREFIX}_${userId}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        return {
          enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
          soundId: parsed.soundId || "commission",
          volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(100, parsed.volume)) : 80,
        };
      }
    }

    // 2. Tenta chave padrão/compartilhada sem sufixo
    const rawGlobal = localStorage.getItem(PREFS_STORAGE_PREFIX);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      return {
        enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
        soundId: parsed.soundId || "commission",
        volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(100, parsed.volume)) : 80,
      };
    }

    // 3. Se userId não foi informado, varre as chaves existentes de usuários para preservar volume customizado
    if (!userId) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${PREFS_STORAGE_PREFIX}_`)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              return {
                enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
                soundId: parsed.soundId || "commission",
                volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(100, parsed.volume)) : 80,
              };
            } catch {}
          }
        }
      }
    }

    // 4. Fallback legado
    const legacyVal = localStorage.getItem(STORAGE_KEY);
    const enabled = legacyVal === null ? true : legacyVal === "true";
    return { enabled, soundId: "commission", volume: 80 };
  } catch {
    return { enabled: true, soundId: "commission", volume: 80 };
  }
}

/**
 * Salva as preferências de som de notificação no localStorage.
 */

export const WEBGRAN_NOTIFICATIONS_DB_NAME = "webgran_notifications_db";
export const WEBGRAN_NOTIFICATIONS_DB_VERSION = 1;
export const SOUND_PREFS_STORE_NAME = "sound_preferences";

/**
 * Abre ou cria o banco IndexedDB para armazenamento persistente de preferências
 * acessível tanto pela página (window) quanto pelo Service Worker (sw.js com PWA fechado).
 */
export function openNotificationsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não suportado neste ambiente."));
      return;
    }

    const request = indexedDB.open(WEBGRAN_NOTIFICATIONS_DB_NAME, WEBGRAN_NOTIFICATIONS_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SOUND_PREFS_STORE_NAME)) {
        db.createObjectStore(SOUND_PREFS_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error || new Error("Falha ao abrir IndexedDB"));
    };
  });
}

/**
 * Salva as preferências no IndexedDB para consulta do Service Worker quando o PWA estiver fechado.
 */
export async function savePreferencesToIndexedDB(
  prefs: NotificationSoundPreferences,
  userId?: string
): Promise<boolean> {
  try {
    const db = await openNotificationsDB();
    const tx = db.transaction(SOUND_PREFS_STORE_NAME, "readwrite");
    const store = tx.objectStore(SOUND_PREFS_STORE_NAME);

    const now = Date.now();
    const records = [
      {
        key: "active_preference",
        userId: userId || undefined,
        soundEnabled: prefs.enabled,
        volume: prefs.volume,
        soundId: prefs.soundId,
        updatedAt: now,
      },
    ];

    if (userId) {
      records.push({
        key: `user_${userId}`,
        userId,
        soundEnabled: prefs.enabled,
        volume: prefs.volume,
        soundId: prefs.soundId,
        updatedAt: now,
      });
    }

    for (const record of records) {
      store.put(record);
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err: any) {
    recordAudioLog("INDEXEDDB", `Falha ao salvar preferências no IndexedDB: ${err?.message}`, "warn");
    return false;
  }
}

/**
 * Consulta as preferências no IndexedDB.
 */
export async function getPreferencesFromIndexedDB(
  userId?: string
): Promise<NotificationSoundPreferences | null> {
  try {
    const db = await openNotificationsDB();
    const tx = db.transaction(SOUND_PREFS_STORE_NAME, "readonly");
    const store = tx.objectStore(SOUND_PREFS_STORE_NAME);

    const queryKey = userId ? `user_${userId}` : "active_preference";
    const request = store.get(queryKey);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const res = request.result;
        if (res) {
          db.close();
          resolve({
            enabled: typeof res.soundEnabled === "boolean" ? res.soundEnabled : true,
            volume: typeof res.volume === "number" ? res.volume : 80,
            soundId: res.soundId || "commission",
          });
        } else if (userId) {
          // Fallback para active_preference
          const fallbackReq = store.get("active_preference");
          fallbackReq.onsuccess = () => {
            db.close();
            const fallbackRes = fallbackReq.result;
            if (fallbackRes) {
              resolve({
                enabled: typeof fallbackRes.soundEnabled === "boolean" ? fallbackRes.soundEnabled : true,
                volume: typeof fallbackRes.volume === "number" ? fallbackRes.volume : 80,
                soundId: fallbackRes.soundId || "commission",
              });
            } else {
              resolve(null);
            }
          };
          fallbackReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } else {
          db.close();
          resolve(null);
        }
      };

      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (err: any) {
    return null;
  }
}

export function saveNotificationSoundPreferences(
  prefs: Partial<NotificationSoundPreferences>,
  userId?: string
): void {
  if (typeof window === "undefined") return;

  try {
    const current = getNotificationSoundPreferences(userId);
    const updated: NotificationSoundPreferences = {
      ...current,
      ...prefs,
    };

    const serialized = JSON.stringify(updated);
    if (userId) {
      localStorage.setItem(`${PREFS_STORAGE_PREFIX}_${userId}`, serialized);
    }
    // Salva também na chave global/ativa para que leitores sem userId encontrem a configuração atual
    localStorage.setItem(PREFS_STORAGE_PREFIX, serialized);
    localStorage.setItem(STORAGE_KEY, updated.enabled ? "true" : "false");

    // Sincroniza imediatamente com o IndexedDB para o Service Worker consultar com o app fechado
    savePreferencesToIndexedDB(updated, userId).catch(() => {});

    recordAudioLog("PREFERENCIA", `Preferências salvas: enabled=${updated.enabled}, volume=${updated.volume}%`, "info");
  } catch (err: any) {
    recordAudioLog("PREFERENCIA", `Erro ao salvar preferências: ${err?.message}`, "warn");
  }
}

/**
 * Verifica se os logs de diagnóstico de áudio no console estão ativados.
 * Padrão: DESLIGADO (ativado somente se localStorage.getItem("webgran_debug_audio") === "1").
 */
export function isAudioDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("webgran_debug_audio") === "1";
  } catch {
    return false;
  }
}

/**
 * Ativa ou desativa a exibição dos logs [AudioDiag:*] no console do navegador.
 */
export function setAudioDebugEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem("webgran_debug_audio", "1");
    } else {
      localStorage.removeItem("webgran_debug_audio");
    }
  } catch {}
}

/**
 * Adiciona um log estruturado ao buffer de diagnóstico técnico e ao console do navegador
 * (apenas se a flag de depuração estiver ativada).
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

  // Logs no console são silenciados por padrão; só exibem se webgran_debug_audio === "1"
  if (isAudioDebugEnabled()) {
    const prefix = `[AudioDiag:${step}]`;
    if (level === "error") {
      console.error(prefix, message, details || "");
    } else if (level === "warn") {
      console.warn(prefix, message, details || "");
    } else {
      console.log(prefix, message, details || "");
    }
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
 * Detecta se o ambiente atual é iOS (iPhone, iPad, iPod) ou iPadOS.
 */
export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Retorna ou inicializa o elemento HTMLAudioElement compartilhado (singleton).
 */
export function getOrCreateSharedAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioElement) {
    try {
      sharedAudioElement = new Audio(getNotificationSoundUrl());
      sharedAudioElement.preload = "auto";
    } catch {
      sharedAudioElement = null;
    }
  }
  return sharedAudioElement;
}

/**
 * Desbloqueia o subsistema de áudio (HTMLAudioElement singleton + AudioContext).
 * O Chrome libera o áudio da página inteira após qualquer interação do usuário (User Activation).
 * A restrição de reaproveitar a mesma instância pré-ativada vale especificamente para o Safari/iOS.
 * No iOS/Safari o volume do HTMLMediaElement não é ajustável. O desbloqueio DEVE usar muted = true (play + pause),
 * nunca volume 0. O controle de volume no iOS utiliza o GainNode da Web Audio API.
 */
export async function unlockAudioSystem(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  let audioUnlocked = false;

  // 1. Desbloqueia o elemento HTML5 Audio compartilhado
  try {
    const audioEl = getOrCreateSharedAudioElement();
    if (audioEl) {
      if (typeof audioEl.load === "function") {
        try {
          audioEl.load();
        } catch {}
      }
      // Safari/iOS: volume é somente leitura e ignorado pelo WebKit.
      // O silenciamento durante o desbloqueio DEVE usar muted = true, NUNCA volume 0.
      audioEl.muted = true;
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        await playPromise;
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.muted = false; // Desmuta para permitir reprodução futura
        audioUnlocked = true;
        isSystemUnlocked = true;
        recordAudioLog("3_DESBLOQUEIO", "HTMLAudioElement compartilhado desbloqueado com sucesso (muted=true)!", "success");
      }
    }
  } catch (err: any) {
    recordAudioLog("3_DESBLOQUEIO", `Erro ao desbloquear HTMLAudioElement: ${err?.message}`, "warn");
  }

  // 2. Desbloqueia AudioContext (retoma estado e dispara buffer silencioso)
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      if ((ctx.state as string) === "running") {
        audioUnlocked = true;
        isSystemUnlocked = true;
        recordAudioLog("3_DESBLOQUEIO", "AudioContext retomado com sucesso!", "success");
      }

      // Reproduz 1 amostra de áudio silenciosa para destravar pipelines de áudio do sistema
      if (typeof ctx.createBuffer === "function" && typeof ctx.createBufferSource === "function") {
        try {
          const silentBuffer = ctx.createBuffer(1, 1, 22050);
          const silentSource = ctx.createBufferSource();
          silentSource.buffer = silentBuffer;
          silentSource.connect(ctx.destination);
          silentSource.start(0);
        } catch {}
      }
    }
    preloadAudioBuffer().catch(() => {});
  } catch (ctxErr: any) {
    recordAudioLog("3_DESBLOQUEIO", `Erro ao desbloquear AudioContext: ${ctxErr?.message}`, "warn");
  }

  return audioUnlocked;
}

/**
 * Desbloqueia o AudioContext sob interação real do usuário.
 */
export async function unlockAudioContext(): Promise<void> {
  await unlockAudioSystem();
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
  volume?: number;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const startTime = Date.now();
  const { eventId, force = false, synchronousAudioInstance } = options || {};

  recordAudioLog("2_CHAMADA", `playCommissionChime chamada. eventId=${eventId || "nenhum"}, force=${force}`, "info");

  // 1. Respeitar preferência salva (a menos que seja um teste forçado)
  const prefs = getNotificationSoundPreferences();
  if (!force && !prefs.enabled) {
    recordAudioLog("2_CHAMADA", "Som desativado nas preferências do usuário. Abortando.", "warn");
    return false;
  }

  // 2. Prevenir reprodução duplicada para o mesmo evento (em memória e cross-tab)
  if (eventId) {
    if (!force && isEventRecentlyPlayed(eventId)) {
      recordAudioLog("2_CHAMADA", `Evento '${eventId}' já foi reproduzido anteriormente. Deduplicação ativa.`, "warn");
      return false;
    }
    markEventAsPlayed(eventId);
  }

  const effectiveVolume = typeof options?.volume === "number" 
    ? Math.max(0, Math.min(1, options.volume / 100))
    : Math.max(0, Math.min(1, prefs.volume / 100));

  const isIosDevice = isIOS();

  // No iOS/Safari o volume do HTMLMediaElement não é ajustável (é ignorado pelo WebKit).
  // Se for iOS, prioriza a reprodução via GainNode da Web Audio API para controle real de volume.
  if (isIosDevice) {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
        if (!decodedAudioBuffer) {
          await preloadAudioBuffer();
        }
        if (decodedAudioBuffer && ctx.state === "running") {
          recordAudioLog("7_FALLBACK", "iOS detectado: reproduzindo com atenuação via GainNode (Web Audio API)...", "info");
          const source = ctx.createBufferSource();
          source.buffer = decodedAudioBuffer;
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start(0);

          const elapsed = Date.now() - startTime;
          lastSoundPlayedAt = Date.now();
          recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via Web Audio GainNode (${elapsed}ms)`, "success");
          return true;
        }
      }
    } catch (iosErr: any) {
      recordAudioLog("7_FALLBACK", `Falha ao reproduzir via Web Audio no iOS: ${iosErr?.message}`, "warn");
    }
  }

  // 3. Tentativa 1: HTMLAudioElement compartilhado
  try {
    const audioEl = synchronousAudioInstance || getOrCreateSharedAudioElement() || new Audio(getNotificationSoundUrl());
    if (audioEl) {
      if (!isIosDevice) {
        audioEl.volume = effectiveVolume;
      }
      audioEl.muted = false;
      audioEl.currentTime = 0;

      recordAudioLog("5_HTML5_PLAY", `Disparando HTMLAudioElement.play(). volume=${audioEl.volume}`, "info");

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        await playPromise;
        const elapsed = Date.now() - startTime;
        lastSoundPlayedAt = Date.now();
        recordAudioLog("5_HTML5_PLAY", `HTMLAudioElement.play() resolvido com sucesso! (${elapsed}ms)`, "success");
        recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via HTML5 Audio (${elapsed}ms)`, "success");
        return true;
      }
    }
  } catch (audioErr: any) {
    recordAudioLog("6_ERRO_REJEICAO", `HTMLAudioElement falhou: [${audioErr?.name || "Error"}] ${audioErr?.message || "Erro desconhecido"}`, "warn", {
      name: audioErr?.name,
      message: audioErr?.message,
    });
    // Não aborta prematuramente: permite que o Web Audio API tente reproduzir caso o AudioContext esteja em estado running
  }

  // 4. Tentativa 2: Web Audio API com Buffer Pré-decodificado em memória (zero latência e controle de volume via GainNode)
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        recordAudioLog("3_AUDIOCONTEXT", "AudioContext suspenso. Tentando ctx.resume()...", "info");
        await ctx.resume().catch(() => {});
      }

      if (!decodedAudioBuffer) {
        await preloadAudioBuffer();
      }

      if (decodedAudioBuffer && ctx.state === "running") {
        recordAudioLog("7_FALLBACK", "Reproduzindo via Web Audio AudioBufferSourceNode em memória com GainNode...", "info");
        const source = ctx.createBufferSource();
        source.buffer = decodedAudioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);

        const elapsed = Date.now() - startTime;
        lastSoundPlayedAt = Date.now();
        recordAudioLog("8_RESULTADO", `Reprodução concluída com sucesso via Web Audio AudioBuffer (${elapsed}ms)`, "success");
        return true;
      }

      // 5. Tentativa 3: Sintetizador Harmônico senoidal
      if (ctx.state === "running") {
        const synthSuccess = await synthesizeChimeFallback(ctx);
        if (synthSuccess) {
          lastSoundPlayedAt = Date.now();
          return true;
        }
      }
    }
  } catch (webAudioErr: any) {
    recordAudioLog("7_FALLBACK", `Web Audio API falhou: ${webAudioErr?.message}`, "warn");
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
 * Emite evento na tela para avisar a UI sobre uma venda recebida.
 */
export function dispatchVisualSaleEvent(payload: any): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("webgran-sale-received", { detail: payload }));
    } catch {}
  }
}

/**
 * Emite evento de bloqueio de autoplay para exibir aviso "Toque aqui para ativar o som".
 */
export function dispatchAutoplayBlockedEvent(payload: any): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("webgran-audio-autoplay-blocked", { detail: payload }));
    } catch {}
  }
}

/**
 * Reseta o estado interno de som para suítes de teste automatizadas.
 */
export function _resetNotificationSoundStateForTesting(): void {
  playedSoundEvents.clear();
  sharedAudioElement = null;
  audioContext = null;
  decodedAudioBuffer = null;
  isAudioBufferLoading = false;
  isForegroundListenerRegistered = false;
  isSystemUnlocked = false;
  lastSoundPlayedAt = 0;
  diagnosticLogs.length = 0;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("webgran_sound_played_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

/**
 * Registra o listener global para tocar o som de notificação no primeiro plano
 * quando o Service Worker receber um evento Web Push (SALE_SOUND ou WEBGRAN_PUSH_RECEIVED).
 */
export function setupForegroundNotificationSoundListener(): void {
  if (typeof window === "undefined" || isForegroundListenerRegistered) return;
  isForegroundListenerRegistered = true;

  recordAudioLog("INICIALIZACAO", "setupForegroundNotificationSoundListener ativado com sucesso.", "info");

  // 1. Desbloqueio em eventos de interação reais: click, pointerup, touchend e keydown
  // O Chrome libera o áudio da página inteira após qualquer interação do usuário (User Activation).
  // A restrição de exigir o reaproveitamento da mesma instância pré-ativada vale especificamente para o Safari/iOS.
  // Não usa pointerdown/touchstart (gestos preliminares). Não usa { once: true }.
  // Remove os listeners apenas DEPOIS de o desbloqueio ser bem-sucedido (play resolvido ou ctx.state === "running").
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    const unlockEvents = ["click", "pointerup", "touchend", "keydown"] as const;

    const handleUnlockInteraction = async () => {
      recordAudioLog("INTERACAO_USUARIO", "Interação do usuário detectada. Tentando destravar subsistema de áudio...", "info");
      const unlocked = await unlockAudioSystem().catch(() => false);
      if (unlocked) {
        recordAudioLog("INTERACAO_USUARIO", "Desbloqueio concluído com sucesso. Removendo listeners de ativação.", "success");
        if (typeof window.removeEventListener === "function") {
          for (const evt of unlockEvents) {
            window.removeEventListener(evt, handleUnlockInteraction);
          }
        }
      }
    };

    for (const evt of unlockEvents) {
      window.addEventListener(evt, handleUnlockInteraction, { passive: true });
    }
  }

  // 2. Escutar eventos enviados pelo Service Worker (SALE_SOUND e WEBGRAN_PUSH_RECEIVED)
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", async (event) => {
      const type = event.data?.type;
      if (type !== "SALE_SOUND" && type !== "WEBGRAN_PUSH_RECEIVED") {
        return;
      }

      const responsePort = event.ports && event.ports[0] ? event.ports[0] : null;
      const payload = event.data.payload || event.data;
      const notificationId = event.data.notificationId || payload?.data?.orderId || payload?.tag || `push-${Date.now()}`;

      recordAudioLog("1_EVENTO", `Mensagem ${type} recebida para notificationId=${notificationId}`, "info", payload);

      // Verificação honesta de visibilidade e foco da página
      const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const isFocused = typeof document === "undefined" || typeof document.hasFocus !== "function" || document.hasFocus();

      // Regra: Se o documento estiver oculto ou sem foco, não toca som personalizado na aba
      // e responde playedSound: false para o Service Worker emitir a notificação nativa com som do sistema (silent: false).
      if (isHidden || !isFocused) {
        recordAudioLog("2_VISIBILIDADE", `Página ${isHidden ? "oculta" : "sem foco"}. Deixando som a cargo do sistema operacional.`, "info");
        if (responsePort) {
          responsePort.postMessage({
            confirmed: false,
            playedSound: false,
            reason: isHidden ? "hidden" : "unfocused",
          });
        }
        return;
      }

      // Lê preferências do usuário
      const prefs = getNotificationSoundPreferences();

      // Se a preferência estiver DESLIGADA:
      if (!prefs.enabled) {
        recordAudioLog("2_PREFERENCIA", "Som desativado pelo usuário. Exibindo apenas alerta visual na tela.", "info");
        dispatchVisualSaleEvent(payload);
        if (responsePort) {
          responsePort.postMessage({
            confirmed: true,
            playedSound: false,
            soundDisabledByUser: true,
            showedToast: true,
            reason: "preference_disabled",
          });
        }
        return;
      }

      // Deduplicação (já reproduzido recentemente):
      if (isEventRecentlyPlayed(notificationId)) {
        recordAudioLog("2_DEDUP", `Notificação ${notificationId} já reproduzida anteriormente.`, "info");
        if (responsePort) {
          responsePort.postMessage({
            confirmed: false,
            playedSound: false,
            duplicate: true,
            reason: "duplicate",
          });
        }
        return;
      }

      // Throttle de 2 segundos (suporte cross-tab e em memória):
      const now = Date.now();
      if (now - lastSoundPlayedAt < 2000) {
        recordAudioLog("2_THROTTLE", "Som ignorado pelo throttle de 2s.", "info");
        dispatchVisualSaleEvent(payload);
        if (responsePort) {
          responsePort.postMessage({
            confirmed: false,
            playedSound: false,
            throttled: true,
            reason: "throttled",
          });
        }
        return;
      }

      // Tenta tocar o áudio
      try {
        const played = await playCommissionChime({
          eventId: notificationId,
          volume: prefs.volume,
        });

        if (played) {
          dispatchVisualSaleEvent(payload);
          if (responsePort) {
            responsePort.postMessage({
              confirmed: true,
              playedSound: true,
              showedToast: true,
              reason: "played_success",
            });
          }
          return;
        } else {
          recordAudioLog("6_ERRO_REJEICAO", "Reprodução sonora não autorizada pelo navegador (autoplay).", "warn");
          dispatchAutoplayBlockedEvent(payload);
          if (responsePort) {
            responsePort.postMessage({
              confirmed: false,
              playedSound: false,
              reason: "autoplay_blocked",
            });
          }
        }
      } catch (err: any) {
        recordAudioLog("6_ERRO_REJEICAO", `Erro ao tocar áudio: ${err?.name} - ${err?.message}`, "warn");
        dispatchAutoplayBlockedEvent(payload);
        if (responsePort) {
          responsePort.postMessage({
            confirmed: false,
            playedSound: false,
            reason: "playback_failed",
            error: err?.name,
          });
        }
      }
    });
  }
}
