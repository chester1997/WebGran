import crypto from "crypto";

export type ClipStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export const DEFAULT_LIBRARY_ID = "763931";

export interface VerifySignatureParams {
  rawBody: string;
  signature: string | null;
  version?: string | null;
  algorithm?: string | null;
  apiKey?: string;
}

/**
 * Validates Bunny Stream webhook signature using HMAC-SHA256, SHA256, or token comparison with constant-time security.
 * Flexible enough to support Bunny Stream Webhook headers (signature, x-bunny-signature, token, etc.).
 */
export function verifyBunnyStreamSignature({
  rawBody,
  signature,
  version,
  algorithm,
  apiKey,
}: VerifySignatureParams): boolean {
  if (!apiKey || !signature) {
    return false;
  }

  if (version && version !== "v1") {
    return false;
  }

  if (algorithm && algorithm.toLowerCase() !== "hmac-sha256") {
    return false;
  }

  const cleanSig = signature.replace(/^Bearer\s+/i, "").trim().toLowerCase();
  if (!cleanSig) return false;

  // 1. HMAC-SHA256 signature check over rawBody
  const expectedHmac = crypto
    .createHmac("sha256", apiKey)
    .update(rawBody)
    .digest("hex")
    .toLowerCase();

  if (cleanSig.length === expectedHmac.length) {
    if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(expectedHmac))) {
      return true;
    }
  }

  // 2. SHA256(apiKey + rawBody) hash check
  const expectedSha = crypto
    .createHash("sha256")
    .update(apiKey + rawBody)
    .digest("hex")
    .toLowerCase();

  if (cleanSig.length === expectedSha.length) {
    if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(expectedSha))) {
      return true;
    }
  }

  // 3. Direct token match check
  const cleanKey = apiKey.trim().toLowerCase();
  if (cleanSig.length === cleanKey.length) {
    if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(cleanKey))) {
      return true;
    }
  }

  return false;
}

/**
 * Maps Bunny Stream status integer/string to internal ClipStatus,
 * enforcing state transition rules to prevent regressions (e.g. READY -> PROCESSING).
 */
export function resolveClipStatusTransition(
  rawStatus: number | string | undefined | null,
  currentStatus?: ClipStatus | null,
  statusDetails?: string | null
): ClipStatus {
  const statusNum =
    typeof rawStatus === "number"
      ? rawStatus
      : typeof rawStatus === "string" && !isNaN(Number(rawStatus)) && rawStatus.trim() !== ""
      ? parseInt(rawStatus, 10)
      : null;

  let targetStatus: ClipStatus | null = null;

  if (statusNum !== null) {
    switch (statusNum) {
      case 0: // Queued
      case 1: // Processing
      case 2: // Encoding
      case 6: // PresignedUploadStarted
      case 7: // PresignedUploadFinished
        targetStatus = "PROCESSING";
        break;

      case 3: // Finished
      case 4: // ResolutionFinished
        targetStatus = "READY";
        break;

      case 5: // Failed
      case 8: // PresignedUploadFailed
        targetStatus = "FAILED";
        break;

      case 9: // CaptionsGenerated
      case 10: // TitleOrDescriptionGenerated
        targetStatus = null; // Complementary events preserve existing state
        break;

      default:
        targetStatus = "PROCESSING";
        break;
    }
  } else if (typeof rawStatus === "string") {
    const s = rawStatus.toUpperCase().trim();
    if (s === "FINISHED" || s === "READY" || s === "RESOLUTIONFINISHED") {
      targetStatus = "READY";
    } else if (
      s === "FAILED" ||
      s === "UPLOADFAILED" ||
      s === "ENCODINGFAILED" ||
      s === "PRESIGNEDUPLOADFAILED"
    ) {
      targetStatus = "FAILED";
    } else if (s === "CAPTIONSGENERATED" || s === "TITLEORDESCRIPTIONGENERATED") {
      targetStatus = null;
    } else {
      targetStatus = "PROCESSING";
    }
  } else if (statusDetails) {
    const details = statusDetails.toLowerCase();
    if (details.includes("complete") || details.includes("finished")) {
      targetStatus = "READY";
    } else if (details.includes("failed")) {
      targetStatus = "FAILED";
    }
  }

  const current = currentStatus || "UPLOADING";

  // Prevent state regression:
  // If current state is READY, stay READY unless explicitly FAILED.
  if (current === "READY") {
    if (targetStatus === "FAILED") {
      return "FAILED";
    }
    return "READY";
  }

  // Complementary events (9, 10) preserve current state
  if (targetStatus === null) {
    return current;
  }

  return targetStatus;
}
