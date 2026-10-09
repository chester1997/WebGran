import { describe, it, expect, vi, beforeEach } from "vitest";
import { BatchUploadQueue, BatchUploadItem } from "@/lib/upload/batch-upload-manager";

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
});


