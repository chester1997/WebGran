import { NextRequest, NextResponse } from "next/server";
import { resolveMiniAppCustomerSession } from "@/lib/telegram/session";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveMiniAppCustomerSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }


    const { videoId } = await params;

    const progress = await ProductVideoService.getVideoProgress(
      session.storeId,
      session.customerId,
      videoId
    );

    return NextResponse.json({
      success: true,
      progress: progress ? {
        positionSeconds: progress.positionSeconds,
        durationSeconds: progress.durationSeconds,
        progressPercent: Number(progress.progressPercent),
        completed: progress.completed,
        lastWatchedAt: progress.lastWatchedAt,
      } : null,
    });
  } catch (error: any) {
    console.error("[MiniApp Progress GET Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveMiniAppCustomerSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const { videoId } = await params;
    const body = await req.json();
    const { positionSeconds, durationSeconds } = body;

    const record = await ProductVideoService.upsertVideoProgress(
      session.storeId,
      session.customerId,
      videoId,
      Number(positionSeconds) || 0,
      Number(durationSeconds) || 0
    );

    return NextResponse.json({
      success: true,
      progress: {
        positionSeconds: record.positionSeconds,
        durationSeconds: record.durationSeconds,
        progressPercent: Number(record.progressPercent),
        completed: record.completed,
        lastWatchedAt: record.lastWatchedAt,
      },
    });
  } catch (error: any) {
    console.error("[MiniApp Progress POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
