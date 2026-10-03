import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

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

    const resolvedParams = await params;
    const productId = resolvedParams.productId;

    const body = await req.json();
    const { pendingVideos } = body;

    const attached = await ProductVideoService.attachPendingVideos(
      seller.id,
      store.id,
      productId,
      pendingVideos || []
    );

    return NextResponse.json({ success: true, videos: attached });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Attach Pending Videos Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao associar vídeos ao produto." },
      { status: 400 }
    );
  }
}
