import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { ClipService } from "@/lib/clips/service";
import { db } from "@/db";
import { products, clips, storageReservations } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { hasFeature, checkLimit, getSellerEntitlement } from "@/lib/entitlements/entitlement-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB max file size limit

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    // Entitlement checks: clips_enabled, max_clips, max_video_size_mb
    const clipsAllowed = await hasFeature(seller.id, "clips_enabled");
    if (!clipsAllowed) {
      return NextResponse.json({ success: false, error: "A funcionalidade de Clips não está disponível no seu plano." }, { status: 403 });
    }

    const [clipCountRes] = await db
      .select({ value: count() })
      .from(clips)
      .where(eq(clips.storeId, store.id));
    const currentClipCount = clipCountRes?.value ?? 0;

    const clipLimitCheck = await checkLimit(seller.id, "max_clips", currentClipCount);
    if (!clipLimitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Limite de clips atingido (${currentClipCount}/${clipLimitCheck.limit}). Faça upgrade do seu plano.` },
        { status: 403 }
      );
    }

    const sizeEntitlement = await getSellerEntitlement(seller.id, "max_video_size_mb");
    const maxVideoSizeMb = sizeEntitlement.isUnlimited || sizeEntitlement.value === -1 ? 500 : (Number(sizeEntitlement.value) || 500);
    const maxFileSizeBytes = maxVideoSizeMb * 1024 * 1024;

    const body = await req.json();
    const { title, description, contentType, fileSize, productId } = body;

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
      if (size > maxFileSizeBytes) {
        return NextResponse.json(
          { success: false, error: `O arquivo excede o limite máximo permitido de ${maxVideoSizeMb}MB para o seu plano.` },
          { status: 400 }
        );
      }
    }

    // Multi-tenant Product Validation
    let validProductId: string | null = null;
    if (productId && typeof productId === "string" && productId.trim()) {
      const targetProd = await db.query.products.findFirst({
        where: and(eq(products.id, productId.trim()), eq(products.storeId, store.id)),
      });
      if (!targetProd) {
        return NextResponse.json(
          { success: false, error: "O produto selecionado é inválido ou não pertence a esta loja." },
          { status: 400 }
        );
      }
      validProductId = targetProd.id;
    }

    // Storage Quota Reservation for Video Clip
    const requestedBytes = fileSize ? Number(fileSize) : 50 * 1024 * 1024;
    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId: seller.id,
      storeId: store.id,
      bytes: requestedBytes,
      referenceType: "clip_upload",
      expirationMinutes: 180, // 3 hours processing window
    });

    if (!reservation.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "STORAGE_QUOTA_EXCEEDED",
          error: reservation.reason || "Capacidade de armazenamento excedida para o seu plano.",
        },
        { status: 403 }
      );
    }

    // 2. Create Video Object in Bunny Stream API
    let bunnyVideo;
    try {
      bunnyVideo = await BunnyStreamService.createVideo(title.trim());
    } catch (createErr: any) {
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
      throw createErr;
    }

    // Bind reservation referenceId to bunnyVideo.videoId
    if (reservation.reservationId && bunnyVideo.videoId) {
      await db
        .update(storageReservations)
        .set({ referenceId: bunnyVideo.videoId, updatedAt: new Date() })
        .where(eq(storageReservations.id, reservation.reservationId));
    }

    // 3. Register Clip metadata in Neon database (Scoped to authenticated seller's store.id)
    let clip;
    try {
      clip = await ClipService.createClip({
        storeId: store.id,
        title: title.trim(),
        description: description?.trim() || null,
        bunnyVideoId: bunnyVideo.videoId,
        productId: validProductId,
      });
    } catch (dbError) {
      console.error("[Clip Upload Session] DB creation failed, rolling back Bunny Stream video & reservation:", bunnyVideo.videoId);
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
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
