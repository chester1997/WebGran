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
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
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

      this.upload = new tus.Upload(file, {
        endpoint: tusUploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers,
        chunkSize: 5 * 1024 * 1024, // 5MB chunk size recommended for Bunny Stream TUS
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
