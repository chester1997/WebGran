/**
 * Client-Side Video Duration Detection for Clips
 * Ensures all clips uploaded to WebGran/Bunny Stream have a maximum duration of 120 seconds (2 minutes).
 * 
 * Rules:
 * - duration <= 120s: Allow upload of original file.
 * - duration > 120s: Block upload immediately and prompt seller to crop externally.
 * - NO automatic trimming or client-side video processing.
 */

export const CLIP_MAX_DURATION_SECONDS = 120;

/**
 * Formats duration in seconds to human-readable string (e.g., 79.33s -> "1m 19s", 45s -> "45s")
 */
export function formatDurationHuman(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim();
  }
  return `${secs}s`;
}

/**
 * Detects duration of a video file client-side using HTMLVideoElement metadata.
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return reject(new Error("A detecção de duração deve ser executada no navegador."));
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (typeof duration !== "number" || isNaN(duration) || !isFinite(duration) || duration <= 0) {
        return reject(new Error("Não foi possível determinar a duração válida do vídeo."));
      }
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível carregar os metadados do vídeo. Arquivo corrompido ou formato incompatível."));
    };

    video.src = objectUrl;
  });
}
