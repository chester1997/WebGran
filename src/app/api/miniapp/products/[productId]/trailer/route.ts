import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, productVideos, productVideoAssignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateBunnyPlaybackToken } from "@/lib/bunny/token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Identificador do produto é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Localiza o produto ativo
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.status, "active")),
      columns: {
        id: true,
        storeId: true,
        title: true,
        deliveryType: true,
        trailerVideoId: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Produto não encontrado ou indisponível." },
        { status: 404 }
      );
    }

    // 2. Verifica se o produto possui trailer configurado
    if (!product.trailerVideoId) {
      return NextResponse.json(
        { success: false, error: "Este produto não possui trailer configurado." },
        { status: 404 }
      );
    }

    // 3. Localiza o vídeo correspondente na biblioteca da loja
    const trailerVideo = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, product.trailerVideoId),
        eq(productVideos.storeId, product.storeId),
        eq(productVideos.active, true)
      ),
    });

    if (!trailerVideo) {
      return NextResponse.json(
        { success: false, error: "Vídeo do trailer não encontrado ou inativo." },
        { status: 404 }
      );
    }

    if (trailerVideo.status !== "READY") {
      return NextResponse.json(
        { success: false, error: "O trailer deste produto ainda não está pronto para reprodução." },
        { status: 400 }
      );
    }

    // 4. SEGURANÇA CRÍTICA: Garante que o vídeo do trailer NÃO é um vídeo pago da entrega do produto
    const deliveryAssignment = await db.query.productVideoAssignments.findFirst({
      where: and(
        eq(productVideoAssignments.productId, product.id),
        eq(productVideoAssignments.videoId, trailerVideo.id)
      ),
    });

    if (deliveryAssignment) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado: o arquivo solicitado pertence à entrega restrita do produto." },
        { status: 403 }
      );
    }

    // 5. Gera token de reprodução temporário (1 hora)
    const playbackAuth = generateBunnyPlaybackToken({
      videoId: trailerVideo.bunnyVideoId,
      expiresInSeconds: 3600,
    });

    return NextResponse.json({
      success: true,
      trailer: {
        id: trailerVideo.id,
        title: trailerVideo.title,
        durationSeconds: trailerVideo.durationSeconds || 0,
        thumbnailUrl: trailerVideo.thumbnailUrl,
        playbackUrl: playbackAuth.playbackUrl,
        directUrl: playbackAuth.directUrl,
        expiresAt: playbackAuth.expiresAt,
      },
    });
  } catch (error: any) {
    console.error("[MiniApp Trailer GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao consultar trailer do produto." },
      { status: 500 }
    );
  }
}

