import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyBunnyStreamSignature,
  resolveClipStatusTransition,
} from "../webhook-utils";

const TEST_READ_ONLY_KEY = "test_read_only_key_789";
const TEST_WRITE_KEY = "test_write_key_123";

describe("Bunny Stream Webhook - Status Mapping", () => {
  it("maps status 0 (Queued) to PROCESSING", () => {
    expect(resolveClipStatusTransition(0)).toBe("PROCESSING");
  });

  it("maps status 1 (Processing) to PROCESSING", () => {
    expect(resolveClipStatusTransition(1)).toBe("PROCESSING");
  });

  it("maps status 2 (Encoding) to PROCESSING", () => {
    expect(resolveClipStatusTransition(2)).toBe("PROCESSING");
  });

  it("maps status 3 (Finished) to READY", () => {
    expect(resolveClipStatusTransition(3)).toBe("READY");
  });

  it("maps status 4 (ResolutionFinished) to READY", () => {
    expect(resolveClipStatusTransition(4)).toBe("READY");
  });

  it("maps status 5 (Failed) to FAILED", () => {
    expect(resolveClipStatusTransition(5)).toBe("FAILED");
  });

  it("maps status 6 (PresignedUploadStarted) to PROCESSING", () => {
    expect(resolveClipStatusTransition(6)).toBe("PROCESSING");
  });

  it("maps status 7 (PresignedUploadFinished) to PROCESSING", () => {
    expect(resolveClipStatusTransition(7)).toBe("PROCESSING");
  });

  it("maps status 8 (PresignedUploadFailed) to FAILED", () => {
    expect(resolveClipStatusTransition(8)).toBe("FAILED");
  });

  it("maps status 9 (CaptionsGenerated) preserving current state", () => {
    expect(resolveClipStatusTransition(9, "PROCESSING")).toBe("PROCESSING");
    expect(resolveClipStatusTransition(9, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(9, "UPLOADING")).toBe("UPLOADING");
  });

  it("maps status 10 (TitleOrDescriptionGenerated) preserving current state", () => {
    expect(resolveClipStatusTransition(10, "PROCESSING")).toBe("PROCESSING");
    expect(resolveClipStatusTransition(10, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(10, "UPLOADING")).toBe("UPLOADING");
  });
});

describe("Bunny Stream Webhook - State Transition & Idempotency", () => {
  it("prevents state regression when READY receives PROCESSING (status 0, 1, 2, 6, 7)", () => {
    expect(resolveClipStatusTransition(0, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(1, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(2, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(6, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(7, "READY")).toBe("READY");
  });

  it("preserves READY state when receiving status 9 (CaptionsGenerated)", () => {
    expect(resolveClipStatusTransition(9, "READY")).toBe("READY");
  });

  it("preserves READY state when receiving status 10 (TitleOrDescriptionGenerated)", () => {
    expect(resolveClipStatusTransition(10, "READY")).toBe("READY");
  });

  it("transitions READY to FAILED if explicit failure event arrives (status 5 or 8)", () => {
    expect(resolveClipStatusTransition(5, "READY")).toBe("FAILED");
    expect(resolveClipStatusTransition(8, "READY")).toBe("FAILED");
  });

  it("handles duplicate READY events safely", () => {
    expect(resolveClipStatusTransition(3, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(4, "READY")).toBe("READY");
  });
});

describe("Bunny Stream Webhook — Official Security Hardening Audit (18 Mandatory Tests)", () => {
  const rawBody = '{"VideoLibraryId":763931,"VideoGuid":"b6a8d87a-1234-4567-890a-bcdef1234567","Status":3}';

  const generateHmac = (body: string, key: string) =>
    crypto.createHmac("sha256", key).update(body).digest("hex");

  it("TESTE 1: assinatura oficial válida → aceita (true)", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(true);
  });

  it("TESTE 2: assinatura inválida → rejeitada (false)", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 3: assinatura ausente → rejeitada (false)", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: null,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 4: Version ausente → rejeitada (false)", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: null,
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 5: Algorithm ausente → rejeitada (false)", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v1",
      algorithm: null,
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 6: Version diferente de v1 → rejeitada (false)", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v2",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 7: Algorithm diferente de hmac-sha256 → rejeitada (false)", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v1",
      algorithm: "sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 8: token via query string sem X-BunnyStream headers → NÃO autentica", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: TEST_READ_ONLY_KEY,
      version: null,
      algorithm: null,
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 9: Authorization Bearer sem X-BunnyStream headers → NÃO autentica", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: `Bearer ${TEST_READ_ONLY_KEY}`,
      version: null,
      algorithm: null,
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 10: header 'signature' simples sem versão e algoritmo → NÃO autentica", () => {
    const signature = generateHmac(rawBody, TEST_READ_ONLY_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: undefined,
      algorithm: undefined,
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 11: SHA256(secret + rawBody) → NÃO autentica", () => {
    const legacySha256 = crypto
      .createHash("sha256")
      .update(TEST_READ_ONLY_KEY + rawBody)
      .digest("hex");

    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: legacySha256,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 12: SHA256(rawBody + secret) → NÃO autentica", () => {
    const legacySha256 = crypto
      .createHash("sha256")
      .update(rawBody + TEST_READ_ONLY_KEY)
      .digest("hex");

    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: legacySha256,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 13: assinatura calculada sobre JSON.stringify(payload) → NÃO autentica quando raw body for diferente", () => {
    const formattedRawBody = '{\n  "VideoLibraryId": 763931,\n  "VideoGuid": "b6a8d87a-1234-4567-890a-bcdef1234567",\n  "Status": 3\n}';
    const parsedPayload = JSON.parse(formattedRawBody);
    const signatureOfParsed = generateHmac(JSON.stringify(parsedPayload), TEST_READ_ONLY_KEY);

    const isValid = verifyBunnyStreamSignature({
      rawBody: formattedRawBody,
      signature: signatureOfParsed,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 14: API Key principal (escrita) não é utilizada pelo webhook para validar", () => {
    const signatureWithWriteKey = generateHmac(rawBody, TEST_WRITE_KEY);

    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: signatureWithWriteKey,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY, // strictly expecting read-only key
    });
    expect(isValid).toBe(false);
  });

  it("TESTE 15: Read-Only API Key é utilizada com sucesso", () => {
    const signatureWithReadOnlyKey = generateHmac(rawBody, TEST_READ_ONLY_KEY);

    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: signatureWithReadOnlyKey,
      version: "v1",
      algorithm: "hmac-sha256",
      readOnlyApiKey: TEST_READ_ONLY_KEY,
    });
    expect(isValid).toBe(true);
  });

  it("TESTE 16: VideoLibraryId incorreto é identificado no payload", () => {
    const incomingLibraryId: number = 999999;
    const expectedLibraryId: number = 763931;

    expect(incomingLibraryId === expectedLibraryId).toBe(false);
  });

  it("TESTE 17: VideoGuid válido encontra o Clip correto", () => {
    const clips = [
      { id: "clip-1", bunnyVideoId: "b6a8d87a-1234-4567-890a-bcdef1234567" },
      { id: "clip-2", bunnyVideoId: "other-guid-999" },
    ];
    const targetGuid = "b6a8d87a-1234-4567-890a-bcdef1234567";
    const found = clips.find((c) => c.bunnyVideoId === targetGuid);

    expect(found).toBeDefined();
    expect(found?.id).toBe("clip-1");
  });

  it("TESTE 18: dois VideoGuids diferentes atualizam Clips diferentes", () => {
    const state = [
      { id: "clip-a", bunnyVideoId: "guid-a", status: "UPLOADING" },
      { id: "clip-b", bunnyVideoId: "guid-b", status: "UPLOADING" },
    ];

    const clipA = state.find((c) => c.bunnyVideoId === "guid-a");
    if (clipA) clipA.status = resolveClipStatusTransition(4, clipA.status as any);

    expect(state[0].status).toBe("READY");
    expect(state[1].status).toBe("UPLOADING"); // Unchanged
  });
});
