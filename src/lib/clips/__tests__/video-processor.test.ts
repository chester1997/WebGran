import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CLIP_MAX_DURATION_SECONDS,
  formatDurationHuman,
  getVideoDuration,
} from "../video-processor";

describe("Video Processor — Strict 120-Second Upload Rule & Duration Detection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports CLIP_MAX_DURATION_SECONDS constant set to 120", () => {
    expect(CLIP_MAX_DURATION_SECONDS).toBe(120);
  });

  it("formats human-readable duration strings correctly", () => {
    expect(formatDurationHuman(30)).toBe("30s");
    expect(formatDurationHuman(59)).toBe("59s");
    expect(formatDurationHuman(60)).toBe("1m");
    expect(formatDurationHuman(60.01)).toBe("1m");
    expect(formatDurationHuman(61)).toBe("1m 1s");
    expect(formatDurationHuman(79.33)).toBe("1m 19s");
    expect(formatDurationHuman(120)).toBe("2m");
    expect(formatDurationHuman(154)).toBe("2m 34s");
    expect(formatDurationHuman(300)).toBe("5m");
  });

  it("detects valid durations <= 120s (30s, 60s, 119s, 120s) for original file upload", async () => {
    const mockFile = new File(["test-content-30s"], "sample-30s.mp4", { type: "video/mp4" });

    const mockVideo = {
      preload: "",
      muted: false,
      playsInline: false,
      duration: 30,
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

    const duration = await getVideoDuration(mockFile);
    expect(duration).toBe(30);
    expect(duration <= CLIP_MAX_DURATION_SECONDS).toBe(true);
  });

  it("detects video durations > 120s (120.01s, 121s, 154s, 300s) to enforce blocking", async () => {
    const testCases = [
      { name: "120.01s.mp4", duration: 120.01 },
      { name: "121s.mp4", duration: 121 },
      { name: "154s-02m34s.mp4", duration: 154 },
      { name: "300s-5min.mp4", duration: 300 },
    ];

    for (const testCase of testCases) {
      const mockFile = new File(["test-content"], testCase.name, { type: "video/mp4" });

      const mockVideo = {
        preload: "",
        muted: false,
        playsInline: false,
        duration: testCase.duration,
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

      const detectedDuration = await getVideoDuration(mockFile);
      expect(detectedDuration).toBe(testCase.duration);
      expect(detectedDuration > CLIP_MAX_DURATION_SECONDS).toBe(true);
    }
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
