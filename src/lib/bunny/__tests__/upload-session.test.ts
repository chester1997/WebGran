import { describe, it, expect, vi, beforeEach } from "vitest";
import { BunnyStreamService } from "../stream";
import { resolveClipStatusTransition } from "../webhook-utils";

describe("Bunny Stream Direct Upload Signature & Security", () => {
  const mockLibraryId = "763931";
  const mockApiKey = "23d07e69-8a7f-4227-b0edbd3591e8-a312-4772";
  const mockCdnHostname = "vz-73b50578-eab.b-cdn.net";

  beforeEach(() => {
    process.env.BUNNY_STREAM_LIBRARY_ID = mockLibraryId;
    process.env.BUNNY_STREAM_API_KEY = mockApiKey;
    process.env.BUNNY_STREAM_CDN_HOSTNAME = mockCdnHostname;
  });

  it("generates direct upload signature without exposing administrative API key", () => {
    const videoId = "test-video-guid-12345";
    const session = BunnyStreamService.generateDirectUploadSignature(videoId);

    expect(session.videoId).toBe(videoId);
    expect(session.libraryId).toBe(mockLibraryId);
    expect(session.signature).toBeDefined();
    expect(session.expirationTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(session.uploadUrl).toBe(`https://video.bunnycdn.com/library/${mockLibraryId}/videos/${videoId}`);
    expect(session.headers.AuthorizationSignature).toBe(session.signature);
    expect(session.headers.VideoId).toBe(videoId);
    expect(session.headers.LibraryId).toBe(mockLibraryId);

    // CRITICAL SECURITY ASSERTION: Administrative API key MUST NOT appear in returned session object
    const sessionJsonStr = JSON.stringify(session);
    expect(sessionJsonStr).not.toContain(mockApiKey);
  });
});

describe("Upload Session Payload & Validation Rules", () => {
  function validateUploadInput(body: {
    title?: any;
    contentType?: any;
    fileSize?: any;
  }) {
    const { title, contentType, fileSize } = body;
    const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

    if (!title || typeof title !== "string" || !title.trim()) {
      return { valid: false, error: "O título do clipe é obrigatório." };
    }

    if (contentType && typeof contentType === "string") {
      const cleanMime = contentType.toLowerCase().trim();
      if (!cleanMime.startsWith("video/")) {
        return { valid: false, error: "O arquivo selecionado deve ser um vídeo válido." };
      }
    }

    if (fileSize !== undefined && fileSize !== null) {
      const size = Number(fileSize);
      if (isNaN(size) || size <= 0) {
        return { valid: false, error: "Tamanho de arquivo inválido." };
      }
      if (size > MAX_FILE_SIZE_BYTES) {
        return { valid: false, error: "O arquivo excede o limite máximo permitido de 500MB." };
      }
    }

    return { valid: true };
  }

  it("accepts valid title and video MIME type", () => {
    const res = validateUploadInput({
      title: "Meu Primeiro Clip",
      contentType: "video/mp4",
      fileSize: 10485760, // 10MB
    });
    expect(res.valid).toBe(true);
  });

  it("rejects empty or missing title", () => {
    expect(validateUploadInput({ title: "" }).error).toBe("O título do clipe é obrigatório.");
    expect(validateUploadInput({ title: "   " }).error).toBe("O título do clipe é obrigatório.");
    expect(validateUploadInput({}).error).toBe("O título do clipe é obrigatório.");
  });

  it("rejects non-video content types (e.g. image/png, application/pdf)", () => {
    expect(validateUploadInput({ title: "Clip Teste", contentType: "image/png" }).error).toBe(
      "O arquivo selecionado deve ser um vídeo válido."
    );
    expect(validateUploadInput({ title: "Clip Teste", contentType: "application/pdf" }).error).toBe(
      "O arquivo selecionado deve ser um vídeo válido."
    );
  });

  it("rejects invalid file sizes (zero, negative, or exceeding 500MB)", () => {
    expect(validateUploadInput({ title: "Clip Teste", fileSize: 0 }).error).toBe("Tamanho de arquivo inválido.");
    expect(validateUploadInput({ title: "Clip Teste", fileSize: -100 }).error).toBe("Tamanho de arquivo inválido.");
    expect(
      validateUploadInput({ title: "Clip Teste", fileSize: 600 * 1024 * 1024 }).error
    ).toBe("O arquivo excede o limite máximo permitido de 500MB.");
  });
});
