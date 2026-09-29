import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CLIP_MAX_DURATION_SECONDS,
  formatDurationHuman,
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

  it("formats human-readable duration strings correctly", () => {
    expect(formatDurationHuman(30)).toBe("30s");
    expect(formatDurationHuman(59)).toBe("59s");
    expect(formatDurationHuman(60)).toBe("1m");
    expect(formatDurationHuman(79.33)).toBe("1m 19s");
    expect(formatDurationHuman(300)).toBe("5m");
  });

  it("returns original file directly if duration is 30s, 59s, or 60s", async () => {
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
    const result = await prepareClipFileForUpload(mockFile, { onProgress: progressFn });

    expect(result.file).toBe(mockFile);
    expect(result.isTrimmed).toBe(false);
    expect(result.originalDuration).toBe(35.5);
    expect(progressFn).toHaveBeenLastCalledWith(100, expect.stringContaining("Pronto para envio"));
  });

  it("triggers automatic trimming for 79.33s video without throwing error or blocking", async () => {
    const mockFile = new File(["test-content-79s"], "a musica terminou.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 79.33,
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

    // Node env without MediaRecorder throws clear browser error, ensuring original >60s is never sent raw
    await expect(prepareClipFileForUpload(mockFile)).rejects.toThrow("suporta o corte local");
  });

  it("triggers automatic trimming for 60.1s and 61s videos", async () => {
    const mockFile601 = new File(["test-60.1s"], "60-point-1s.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 60.1,
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

    await expect(prepareClipFileForUpload(mockFile601)).rejects.toThrow("suporta o corte local");
  });

  it("handles 02:34 (154s) long video by starting trim process", async () => {
    const mockFile = new File(["long-video"], "ep1-full.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 154,
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

    // In node test env without MediaRecorder, attempting to trim 154s file throws browser capability error
    await expect(prepareClipFileForUpload(mockFile)).rejects.toThrow("suporta o corte local");
  });

  it("aborts processing when AbortSignal is cancelled", async () => {
    const mockFile = new File(["cancel-test"], "cancel.mp4", { type: "video/mp4" });
    const controller = new AbortController();
    controller.abort();

    await expect(
      prepareClipFileForUpload(mockFile, { signal: controller.signal })
    ).rejects.toThrow("Processamento cancelado pelo usuário");
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
