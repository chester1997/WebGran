import { NextRequest, NextResponse } from "next/server";
import { resolveMiniAppCustomerSession } from "@/lib/telegram/session";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await resolveMiniAppCustomerSession(req);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autorizado ou sessão Telegram inválida." },
        { status: 401 }
      );
    }

    const { productId } = await params;

    const videos = await ProductVideoService.listCustomerProductVideos(
      session.storeId,
      session.customerId,
      productId
    );

    return NextResponse.json({
      success: true,
      videos,
    });
  } catch (error: any) {
    console.error("[MiniApp Product Videos GET Error]:", error);
    const isAccessError =
      error?.message?.includes("não possui acesso") ||
      error?.message?.includes("expirou");

    return NextResponse.json(
      { success: false, error: error.message || "Erro ao listar vídeos do produto." },
      { status: isAccessError ? 403 : 500 }
    );
  }
}
