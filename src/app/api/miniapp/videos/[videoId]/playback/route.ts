import { NextRequest, NextResponse } from "next/server";
import { resolveMiniAppCustomerSession } from "@/lib/telegram/session";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveMiniAppCustomerSession(req);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida ou não autenticada no Telegram." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.videoId;
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || undefined;

    const playbackData = await ProductVideoService.getProductVideoForPlayback(
      session.storeId,
      session.customerId,
      videoId,
      productId
    );

    return NextResponse.json({
      success: true,
      ...playbackData,
    });
  } catch (error: any) {
    console.error("[MiniApp Playback Error]:", error);
    const status = error.message?.includes("não possui acesso") || error.message?.includes("expirou") ? 403 : 400;
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao solicitar reprodução." },
      { status }
    );
  }
}

