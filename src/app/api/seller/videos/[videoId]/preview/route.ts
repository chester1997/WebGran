import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId } = await params;
    if (!videoId) {
      return NextResponse.json({ success: false, error: "ID do vídeo é obrigatório." }, { status: 400 });
    }

    const previewData = await ProductVideoService.getLibraryVideoForPreview(store.id, videoId);

    return NextResponse.json({
      success: true,
      ...previewData,
    });
  } catch (error: any) {
    console.error("[Seller Video Preview API Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao obter dados de preview do vídeo." },
      { status: error.message?.includes("não encontrado") || error.message?.includes("permissão") ? 404 : 400 }
    );
  }
}
