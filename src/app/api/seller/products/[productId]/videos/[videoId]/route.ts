import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ productId: string; videoId: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { productId, videoId } = await params;
    const body = await req.json();

    const updated = await ProductVideoService.updateProductVideo(
      store.id,
      productId,
      videoId,
      body
    );

    return NextResponse.json({
      success: true,
      video: updated,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Product Video PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar vídeo." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ productId: string; videoId: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { productId, videoId } = await params;

    const result = await ProductVideoService.removeVideoAssignment(
      store.id,
      productId,
      videoId
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Product Video DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao excluir vídeo." },
      { status: 500 }
    );
  }
}
