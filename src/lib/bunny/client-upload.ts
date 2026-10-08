import * as tus from "tus-js-client";

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
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
 * Calculates dynamic TUS chunk size based on file size to balance network RTT overhead and stability.
 * - Files < 100 MB: 10 MB chunks
 * - Files 100 MB to 500 MB: 25 MB chunks
 * - Files > 500 MB: 50 MB chunks (e.g. 1.7 GB file uses ~37 chunks instead of 365)
 */
export function getDynamicChunkSize(fileSizeBytes: number): number {
  const MB = 1024 * 1024;
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    return 50 * MB; // Default fallback to 50MB
  }

  if (fileSizeBytes < 100 * MB) {
    return 10 * MB;
  } else if (fileSizeBytes <= 500 * MB) {
    return 25 * MB;
  } else {
    return 50 * MB;
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

      this.upload = new tus.Upload(file, {
        endpoint: tusUploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
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
            onProgress({
              bytesUploaded,
              totalBytes,
              percentage,
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

