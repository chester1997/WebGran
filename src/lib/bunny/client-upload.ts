import * as tus from "tus-js-client";

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec?: number;
  speedMbps?: number;
  formattedSpeed?: string;
  etaSeconds?: number;
}

export interface DirectUploadOptions {
  file: File;
  tusUploadUrl?: string;
  uploadUrl?: string;
  headers: Record<string, string>;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Calculates dynamic TUS chunk size based on file size to balance network RTT overhead and TCP window stability.
 * Bunny Stream TUS uploads perform best with chunks between 5 MB and 20 MB.
 * 50 MB chunks cause browser TCP bufferbloat, window stalling, and long progress freezes.
 * - Files < 50 MB: 5 MB chunks
 * - Files 50 MB to 300 MB: 10 MB chunks
 * - Files > 300 MB: 16 MB chunks (sweet spot for high-bandwidth fiber connections)
 */
export function getDynamicChunkSize(fileSizeBytes: number): number {
  const MB = 1024 * 1024;
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return 16 * MB; // Default fallback to 16MB
  }

  if (fileSizeBytes < 50 * MB) {
    return 5 * MB;
  } else if (fileSizeBytes <= 300 * MB) {
    return 10 * MB;
  } else {
    return 16 * MB;
  }
}

/**
 * Client-side TUS Resumable Video Uploader for Bunny Stream.
 * Uploads directly from browser to Bunny Stream TUS endpoint (https://video.bunnycdn.com/tusupload)
 * using presigned authorization headers. Binary file payload NEVER passes through Vercel.
 */
export class TusVideoUploader {
  private upload: tus.Upload | null = null;

  public uploadVideo({
    file,
    tusUploadUrl = "https://video.bunnycdn.com/tusupload",
    headers,
    chunkSize,
    onProgress,
    signal,
  }: DirectUploadOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error("Upload cancelado pelo usuário."));
      }

      if (signal) {
        signal.addEventListener("abort", () => {
          this.abort();
          reject(new Error("Upload cancelado pelo usuário."));
        });
      }

      const effectiveChunkSize = chunkSize || getDynamicChunkSize(file.size);
      const startTime = performance.now();
      let lastTime = startTime;
      let lastBytes = 0;

      this.upload = new tus.Upload(file, {
        endpoint: tusUploadUrl,
        retryDelays: [0, 1000, 2000, 5000],
        headers,
        chunkSize: effectiveChunkSize,
        metadata: {
          filename: file.name,
          filetype: file.type || "video/mp4",
        },
        onError: (error) => {
          let msg = error?.message || "Erro no upload resumível (TUS) para o Bunny Stream.";
          reject(new Error(msg));
        },
        onProgress: (bytesUploaded, totalBytes) => {
          if (onProgress && totalBytes > 0) {
            const percentage = Math.round((bytesUploaded / totalBytes) * 100);
            const now = performance.now();
            const elapsedTotalSec = (now - startTime) / 1000;
            const elapsedStepSec = (now - lastTime) / 1000;

            // Compute exponential moving average or instant speed
            let speedBytesPerSec = 0;
            if (elapsedStepSec >= 0.2) {
              const stepBytes = bytesUploaded - lastBytes;
              speedBytesPerSec = stepBytes / elapsedStepSec;
              lastTime = now;
              lastBytes = bytesUploaded;
            } else if (elapsedTotalSec > 0) {
              speedBytesPerSec = bytesUploaded / elapsedTotalSec;
            }

            const speedMbps = (speedBytesPerSec * 8) / (1024 * 1024);
            const speedMBps = speedBytesPerSec / (1024 * 1024);

            let formattedSpeed = "";
            if (speedMBps >= 1) {
              formattedSpeed = `${speedMBps.toFixed(1)} MB/s (${speedMbps.toFixed(1)} Mbps)`;
            } else {
              const speedKBps = speedBytesPerSec / 1024;
              formattedSpeed = `${speedKBps.toFixed(0)} KB/s (${speedMbps.toFixed(2)} Mbps)`;
            }

            const remainingBytes = totalBytes - bytesUploaded;
            const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

            onProgress({
              bytesUploaded,
              totalBytes,
              percentage,
              speedBytesPerSec,
              speedMbps,
              formattedSpeed,
              etaSeconds,
            });
          }
        },
        onSuccess: () => {
          resolve();
        },
      });

      this.upload.start();
    });
  }

  public abort(): void {
    if (this.upload) {
      this.upload.abort();
    }
  }
}

/**
 * Functional helper wrapper for TUS direct upload.
 */
export function uploadVideoDirectly(options: DirectUploadOptions): Promise<void> {
  const uploader = new TusVideoUploader();
  return uploader.uploadVideo(options);
}

