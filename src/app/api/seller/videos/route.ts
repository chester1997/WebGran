import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const statusFilter = searchParams.get("status") || undefined;

    const videos = await ProductVideoService.listSellerLibraryVideos(store.id, { search, statusFilter });
    const usage = await ProductVideoService.getSellerVideoStorageUsage(seller.id, store.id);

    return NextResponse.json({
      success: true,
      videos,
      usage,
    });
  } catch (error: any) {
    console.error("[Seller Videos API Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar biblioteca de vídeos." },
      { status: error.message?.includes("não encontrada") ? 404 : 500 }
    );
  }
}
