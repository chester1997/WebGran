import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { VideoTriggerService } from "@/lib/videos/video-trigger-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId } = await params;
    const triggers = await VideoTriggerService.listTriggersForVideo(store.id, videoId);

    return NextResponse.json({
      success: true,
      triggers,
    });
  } catch (error: any) {
    console.error("[Seller Video Triggers GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao listar Deep Links do vídeo." },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId } = await params;
    const body = await req.json().catch(() => ({}));
    const { productId, type = "PUBLIC", expiresAt } = body;

    const result = await VideoTriggerService.createTrigger({
      storeId: store.id,
      videoId,
      productId,
      type,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Seller Video Triggers POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Falha ao gerar Deep Link." },
      { status: 400 }
    );
  }
}
