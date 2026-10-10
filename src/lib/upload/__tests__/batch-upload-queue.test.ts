import { describe, it, expect, vi, beforeEach } from "vitest";
import { BatchUploadQueue, BatchUploadItem } from "@/lib/upload/batch-upload-manager";
import { TusVideoUploader } from "@/lib/bunny/client-upload";

describe("BatchUploadQueue Sequential Logic & Quota Enforcement", () => {
  const mockFreeQuotaBytes = 5 * 1024 * 1024 * 1024; // 5 GB

  function createMockFile(name: string, sizeMB: number, type = "video/mp4"): File {
    const file = new File(["dummy content"], name, { type });
    Object.defineProperty(file, "size", { value: sizeMB * 1024 * 1024 });
    return file;
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: true, uploadSession: { tusUploadUrl: "http://mock" } }),
      })
    ));

    vi.spyOn(TusVideoUploader.prototype, "uploadVideo").mockImplementation(async ({ onProgress }) => {
      if (onProgress) {
        onProgress({
          percentage: 100,
          bytesUploaded: 100,
          totalBytes: 100,
          formattedSpeed: "10 MB/s",
          etaSeconds: 0,
        });
      }
      return Promise.resolve();
    });
  });

  it("adds valid video files and keeps them QUEUED without autostarting until start() is explicitly called", () => {
    const queue = new BatchUploadQueue({ freeQuotaBytes: mockFreeQuotaBytes });

    const file1 = createMockFile("video1.mp4", 500);
    const file2 = createMockFile("image.png", 10, "image/png");
    const file3 = createMockFile("video2.mp4", 6000); // 6GB exceeds 5GB

    const res = queue.addFiles([file1, file2, file3]);

    expect(res.added.length).toBe(1);
    expect(res.added[0].title).toBe("video1");
    // CRITICAL: Adding files MUST NOT autostart queue!
    expect(queue.getItems()[0].status).toBe("QUEUED");
    expect(res.rejected.length).toBe(2);
    expect(res.rejected[0]).toContain("image.png");
    expect(res.rejected[1]).toContain("video2.mp4");
    expect(queue.getItems().length).toBe(1);

    // Explicitly start queue
    queue.start();
    expect(["CREATING_SESSION", "UPLOADING", "PROCESSING", "READY"]).toContain(queue.getItems()[0].status);
  });

  it("triggers onQueueUpdate with CREATING_SESSION status immediately when start() is called", async () => {
    const queueUpdates: BatchUploadItem[][] = [];

    const queue = new BatchUploadQueue({
      freeQuotaBytes: mockFreeQuotaBytes,
      onQueueUpdate: (items) => {
        queueUpdates.push([...items.map((i) => ({ ...i }))]);
      },
    });

    const file1 = createMockFile("aula_01.mp4", 200);
    queue.addFiles([file1]);

    expect(queue.getItems()[0].status).toBe("QUEUED");

    queue.start();

    // The status transition to CREATING_SESSION must happen synchronously/immediately inside start() -> processNext()
    expect(queue.getItems()[0].status).toBe("CREATING_SESSION");
    expect(queueUpdates.some((up) => up[0]?.status === "CREATING_SESSION")).toBe(true);
  });

  it("handles session creation failure gracefully, setting FAILED status and error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: false, error: "Quota de armazenamento excedida na conta." }),
      })
    ));

    const queueUpdates: BatchUploadItem[][] = [];
    const queue = new BatchUploadQueue({
      freeQuotaBytes: mockFreeQuotaBytes,
      onQueueUpdate: (items) => {
        queueUpdates.push([...items.map((i) => ({ ...i }))]);
      },
    });

    const file1 = createMockFile("video_falha.mp4", 100);
    queue.addFiles([file1]);

    queue.start();

    // Wait microtask tick for async fetch failure to resolve
    await new Promise((r) => setTimeout(r, 50));

    const item = queue.getItems()[0];
    expect(item.status).toBe("FAILED");
    expect(item.error).toBe("Quota de armazenamento excedida na conta.");
    expect(queueUpdates.some((up) => up[0]?.status === "FAILED" && up[0]?.error?.includes("Quota"))).toBe(true);
  });

  it("maintains sequential order and calculates total bytes correctly", () => {
    const queue = new BatchUploadQueue({ freeQuotaBytes: mockFreeQuotaBytes });

    const file1 = createMockFile("v1.mp4", 100);
    const file2 = createMockFile("v2.mp4", 200);
    const file3 = createMockFile("v3.mp4", 300);

    queue.addFiles([file1, file2, file3]);
    const items = queue.getItems();

    expect(items.length).toBe(3);
    expect(items[0].title).toBe("v1");
    expect(items[1].title).toBe("v2");
    expect(items[2].title).toBe("v3");
    expect(queue.getTotalBytes()).toBe((100 + 200 + 300) * 1024 * 1024);
  });

  it("supports removing queued items and cancelling active upload", () => {
    const queue = new BatchUploadQueue({ freeQuotaBytes: mockFreeQuotaBytes });

    const file1 = createMockFile("v1.mp4", 100);
    const file2 = createMockFile("v2.mp4", 200);
    queue.addFiles([file1, file2]);

    const items = queue.getItems();
    const item1Id = items[0].id;

    expect(queue.removeItem(item1Id)).toBe(true);
    expect(queue.getItems().length).toBe(1);
    expect(queue.getItems()[0].title).toBe("v2");
  });

  it("accepts video files with empty MIME type but valid video extensions (.mov, .mkv, .avi)", () => {
    const queue = new BatchUploadQueue({ freeQuotaBytes: mockFreeQuotaBytes });
    const movFile = createMockFile("aula_01.mov", 100, ""); // empty MIME type
    const res = queue.addFiles([movFile]);
    expect(res.added.length).toBe(1);
    expect(res.added[0].title).toBe("aula_01");
  });

  it("supports retrying failed or canceled items", () => {
    const queue = new BatchUploadQueue({ freeQuotaBytes: mockFreeQuotaBytes });

    const file1 = createMockFile("v1.mp4", 100);
    queue.addFiles([file1]);

    const item = queue.getItems()[0];
    queue.cancelItem(item.id);

    expect(queue.getItems()[0].status).toBe("CANCELED");

    queue.retryItem(item.id);
    expect(["QUEUED", "CREATING_SESSION", "UPLOADING"]).toContain(queue.getItems()[0].status);
  });

  it("triggers onComplete when a single video finishes upload (reaches PROCESSING state)", async () => {
    const onComplete = vi.fn();
    const queue = new BatchUploadQueue({
      freeQuotaBytes: mockFreeQuotaBytes,
      onComplete,
    });

    const file1 = createMockFile("aula_01.mp4", 100);
    queue.addFiles([file1]);
    queue.start();

    // Wait microtask tick for async processing loop to finish upload
    await new Promise((r) => setTimeout(r, 100));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const item = queue.getItems()[0];
    expect(item.status).toBe("PROCESSING");
  });

  it("triggers onComplete only after all multiple videos finish upload to PROCESSING", async () => {
    const completedStates: string[][] = [];
    const onComplete = vi.fn(() => {
      completedStates.push(queue.getItems().map((i) => i.status));
    });

    const queue = new BatchUploadQueue({
      freeQuotaBytes: mockFreeQuotaBytes,
      onComplete,
    });

    const file1 = createMockFile("v1.mp4", 50);
    const file2 = createMockFile("v2.mp4", 50);
    queue.addFiles([file1, file2]);
    queue.start();

    await new Promise((r) => setTimeout(r, 150));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(completedStates[0]).toEqual(["PROCESSING", "PROCESSING"]);
  });

  it("calls onComplete with failed item status if an upload fails, keeping modal available for recovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: false, error: "Falha na conexao" }),
      })
    ));

    const onComplete = vi.fn();
    const queue = new BatchUploadQueue({
      freeQuotaBytes: mockFreeQuotaBytes,
      onComplete,
    });

    const file1 = createMockFile("v1_falha.mp4", 50);
    queue.addFiles([file1]);
    queue.start();

    await new Promise((r) => setTimeout(r, 100));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const items = queue.getItems();
    expect(items[0].status).toBe("FAILED");
    const allSuccessful = items.every((i) => i.status === "PROCESSING" || i.status === "READY");
    expect(allSuccessful).toBe(false);
  });
});
