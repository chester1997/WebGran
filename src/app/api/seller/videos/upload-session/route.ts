import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const { title, description } = body;
    const fileSize = body.fileSize || body.fileSizeBytes;
    const contentType = body.contentType || body.fileType;

    const result = await ProductVideoService.createProductVideoUploadSession({
      sellerId: seller.id,
      storeId: store.id,
      productId: "library",
      title,
      description,
      contentType,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      ...result,
      uploadAuth: result.uploadSession,
    });
  } catch (error: any) {
    console.error("[Seller Videos Upload Session Error]:", error);
    const status = error.code === "STORAGE_QUOTA_EXCEEDED" || error.message?.includes("não está disponível") || error.message?.includes("atingido") ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message || "Falha ao criar sessão de upload." }, { status });
  }
}
