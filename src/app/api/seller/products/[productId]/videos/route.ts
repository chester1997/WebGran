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

    const { productId } = await params;
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { productId } = await params;
    const body = await req.json();
    const { videoIds } = body;

    if (!Array.isArray(videoIds)) {
      return NextResponse.json(
        { success: false, error: "O campo videoIds deve ser um array." },
        { status: 400 }
      );
    }

    const assignedVideos = await ProductVideoService.assignVideosToProduct(
      store.id,
      productId,
      videoIds,
      seller.id
    );

    return NextResponse.json({
      success: true,
      videos: assignedVideos,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Product Videos POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao vincular vídeos ao produto." },
      { status: 400 }
    );
  }
}
