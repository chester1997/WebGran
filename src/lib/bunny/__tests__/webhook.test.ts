import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyBunnyStreamSignature,
  resolveClipStatusTransition,
  DEFAULT_LIBRARY_ID,
} from "../webhook-utils";

const TEST_SECRET_KEY = "test_read_only_api_key_12345";

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

describe("Bunny Stream Webhook - HMAC-SHA256 Signature Verification", () => {
  const rawBody = JSON.stringify({
    VideoLibraryId: 763931,
    VideoGuid: "b6a8d87a-1234-4567-890a-bcdef1234567",
    Status: 3,
  });

  const generateSignature = (body: string, key: string) => {
    return crypto.createHmac("sha256", key).update(body).digest("hex");
  };

  it("validates a correct signature", () => {
    const signature = generateSignature(rawBody, TEST_SECRET_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v1",
      algorithm: "hmac-sha256",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: "invalid_hex_signature_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      version: "v1",
      algorithm: "hmac-sha256",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("rejects when signature header is missing", () => {
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature: null,
      version: "v1",
      algorithm: "hmac-sha256",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("rejects when raw request body is tampered", () => {
    const signature = generateSignature(rawBody, TEST_SECRET_KEY);
    const tamperedBody = rawBody.replace('"Status":3', '"Status":5');

    const isValid = verifyBunnyStreamSignature({
      rawBody: tamperedBody,
      signature,
      version: "v1",
      algorithm: "hmac-sha256",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("rejects unsupported signature version", () => {
    const signature = generateSignature(rawBody, TEST_SECRET_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v2",
      algorithm: "hmac-sha256",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(false);
  });

  it("rejects unsupported algorithm", () => {
    const signature = generateSignature(rawBody, TEST_SECRET_KEY);
    const isValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version: "v1",
      algorithm: "md5",
      apiKey: TEST_SECRET_KEY,
    });
    expect(isValid).toBe(false);
  });
});
