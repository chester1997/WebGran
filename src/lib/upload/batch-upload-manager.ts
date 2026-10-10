import { TusVideoUploader, UploadProgress } from "@/lib/bunny/client-upload";

export type BatchItemStatus =
  | "QUEUED"
  | "CREATING_SESSION"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "CANCELED";

export interface BatchUploadItem {
  id: string; // unique local ID
  file: File;
  title: string;
  description?: string;
  fileSizeBytes: number;
  status: BatchItemStatus;
  progressPercent: number;
  bytesUploaded: number;
  speedFormatted?: string;
  etaSeconds?: number | null;
  error?: string | null;
  uploadSessionId?: string | null;
  uploadAuth?: any;
  videoId?: string | null; // Database video ID
  bunnyVideoId?: string | null;
  abortController?: AbortController | null;
  uploader?: TusVideoUploader | null;
}

export interface BatchQueueOptions {
  freeQuotaBytes: number;
  onItemUpdate?: (item: BatchUploadItem) => void;
  onQueueUpdate?: (items: BatchUploadItem[]) => void;
  onComplete?: () => void;
}

/**
 * Pure queue processor for sequential batch video uploads (concurrency = 1).
 * Manages item states, quota calculations, individual aborts, and auto-sequence.
 */
export class BatchUploadQueue {
  private items: BatchUploadItem[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private freeQuotaBytes: number = 0;
  private onItemUpdateCb?: (item: BatchUploadItem) => void;
  private onQueueUpdateCb?: (items: BatchUploadItem[]) => void;
  private onCompleteCb?: () => void;

  constructor(options: BatchQueueOptions) {
    this.freeQuotaBytes = options.freeQuotaBytes;
    this.onItemUpdateCb = options.onItemUpdate;
    this.onQueueUpdateCb = options.onQueueUpdate;
    this.onCompleteCb = options.onComplete;
  }

  public updateFreeQuota(quotaBytes: number) {
    this.freeQuotaBytes = quotaBytes;
  }

  public getItems(): BatchUploadItem[] {
    return [...this.items];
  }

  public getItem(id: string): BatchUploadItem | undefined {
    return this.items.find((it) => it.id === id);
  }

  public getTotalBytes(): number {
    return this.items.reduce((acc, it) => acc + it.fileSizeBytes, 0);
  }

  public getUploadedBytes(): number {
    return this.items.reduce((acc, it) => acc + (it.bytesUploaded || 0), 0);
  }

  public addFiles(files: File[]): { added: BatchUploadItem[]; rejected: string[] } {
    const added: BatchUploadItem[] = [];
    const rejected: string[] = [];

    // Calculate current active queue bytes (queued, session creating, uploading)
    const currentQueueBytes = this.items
      .filter((it) => it.status === "QUEUED" || it.status === "CREATING_SESSION" || it.status === "UPLOADING")
      .reduce((sum, it) => sum + it.fileSizeBytes, 0);

    let runningTotalBytes = currentQueueBytes;

    for (const file of files) {
      const isVideoMime = file.type && file.type.startsWith("video/");
      const isVideoExt = /\.(mp4|mov|mkv|avi|webm|m4v|3gp|flv)$/i.test(file.name);

      if (!isVideoMime && !isVideoExt) {
        rejected.push(`${file.name}: Não é um arquivo de vídeo válido.`);
        continue;
      }

      if (runningTotalBytes + file.size > this.freeQuotaBytes) {
        rejected.push(`${file.name}: Tamanho (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB) excede a quota de armazenamento disponível.`);
        continue;
      }

      runningTotalBytes += file.size;

      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const newItem: BatchUploadItem = {
        id: `batch-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        title: nameWithoutExt,
        fileSizeBytes: file.size,
        status: "QUEUED",
        progressPercent: 0,
        bytesUploaded: 0,
        error: null,
      };

      this.items.push(newItem);
      added.push(newItem);
    }

    this.notifyQueueUpdate();
    return { added, rejected };
  }

  public removeItem(id: string): boolean {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return false;

    const item = this.items[idx];
    if (item.status === "UPLOADING" || item.status === "CREATING_SESSION") {
      this.cancelItem(id);
    }

    this.items.splice(idx, 1);
    this.notifyQueueUpdate();
    return true;
  }

  public cancelItem(id: string): void {
    const item = this.getItem(id);
    if (!item) return;

    if (item.abortController) {
      try {
        item.abortController.abort();
      } catch (e) {
        // ignore abort errors
      }
    }

    if (item.uploader) {
      try {
        item.uploader.abort();
      } catch (e) {
        // ignore uploader abort errors
      }
    }

    // Attempt to release reservation / cleanup video if created on backend
    if (item.videoId) {
      fetch(`/api/seller/videos/${item.videoId}?force=true`, { method: "DELETE" }).catch(() => {});
    }

    item.status = "CANCELED";
    item.error = "Upload cancelado pelo usuário.";
    item.abortController = null;
    item.uploader = null;

    this.notifyItemUpdate(item);
    this.notifyQueueUpdate();

    // If active item was canceled, process next
    if (this.isRunning && !this.isPaused) {
      setTimeout(() => this.processNext(), 50);
    }
  }

  public retryItem(id: string): void {
    const item = this.getItem(id);
    if (!item) return;

    if (item.status === "FAILED" || item.status === "CANCELED") {
      // Clean up orphaned video/reservation on backend if it was created previously
      if (item.videoId) {
        fetch(`/api/seller/videos/${item.videoId}?force=true`, { method: "DELETE" }).catch(() => {});
        item.videoId = null;
        item.uploadSessionId = null;
        item.bunnyVideoId = null;
      }

      item.status = "QUEUED";
      item.error = null;
      item.progressPercent = 0;
      item.bytesUploaded = 0;
      item.speedFormatted = undefined;
      item.etaSeconds = null;

      this.notifyItemUpdate(item);
      this.notifyQueueUpdate();

      if (!this.isProcessingLoop && !this.isPaused) {
        this.start();
      }
    }
  }

  public start(): void {
    this.isPaused = false;
    this.isRunning = true;
    if (!this.isProcessingLoop) {
      this.processNext();
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.isRunning = false;
    // Abort current uploading TUS connection without discarding session metadata
    const activeItem = this.items.find((it) => it.status === "UPLOADING" || it.status === "CREATING_SESSION");
    if (activeItem) {
      if (activeItem.abortController) {
        try {
          activeItem.abortController.abort();
        } catch (e) {}
      }
      if (activeItem.uploader) {
        try {
          activeItem.uploader.abort();
        } catch (e) {}
      }
      activeItem.status = "QUEUED";
      this.notifyItemUpdate(activeItem);
    }
    this.notifyQueueUpdate();
  }

  private isProcessingLoop: boolean = false;

  private async processNext(): Promise<void> {
    if (this.isPaused || this.isProcessingLoop) return;

    // Find next QUEUED item
    const nextItem = this.items.find((it) => it.status === "QUEUED");
    if (!nextItem) {
      this.isRunning = false;
      this.isProcessingLoop = false;
      this.notifyQueueUpdate();
      if (this.onCompleteCb) {
        this.onCompleteCb();
      }
      return;
    }

    this.isRunning = true;
    this.isProcessingLoop = true;
    try {
      await this.uploadItem(nextItem);
    } finally {
      this.isProcessingLoop = false;
    }

    // Auto-advance to next item in queue
    if (!this.isPaused) {
      setTimeout(() => this.processNext(), 50);
    }
  }

  private async uploadItem(item: BatchUploadItem): Promise<void> {
    const abortController = new AbortController();
    item.abortController = abortController;
    item.status = "CREATING_SESSION";
    item.error = null;
    this.notifyItemUpdate(item);

    try {
      let uploadAuth = item.uploadAuth;

      // 1. Create upload session via backend API if not already created
      if (!uploadAuth) {
        const sessionRes = await fetch("/api/seller/videos/upload-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            description: item.description,
            fileSize: item.file.size,
            fileSizeBytes: item.file.size,
            contentType: item.file.type || "video/mp4",
            fileName: item.file.name,
          }),
          signal: abortController.signal,
        });

        const sessionData = await sessionRes.json();
        if (!sessionData.success) {
          throw new Error(sessionData.error || "Falha ao criar sessão de upload.");
        }

        uploadAuth = sessionData.uploadSession || sessionData.uploadAuth;
        if (!uploadAuth) {
          throw new Error("Sessão de upload inválida.");
        }

        item.uploadAuth = uploadAuth;
        item.uploadSessionId = sessionData.reservationId || null;
        item.videoId = sessionData.video?.id || sessionData.videoId || null;
        item.bunnyVideoId = sessionData.bunnyVideoId || sessionData.video?.bunnyVideoId || null;
      }

      if (abortController.signal.aborted || (item.status as string) === "CANCELED") {
        return;
      }

      // 2. Transmit file directly to Bunny TUS
      item.status = "UPLOADING";
      const uploader = new TusVideoUploader();
      item.uploader = uploader;
      this.notifyItemUpdate(item);

      await uploader.uploadVideo({
        file: item.file,
        tusUploadUrl: uploadAuth.tusUploadUrl || "https://video.bunnycdn.com/tusupload",
        headers: uploadAuth.headers,
        signal: abortController.signal,
        onProgress: (p: UploadProgress) => {
          if ((item.status as string) === "CANCELED") return;
          item.progressPercent = p.percentage;
          item.bytesUploaded = p.bytesUploaded;
          item.speedFormatted = p.formattedSpeed;
          item.etaSeconds = p.etaSeconds;
          this.notifyItemUpdate(item, true);
        },
      });

      // 3. Complete Upload -> Mark as PROCESSING (Bunny transcoding)
      item.status = "PROCESSING";
      item.progressPercent = 100;
      item.bytesUploaded = item.fileSizeBytes;
      item.speedFormatted = undefined;
      item.etaSeconds = null;
      item.uploader = null;
      item.abortController = null;
      this.notifyItemUpdate(item);
    } catch (err: any) {
      if ((item.status as string) === "CANCELED" || abortController.signal.aborted) {
        item.status = "CANCELED";
        item.error = "Upload cancelado pelo usuário.";
      } else {
        item.status = "FAILED";
        item.error = err.message || "Erro durante o envio do vídeo.";
      }
      item.uploader = null;
      item.abortController = null;
      this.notifyItemUpdate(item);
    }
  }

  private lastProgressNotifyTime: number = 0;

  private notifyItemUpdate(item: BatchUploadItem, isProgressEvent = false): void {
    const now = Date.now();
    if (isProgressEvent) {
      if (now - this.lastProgressNotifyTime < 150 && item.progressPercent < 100) {
        return;
      }
      this.lastProgressNotifyTime = now;
    }

    if (this.onItemUpdateCb) {
      this.onItemUpdateCb({ ...item });
    }
    this.notifyQueueUpdate();
  }

  private notifyQueueUpdate(): void {
    if (this.onQueueUpdateCb) {
      this.onQueueUpdateCb(this.getItems());
    }
  }
}
