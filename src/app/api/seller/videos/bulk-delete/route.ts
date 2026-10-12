import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function POST(req: NextRequest) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const { videoIds, force } = body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum vídeo selecionado para exclusão." },
        { status: 400 }
      );
    }

    if (videoIds.length > 50) {
      return NextResponse.json(
        { success: false, error: "Limite máximo de 50 vídeos por requisição excedido." },
        { status: 400 }
      );
    }

    const result = await ProductVideoService.bulkDeleteLibraryVideos(
      store.ownerId,
      store.id,
      videoIds,
      { force: Boolean(force) }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Seller Video Bulk DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Falha ao executar exclusão em massa." },
      { status: 500 }
    );
  }
}
