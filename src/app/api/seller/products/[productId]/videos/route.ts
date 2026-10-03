import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function GET(
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

    const videos = await ProductVideoService.listProductVideos(store.id, productId);

    return NextResponse.json({
      success: true,
      videos,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Product Videos GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao listar vídeos do produto." },
      { status: 500 }
    );
  }
}
