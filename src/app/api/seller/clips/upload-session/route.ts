import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { ClipService } from "@/lib/clips/service";

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB max file size limit

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, contentType, fileSize } = body;

    // 1. Input Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "O título do clipe é obrigatório." }, { status: 400 });
    }

    if (contentType && typeof contentType === "string") {
      const cleanMime = contentType.toLowerCase().trim();
      if (!cleanMime.startsWith("video/")) {
        return NextResponse.json({ success: false, error: "O arquivo selecionado deve ser um vídeo válido." }, { status: 400 });
      }
    }

    if (fileSize !== undefined && fileSize !== null) {
      const size = Number(fileSize);
      if (isNaN(size) || size <= 0) {
        return NextResponse.json({ success: false, error: "Tamanho de arquivo inválido." }, { status: 400 });
      }
      if (size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: "O arquivo excede o limite máximo permitido de 500MB." }, { status: 400 });
      }
    }

    // 2. Create Video Object in Bunny Stream API
    const bunnyVideo = await BunnyStreamService.createVideo(title.trim());

    // 3. Register Clip metadata in Neon database (Scoped to authenticated seller's store.id)
    let clip;
    try {
      clip = await ClipService.createClip({
        storeId: store.id,
        title: title.trim(),
        description: description?.trim() || null,
        bunnyVideoId: bunnyVideo.videoId,
      });
    } catch (dbError) {
      console.error("[Clip Upload Session] DB creation failed, rolling back Bunny Stream video:", bunnyVideo.videoId);
      try {
        await BunnyStreamService.deleteVideo(bunnyVideo.videoId);
      } catch (rollbackErr) {
        console.error("[Clip Upload Session] Rollback failed to delete Bunny video:", rollbackErr);
      }
      throw dbError;
    }

    // 4. Generate Presigned Signature for direct browser upload
    const uploadSession = BunnyStreamService.generateDirectUploadSignature(bunnyVideo.videoId);

    // 5. Return Safe Credentials (Secrets are never exposed to browser)
    return NextResponse.json({
      success: true,
      clip: {
        id: clip.id,
        storeId: clip.storeId,
        title: clip.title,
        bunnyVideoId: clip.bunnyVideoId,
        status: clip.status,
        position: clip.position,
      },
      uploadSession: {
        uploadUrl: uploadSession.uploadUrl,
        tusUploadUrl: uploadSession.tusUploadUrl,
        headers: uploadSession.headers,
        expirationTime: uploadSession.expirationTime,
        libraryId: uploadSession.libraryId,
        videoId: uploadSession.videoId,
      },
    });
  } catch (error: any) {
    console.error("[Clip Upload Session Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar sessão de upload." },
      { status: 500 }
    );
  }
}
