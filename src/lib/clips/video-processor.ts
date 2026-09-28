/**
 * Client-Side Video Duration Detection & Trimming Processor for Clips
 * Ensures all clips uploaded to WebGran/Bunny Stream have a maximum duration of 60 seconds.
 */

export const CLIP_MAX_DURATION_SECONDS = 60;

export interface TrimOptions {
  maxDurationSeconds?: number;
  onProgress?: (percentage: number, statusText: string) => void;
  signal?: AbortSignal;
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
): Promise<File> {
  const maxDuration = options.maxDurationSeconds ?? CLIP_MAX_DURATION_SECONDS;
  const { onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error("Processamento cancelado pelo usuário.");
  }

  // Step 1: Detect duration
  onProgress?.(0, "Verificando duração do vídeo...");
  const duration = await getVideoDuration(file);

  if (signal?.aborted) {
    throw new Error("Processamento cancelado pelo usuário.");
  }

  // Step 2: If file is <= maxDuration (e.g. <= 60s), return original File directly
  if (duration <= maxDuration) {
    onProgress?.(100, "Vídeo dentro do limite de 60s. Pronto para envio.");
    return file;
  }

  // Step 3: File is > 60s -> Trim first 60 seconds in the browser using HTML5 Canvas & MediaRecorder
  onProgress?.(5, "Preparando corte do vídeo (0:00 → 1:00)...");

  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("O seu navegador não suporta a gravação/corte local de vídeo. Atualize seu navegador.");
  }

  return new Promise<File>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = false; // We want to capture audio
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

        // Create canvas matching video's native resolution
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          cleanup();
          return reject(new Error("Não foi possível criar o contexto 2D do Canvas."));
        }

        // Capture canvas video stream
        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
        if (!canvasStream) {
          cleanup();
          return reject(new Error("Seu navegador não suporta a captura de fluxo do Canvas (captureStream)."));
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
            // Also connect to destination to avoid muting during processing if needed, but we don't necessarily need speaker output
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

          // Final Duration Safety Assert
          try {
            const finalDuration = await getVideoDuration(trimmedFile);
            if (finalDuration > maxDuration + 1) { // 1 second buffer allowance for container framing
              return reject(new Error(`O arquivo recortado ultrapassou o limite de ${maxDuration}s (${finalDuration.toFixed(1)}s). Envio abortado.`));
            }
          } catch (assertErr) {
            console.warn("[VideoProcessor] Final duration assertion warning:", assertErr);
          }

          onProgress?.(100, "Clip de 60s preparado com sucesso!");
          resolve(trimmedFile);
        };

        // Start playback & recording from 0s
        video.currentTime = 0;
        await video.play().catch(() => {});

        mediaRecorder.start(1000); // 1s timeslices

        // Render loop
        const drawFrame = () => {
          if (signal?.aborted) {
            handleAbort();
            return;
          }

          if (video.currentTime >= maxDuration || video.ended) {
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
