import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { VideoTriggerService } from "@/lib/videos/video-trigger-service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string; triggerId: string }> }
) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId, triggerId } = await params;
    const updated = await VideoTriggerService.deactivateTrigger(store.id, videoId, triggerId);

    return NextResponse.json({
      success: true,
      trigger: updated,
    });
  } catch (error: any) {
    console.error("[Seller Video Trigger DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Falha ao desativar Deep Link." },
      { status: 400 }
    );
  }
}
