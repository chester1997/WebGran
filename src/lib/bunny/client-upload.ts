export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export interface DirectUploadOptions {
  file: File;
  uploadUrl: string;
  headers: Record<string, string>;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a video file directly from the browser to Bunny Stream using XMLHttpRequest
 * (to track real-time byte progress) and presigned authorization headers.
 * NEVER routes binary file payload through Vercel.
 */
export function uploadVideoDirectly({
  file,
  uploadUrl,
  headers,
  onProgress,
  signal,
}: DirectUploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload cancelado pelo usuário."));
      });
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        onProgress({
          bytesUploaded: e.loaded,
          totalBytes: e.total,
          percentage,
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let errMessage = `Falha no upload direto para o Bunny Stream (HTTP ${xhr.status})`;
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.message) errMessage = resp.message;
        } catch (_) {}
        reject(new Error(errMessage));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Erro de rede durante o upload direto para o Bunny Stream."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelado."));
    });

    xhr.open("PUT", uploadUrl, true);

    // Attach presigned authorization headers (AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId)
    Object.entries(headers).forEach(([key, val]) => {
      xhr.setRequestHeader(key, val);
    });

    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}
