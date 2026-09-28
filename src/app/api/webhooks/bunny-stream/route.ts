import { NextResponse } from "next/server";
import { ClipService } from "@/lib/clips/service";
import { BunnyStreamService } from "@/lib/bunny/stream";
import {
  verifyBunnyStreamSignature,
  resolveClipStatusTransition,
  DEFAULT_LIBRARY_ID,
  ClipStatus,
} from "@/lib/bunny/webhook-utils";

export async function POST(req: Request) {
  try {
    // 1. Read Raw Request Body exactly as received
    const rawBody = await req.text();

    // 2. Extract ONLY official Bunny Stream Webhook Headers
    const version =
      req.headers.get("X-BunnyStream-Signature-Version") ||
      req.headers.get("x-bunnystream-signature-version");
    const algorithm =
      req.headers.get("X-BunnyStream-Signature-Algorithm") ||
      req.headers.get("x-bunnystream-signature-algorithm");
    const signature =
      req.headers.get("X-BunnyStream-Signature") ||
      req.headers.get("x-bunnystream-signature");

    // 3. Reject with 401 if any mandatory header is missing
    if (!version || !algorithm || !signature) {
      console.warn("[BunnyStream] Webhook rejected: missing mandatory signature headers");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 4. Validate header values (Version must be "v1", Algorithm must be "hmac-sha256")
    if (version.trim() !== "v1" || algorithm.trim().toLowerCase() !== "hmac-sha256") {
      console.warn("[BunnyStream] Webhook rejected: invalid signature version or algorithm");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 5. Retrieve Read-Only API Key exclusively (NO FALLBACK to write key)
    const readOnlyApiKey = process.env.BUNNY_STREAM_READ_ONLY_API_KEY;
    if (!readOnlyApiKey) {
      console.error("[BunnyStream] Webhook error: BUNNY_STREAM_READ_ONLY_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Webhook authentication unconfigured" },
        { status: 401 }
      );
    }

    // 6. Verify HMAC-SHA256 signature using Read-Only API Key over rawBody
    const isSignatureValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version,
      algorithm,
      readOnlyApiKey,
    });

    if (!isSignatureValid) {
      console.warn("[BunnyStream] Webhook request invalid signature");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 7. Parse Webhook Payload ONLY AFTER signature is verified
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.warn("[BunnyStream] Webhook body is not valid JSON");
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    // 8. Validate VideoLibraryId (payload.VideoLibraryId must match expected library ID 763931)
    const expectedLibraryId = String(process.env.BUNNY_STREAM_LIBRARY_ID || DEFAULT_LIBRARY_ID).trim();
    const incomingLibraryId = String(body.VideoLibraryId ?? body.libraryId ?? "").trim();
    if (!incomingLibraryId || incomingLibraryId !== expectedLibraryId) {
      console.warn("[BunnyStream] Webhook VideoLibraryId mismatch:", { incomingLibraryId, expectedLibraryId });
      return NextResponse.json({ success: false, error: "Invalid VideoLibraryId" }, { status: 400 });
    }

    // 9. Extract VideoGuid / VideoId
    const videoGuid = String(body.VideoGuid || body.VideoId || body.videoId || body.guid || "").trim();
    if (!videoGuid) {
      console.warn("[BunnyStream] Webhook missing VideoGuid");
      return NextResponse.json({ success: false, error: "Missing VideoGuid" }, { status: 400 });
    }

    console.log("[BunnyStream] Webhook received for videoGuid:", {
      videoLibraryId: incomingLibraryId,
      videoGuid,
      status: body.Status ?? body.status,
    });

    // 10. Locate Clip in Neon database
    const clip = await ClipService.getClipByBunnyVideoId(videoGuid);
    if (!clip) {
      console.warn("[BunnyStream] Clip not found in database for videoGuid:", videoGuid);
      return NextResponse.json({ success: true, message: "Clip record not found in database, ignored" });
    }

    // 11. Resolve target status using strict status mapping & transition rules
    const rawStatus = body.Status ?? body.status;
    const statusDetails = body.StatusDetails || body.message;
    const newStatus = resolveClipStatusTransition(
      rawStatus,
      clip.status as ClipStatus,
      statusDetails
    );

    // 12. Fetch details from Bunny Stream API if READY to retrieve exact duration & thumbnail
    let duration: number | undefined = undefined;
    let thumbnailUrl: string | undefined = undefined;

    if (newStatus === "READY") {
      try {
        const videoInfo = await BunnyStreamService.getVideo(videoGuid);
        if (videoInfo && typeof videoInfo.length === "number" && videoInfo.length > 0) {
          duration = Math.round(videoInfo.length);
        }
        if (videoInfo?.thumbnailFileName) {
          thumbnailUrl = BunnyStreamService.getThumbnailUrl(videoGuid, videoInfo.thumbnailFileName);
        }
      } catch (err) {
        console.error("[BunnyStream] Failed to fetch video info from Bunny API during webhook:", err);
      }
    }

    // 13. Update status in database (Idempotent)
    const updated = await ClipService.updateClipStatusByBunnyId(videoGuid, newStatus, {
      duration,
      thumbnailUrl,
    });

    return NextResponse.json({
      success: true,
      clipId: updated?.id || clip.id,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("[BunnyStream] Webhook internal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Webhook Error" },
      { status: 500 }
    );
  }
}
