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
    const { title, description, contentType, fileSize } = body;

    const session = await ProductVideoService.createProductVideoUploadSession({
      sellerId: seller.id,
      storeId: store.id,
      productId,
      title,
      description,
      contentType,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      productVideo: session.productVideo,
      uploadSession: session.uploadSession,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    const statusCode = error.code === "STORAGE_QUOTA_EXCEEDED" ? 403 : 400;
    console.error("[Seller Product Video Upload Session Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar sessão de upload do vídeo." },
      { status: statusCode }
    );
  }
}
