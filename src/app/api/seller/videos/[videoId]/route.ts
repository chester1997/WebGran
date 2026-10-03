import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId } = await params;
    const body = await req.json();
    const { title, description, active } = body;

    const updated = await ProductVideoService.updateLibraryVideo(store.id, videoId, {
      title,
      description,
      active,
    });

    return NextResponse.json({
      success: true,
      video: updated,
    });
  } catch (error: any) {
    console.error("[Seller Video PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Falha ao atualizar vídeo." },
      { status: error.message?.includes("não encontrado") ? 404 : 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { videoId } = await params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const result = await ProductVideoService.deleteLibraryVideo(store.id, videoId, force);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Seller Video DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Falha ao excluir vídeo." },
      { status: error.message?.includes("não encontrado") ? 404 : 400 }
    );
  }
}
