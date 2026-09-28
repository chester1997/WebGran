import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CLIP_MAX_DURATION_SECONDS,
  getVideoDuration,
  prepareClipFileForUpload,
} from "../video-processor";

describe("Video Processor — 60 Seconds Trimming Rule & Duration Detection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports CLIP_MAX_DURATION_SECONDS constant set to 60", () => {
    expect(CLIP_MAX_DURATION_SECONDS).toBe(60);
  });

  it("returns original file directly if duration is <= 60 seconds", async () => {
    const mockFile = new File(["test-content"], "sample-30s.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 35.5,
      removeAttribute: vi.fn(),
      load: vi.fn(),
      src: "",
      onloadedmetadata: null as any,
      onerror: null as any,
    };

    const mockDocument = {
      createElement: (tagName: string) => {
        if (tagName === "video") {
          setTimeout(() => {
            if (mockVideo.onloadedmetadata) mockVideo.onloadedmetadata();
          }, 10);
          return mockVideo;
        }
        return {};
      },
    };

    vi.stubGlobal("window", {});
    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/fake-uuid"),
      revokeObjectURL: vi.fn(),
    });

    const progressFn = vi.fn();
    const resultFile = await prepareClipFileForUpload(mockFile, { onProgress: progressFn });

    expect(resultFile).toBe(mockFile);
    expect(resultFile.name).toBe("sample-30s.mp4");
    expect(progressFn).toHaveBeenCalledWith(100, expect.stringContaining("60s"));
  });

  it("never sends files > 60s without trimming or validating", async () => {
    const mockFile = new File(["test-content-long"], "movie-5min.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 300, // 5 minutes
      removeAttribute: vi.fn(),
      load: vi.fn(),
      src: "",
      onloadedmetadata: null as any,
      onerror: null as any,
    };

    const mockDocument = {
      createElement: (tagName: string) => {
        if (tagName === "video") {
          setTimeout(() => {
            if (mockVideo.onloadedmetadata) mockVideo.onloadedmetadata();
          }, 10);
          return mockVideo;
        }
        return {};
      },
    };

    vi.stubGlobal("window", {});
    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/fake-uuid"),
      revokeObjectURL: vi.fn(),
    });

    // In node environment without MediaRecorder, trimming throws clear error preventing original file from being sent
    await expect(prepareClipFileForUpload(mockFile)).rejects.toThrow("navegador não suporta");
  });

  it("rejects invalid or unreadable video duration", async () => {
    const mockFile = new File(["corrupted"], "corrupted.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: NaN,
      removeAttribute: vi.fn(),
      load: vi.fn(),
      src: "",
      onloadedmetadata: null as any,
      onerror: null as any,
    };

    const mockDocument = {
      createElement: (tagName: string) => {
        if (tagName === "video") {
          setTimeout(() => {
            if (mockVideo.onerror) mockVideo.onerror();
          }, 10);
          return mockVideo;
        }
        return {};
      },
    };

    vi.stubGlobal("window", {});
    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/fake-uuid"),
      revokeObjectURL: vi.fn(),
    });

    await expect(getVideoDuration(mockFile)).rejects.toThrow("Não foi possível carregar os metadados do vídeo");
  });
});
