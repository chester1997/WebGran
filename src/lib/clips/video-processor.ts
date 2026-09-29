/**
 * Client-Side Video Duration Detection & Trimming Processor for Clips
 * Ensures all clips uploaded to WebGran/Bunny Stream have a maximum duration of 60 seconds.
 * 
 * Rules:
 * - duration <= 60s: Send original file untouched.
 * - duration > 60s: Automatically trim first 60 seconds (0:00 -> 1:00) client-side in the browser.
 * - NEVER send original file > 60s to Bunny Stream.
 */

export const CLIP_MAX_DURATION_SECONDS = 60;

export interface TrimOptions {
  maxDurationSeconds?: number;
  onProgress?: (percentage: number, statusText: string) => void;
  signal?: AbortSignal;
}

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

/**
 * Trims a video file client-side to the first N seconds (default: 60s) if duration > maxDurationSeconds.
 * If file duration <= maxDurationSeconds, returns the original file untouched.
 */
export async function prepareClipFileForUpload(
  file: File,
  options: TrimOptions = {}
): Promise<{ file: File; originalDuration: number; isTrimmed: boolean }> {
  const maxDuration = options.maxDurationSeconds ?? CLIP_MAX_DURATION_SECONDS;
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error("Processamento cancelado pelo usuário.");
  }

  // Step 1: Detect duration
  onProgress?.(0, "Analisando duração do vídeo...");
  const duration = await getVideoDuration(file);

  if (signal?.aborted) {
    throw new Error("Processamento cancelado pelo usuário.");
  }

  // Step 2: If file is <= maxDuration (e.g. <= 60s), return original File directly
  if (duration <= maxDuration) {
    onProgress?.(100, `Vídeo dentro do limite (${formatDurationHuman(duration)}). Pronto para envio.`);
    return { file, originalDuration: duration, isTrimmed: false };
  }

  // Step 3: File is > 60s -> Trim first 60 seconds (0:00 -> 1:00) in the browser
  const humanOrig = formatDurationHuman(duration);
  onProgress?.(5, `Vídeo com ${humanOrig}. Cortando os primeiros 60 segundos (0:00 → 1:00)...`);

  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("O seu navegador não suporta o corte local de vídeo. Atualize seu navegador.");
  }

  return new Promise<{ file: File; originalDuration: number; isTrimmed: boolean }>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true; // Muted guarantees video.play() is allowed in async event handlers
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    let mediaRecorder: MediaRecorder | null = null;
    let animFrameId: number | null = null;
    let audioCtx: AudioContext | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;

    const recordedChunks: Blob[] = [];

    const cleanup = () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const handleAbort = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      cleanup();
      reject(new Error("Processamento cancelado pelo usuário."));
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    video.onloadedmetadata = async () => {
      try {
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;

        // Create canvas matching video's native resolution & orientation
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          cleanup();
          return reject(new Error("Não foi possível criar o contexto do Canvas para o corte de vídeo."));
        }

        // Capture canvas video stream
        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
        if (!canvasStream) {
          cleanup();
          return reject(new Error("Seu navegador não suporta a captura de fluxo do Canvas."));
        }

        // Setup audio stream routing via WebAudio API if audio track exists
        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));

        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            audioSource = audioCtx.createMediaElementSource(video);
            const audioDestination = audioCtx.createMediaStreamDestination();
            audioSource.connect(audioDestination);
            audioDestination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
          }
        } catch (e) {
          console.warn("[VideoProcessor] WebAudio capture fallback:", e);
        }

        // Determine best supported MIME type for MediaRecorder
        const mimeTypes = [
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
        let chosenMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

        mediaRecorder = new MediaRecorder(combinedStream, chosenMime ? { mimeType: chosenMime } : undefined);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          cleanup();
          if (signal?.aborted) return;

          const finalBlob = new Blob(recordedChunks, { type: chosenMime || "video/mp4" });
          
          // Generate new file name
          const originalName = file.name.replace(/\.[^/.]+$/, "");
          const ext = chosenMime.includes("mp4") ? "mp4" : "webm";
          const trimmedFileName = `${originalName}-clip.${ext}`;

          const trimmedFile = new File([finalBlob], trimmedFileName, {
            type: finalBlob.type || "video/mp4",
            lastModified: Date.now(),
          });

          // Absolute safety validation: Ensure trimmedFile is a new File object and non-empty
          if (trimmedFile === file || trimmedFile.size <= 0) {
            return reject(new Error("Não foi possível gerar o arquivo de vídeo cortado."));
          }

          // Re-evaluate trimmed file duration using HTMLVideoElement
          let processedDuration = duration;
          try {
            processedDuration = await getVideoDuration(trimmedFile);
          } catch (e) {
            console.warn("[VideoProcessor] Re-evaluating trimmed file duration warning:", e);
          }

          if (processedDuration > maxDuration) {
            return reject(
              new Error(
                `Erro de corte: o arquivo gerado ultrapassa o limite máximo de ${maxDuration}s (${processedDuration.toFixed(2)}s). Envio abortado.`
              )
            );
          }

          onProgress?.(100, "Clip de 60s preparado com sucesso!");
          resolve({ file: trimmedFile, originalDuration: duration, isTrimmed: true });
        };

        // Start playback & recording from 0s up to maxDuration
        video.currentTime = 0;
        await video.play().catch((err) => {
          console.warn("[VideoProcessor] Video play attempt:", err);
        });

        mediaRecorder.start(1000); // 1s timeslices

        // Render loop: draws frame and monitors target duration (0:00 -> 1:00)
        // Stop slightly before 60.00s (59.95s) to guarantee final output duration <= 60.00s
        const targetCutoff = maxDuration - 0.05;

        const drawFrame = () => {
          if (signal?.aborted) {
            handleAbort();
            return;
          }

          if (video.currentTime >= targetCutoff || video.ended) {
            video.pause();
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
              mediaRecorder.stop();
            }
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);
          const percent = Math.min(100, Math.round((video.currentTime / maxDuration) * 100));
          onProgress?.(percent, `Cortando vídeo: 0:00 → 1:00 (${percent}%)`);

          animFrameId = requestAnimationFrame(drawFrame);
        };

        animFrameId = requestAnimationFrame(drawFrame);
      } catch (err: any) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Erro ao carregar o vídeo para processamento local."));
    };

    video.src = objectUrl;
  });
}
