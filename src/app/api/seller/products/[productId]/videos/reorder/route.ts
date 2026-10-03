import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const resolvedParams = await params;
    const productId = resolvedParams.productId;

    const { orderedVideoIds } = await req.json();

    if (!Array.isArray(orderedVideoIds)) {
      return NextResponse.json(
        { success: false, error: "Parâmetro orderedVideoIds inválido." },
        { status: 400 }
      );
    }

    const updatedVideos = await ProductVideoService.reorderProductVideos(
      store.id,
      productId,
      orderedVideoIds
    );

    return NextResponse.json({
      success: true,
      videos: updatedVideos,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Product Videos Reorder Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao reordenar vídeos." },
      { status: 500 }
    );
  }
}
