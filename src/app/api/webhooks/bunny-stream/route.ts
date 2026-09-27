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

    // 2. Extract Official Bunny Stream Signature Headers
    const signature =
      req.headers.get("X-BunnyStream-Signature") ||
      req.headers.get("x-bunnystream-signature");
    const version =
      req.headers.get("X-BunnyStream-Signature-Version") ||
      req.headers.get("x-bunnystream-signature-version");
    const algorithm =
      req.headers.get("X-BunnyStream-Signature-Algorithm") ||
      req.headers.get("x-bunnystream-signature-algorithm");

    // 3. Authenticate Webhook using BUNNY_STREAM_READ_ONLY_API_KEY
    const readOnlyApiKey = process.env.BUNNY_STREAM_READ_ONLY_API_KEY;
    const isSignatureValid = verifyBunnyStreamSignature({
      rawBody,
      signature,
      version,
      algorithm,
      apiKey: readOnlyApiKey,
    });

    if (!isSignatureValid) {
      console.warn("[BunnyStream] Webhook unauthorized request: invalid signature or missing Read-Only API Key");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 4. Parse Webhook Payload
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.warn("[BunnyStream] Webhook body is not valid JSON");
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    // 5. Validate VideoLibraryId
    const expectedLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID || DEFAULT_LIBRARY_ID;
    const incomingLibraryId = String(body.VideoLibraryId ?? body.libraryId ?? "").trim();
    if (incomingLibraryId && incomingLibraryId !== expectedLibraryId) {
      console.warn("[BunnyStream] Webhook VideoLibraryId mismatch:", { incomingLibraryId, expectedLibraryId });
      return NextResponse.json({ success: false, error: "Invalid VideoLibraryId" }, { status: 400 });
    }

    // 6. Extract VideoGuid / VideoId
    const videoGuid = String(body.VideoGuid || body.VideoId || body.videoId || body.guid || "").trim();
    if (!videoGuid) {
      console.warn("[BunnyStream] Webhook missing VideoGuid");
      return NextResponse.json({ success: false, error: "Missing VideoGuid" }, { status: 400 });
    }

    console.log("[BunnyStream] Webhook received for videoGuid:", {
      videoLibraryId: incomingLibraryId,
      videoGuid,
      status: body.Status ?? body.status,
      details: body.StatusDetails || body.message,
    });

    // 7. Locate Clip in Neon database
    const clip = await ClipService.getClipByBunnyVideoId(videoGuid);
    if (!clip) {
      console.warn("[BunnyStream] Clip not found in database for videoGuid:", videoGuid);
      // Return 200 to prevent Bunny webhook retries for unrecognized video IDs
      return NextResponse.json({ success: true, message: "Clip record not found in database, ignored" });
    }

    // 8. Resolve target status using strict status mapping & transition rules
    const rawStatus = body.Status ?? body.status;
    const statusDetails = body.StatusDetails || body.message;
    const newStatus = resolveClipStatusTransition(
      rawStatus,
      clip.status as ClipStatus,
      statusDetails
    );

    // 9. Fetch details from Bunny Stream API if READY to retrieve exact duration & thumbnail
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

    // 10. Update status in database (Idempotent - preserves existing duration/thumbnail if omitted)
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
