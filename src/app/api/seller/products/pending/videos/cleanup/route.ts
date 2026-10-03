import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const { pendingBunnyVideoIds } = body;

    const res = await ProductVideoService.cleanupPendingVideos(
      seller.id,
      store.id,
      pendingBunnyVideoIds || []
    );

    return NextResponse.json(res);
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Cleanup Pending Videos Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao limpar vídeos pendentes." },
      { status: 400 }
    );
  }
}
