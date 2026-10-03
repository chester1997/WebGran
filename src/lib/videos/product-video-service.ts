import { db } from "@/db";
import {
  productVideos,
  videoProgress,
  products,
  accesses,
  storageReservations,
  pendingDeletions,
} from "@/db/schema";
import { eq, and, asc, count, sql } from "drizzle-orm";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { generateBunnyPlaybackToken } from "@/lib/bunny/token";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { hasFeature, checkLimit, getSellerEntitlement } from "@/lib/entitlements/entitlement-service";
import { resolveClipStatusTransition, ClipStatus } from "@/lib/bunny/webhook-utils";

export interface CreateProductVideoOptions {
  sellerId: string;
  storeId: string;
  productId: string;
  title: string;
  description?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
}

export interface UpdateProductVideoOptions {
  title?: string;
  description?: string | null;
  position?: number;
  active?: boolean;
}

export class ProductVideoService {
  /**
   * Helper to look up a Product Video by its Bunny Stream video ID.
   */
  static async getProductVideoByBunnyId(bunnyVideoId: string) {
    return await db.query.productVideos.findFirst({
      where: eq(productVideos.bunnyVideoId, bunnyVideoId),
    });
  }

  /**
   * List all Product Videos for a specific product within a store (ordered by position).
   */
  static async listProductVideos(storeId: string, productId: string, activeOnly = false) {
    const conditions = [
      eq(productVideos.storeId, storeId),
      eq(productVideos.productId, productId),
    ];
    if (activeOnly) {
      conditions.push(eq(productVideos.active, true));
    }

    return await db.query.productVideos.findMany({
      where: and(...conditions),
      orderBy: [asc(productVideos.position), asc(productVideos.createdAt)],
    });
  }

  /**
   * Creates a Product Video upload session with storage quota reservation & entitlement validation.
   */
  static async createProductVideoUploadSession(options: CreateProductVideoOptions) {
    const { sellerId, storeId, productId, title, description, contentType, fileSize } = options;

    // 1. Entitlement checks
    const videosAllowed = await hasFeature(sellerId, "product_videos_enabled");
    if (!videosAllowed) {
      throw new Error("A funcionalidade de Product Videos não está disponível no seu plano.");
    }

    const [videoCountRes] = await db
      .select({ value: count() })
      .from(productVideos)
      .where(eq(productVideos.storeId, storeId));
    const currentVideoCount = videoCountRes?.value ?? 0;

    const videoLimitCheck = await checkLimit(sellerId, "max_product_videos", currentVideoCount);
    if (!videoLimitCheck.allowed) {
      throw new Error(
        `Limite de vídeos de produtos atingido (${currentVideoCount}/${videoLimitCheck.limit}). Faça upgrade do seu plano.`
      );
    }

    const sizeEntitlement = await getSellerEntitlement(sellerId, "max_video_size_mb");
    const maxVideoSizeMb =
      sizeEntitlement.isUnlimited || sizeEntitlement.value === -1
        ? 500
        : Number(sizeEntitlement.value) || 500;
    const maxFileSizeBytes = maxVideoSizeMb * 1024 * 1024;

    // Input Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      throw new Error("O título do vídeo é obrigatório.");
    }

    if (contentType && typeof contentType === "string") {
      const cleanMime = contentType.toLowerCase().trim();
      if (!cleanMime.startsWith("video/")) {
        throw new Error("O arquivo selecionado deve ser um vídeo válido.");
      }
    }

    if (fileSize !== undefined && fileSize !== null) {
      const size = Number(fileSize);
      if (isNaN(size) || size <= 0) {
        throw new Error("Tamanho de arquivo inválido.");
      }
      if (size > maxFileSizeBytes) {
        throw new Error(
          `O arquivo excede o limite máximo permitido de ${maxVideoSizeMb}MB para o seu plano.`
        );
      }
    }

    // Multi-tenant Product Validation
    const targetProduct = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!targetProduct) {
      throw new Error("O produto selecionado é inválido ou não pertence a esta loja.");
    }

    // Storage Quota Reservation
    const requestedBytes = fileSize ? Number(fileSize) : 50 * 1024 * 1024;
    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId,
      storeId,
      bytes: requestedBytes,
      referenceType: "product_video_upload",
      expirationMinutes: 180,
    });

    if (!reservation.allowed) {
      const err: any = new Error(
        reservation.reason || "Capacidade de armazenamento excedida para o seu plano."
      );
      err.code = "STORAGE_QUOTA_EXCEEDED";
      throw err;
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

    // Bind reservation referenceId
    if (reservation.reservationId && bunnyVideo.videoId) {
      await db
        .update(storageReservations)
        .set({ referenceId: bunnyVideo.videoId, updatedAt: new Date() })
        .where(eq(storageReservations.id, reservation.reservationId));
    }

    // Determine position
    const currentVideos = await this.listProductVideos(storeId, productId);
    const nextPosition = currentVideos.length > 0 ? Math.max(...currentVideos.map((v) => v.position)) + 1 : 0;

    // 3. Register Product Video metadata in Neon DB
    let videoRecord;
    try {
      const inserted = await db
        .insert(productVideos)
        .values({
          storeId,
          productId,
          bunnyVideoId: bunnyVideo.videoId,
          title: title.trim(),
          description: description?.trim() || null,
          position: nextPosition,
          status: "UPLOADING",
          active: true,
        })
        .returning();
      videoRecord = inserted[0];
    } catch (dbError) {
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
      try {
        await BunnyStreamService.deleteVideo(bunnyVideo.videoId);
      } catch (rollbackErr) {
        console.error("[ProductVideoService] Rollback failed to delete Bunny video:", rollbackErr);
      }
      throw dbError;
    }

    // 4. Generate Presigned Signature for direct browser upload
    const uploadSession = BunnyStreamService.generateDirectUploadSignature(bunnyVideo.videoId);

    return {
      productVideo: videoRecord,
      uploadSession: {
        uploadUrl: uploadSession.uploadUrl,
        tusUploadUrl: uploadSession.tusUploadUrl,
        headers: uploadSession.headers,
        expirationTime: uploadSession.expirationTime,
        libraryId: uploadSession.libraryId,
        videoId: uploadSession.videoId,
      },
    };
  }

  /**
   * Updates Product Video status via Webhook or background job.
   */
  static async updateProductVideoStatusByBunnyId(
    bunnyVideoId: string,
    newStatus: ClipStatus,
    details?: { duration?: number; thumbnailUrl?: string; storageSize?: number }
  ) {
    const video = await this.getProductVideoByBunnyId(bunnyVideoId);
    if (!video) return null;

    const currentStatus = video.status as ClipStatus;
    const resolvedStatus = resolveClipStatusTransition(newStatus, currentStatus);

    const updatePayload: any = {
      status: resolvedStatus,
      updatedAt: new Date(),
    };

    if (details?.duration !== undefined) {
      updatePayload.durationSeconds = details.duration;
    }
    if (details?.thumbnailUrl !== undefined) {
      updatePayload.thumbnailUrl = details.thumbnailUrl;
    }

    const [updated] = await db
      .update(productVideos)
      .set(updatePayload)
      .where(eq(productVideos.id, video.id))
      .returning();

    return updated;
  }

  /**
   * Edit product video attributes (title, description, active).
   */
  static async updateProductVideo(
    storeId: string,
    productId: string,
    videoId: string,
    options: UpdateProductVideoOptions
  ) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.productId, productId),
        eq(productVideos.storeId, storeId)
      ),
    });

    if (!video) {
      throw new Error("Vídeo de produto não encontrado para este produto.");
    }

    const payload: any = { updatedAt: new Date() };
    if (options.title !== undefined) payload.title = options.title.trim();
    if (options.description !== undefined) payload.description = options.description?.trim() || null;
    if (options.position !== undefined) payload.position = options.position;
    if (options.active !== undefined) payload.active = Boolean(options.active);

    const [updated] = await db
      .update(productVideos)
      .set(payload)
      .where(eq(productVideos.id, videoId))
      .returning();

    return updated;
  }

  /**
   * Reorders product videos by position.
   */
  static async reorderProductVideos(storeId: string, productId: string, orderedVideoIds: string[]) {
    const videos = await this.listProductVideos(storeId, productId);
    const videoMap = new Map(videos.map((v) => [v.id, v]));

    for (let index = 0; index < orderedVideoIds.length; index++) {
      const vid = orderedVideoIds[index];
      if (videoMap.has(vid)) {
        await db
          .update(productVideos)
          .set({ position: index, updatedAt: new Date() })
          .where(eq(productVideos.id, vid));
      }
    }

    return await this.listProductVideos(storeId, productId);
  }

  /**
   * Deletes a Product Video using the existing pending_deletions & storage lifecycle infrastructure.
   */
  static async deleteProductVideo(storeId: string, productId: string, videoId: string) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.productId, productId),
        eq(productVideos.storeId, storeId)
      ),
    });

    if (!video) {
      throw new Error("Vídeo não encontrado ou sem permissão de acesso.");
    }

    const bunnyVideoId = video.bunnyVideoId;

    // 1. Delete DB record first
    await db.delete(productVideos).where(eq(productVideos.id, videoId));

    // 2. Attempt Bunny Stream API deletion
    let bunnySuccess = false;
    try {
      bunnySuccess = await BunnyStreamService.deleteVideo(bunnyVideoId);
    } catch (err: any) {
      console.warn("[ProductVideoService] Bunny Stream delete API failed, enqueuing pending_deletion:", err.message);
    }

    if (!bunnySuccess) {
      // Register in pending_deletions for background retry GC
      await db.insert(pendingDeletions).values({
        storeId,
        provider: "bunny_stream",
        path: bunnyVideoId,
        resourceId: bunnyVideoId,
      });
    }

    // 3. Release storage usage / reservation
    await StorageUsageService.releaseReservationByReference("product_video_upload", bunnyVideoId);

    return { success: true, deletedVideoId: videoId };
  }

  /**
   * Authorizes video playback for an authenticated Telegram customer after verifying active product access.
   */
  static async getProductVideoForPlayback(storeId: string, customerId: string, videoId: string) {
    // 1. Find Product Video
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.storeId, storeId),
        eq(productVideos.active, true)
      ),
      with: {
        product: true,
      },
    });

    if (!video) {
      throw new Error("Vídeo de produto não encontrado ou inativo.");
    }

    if (video.status !== "READY") {
      throw new Error("Este vídeo ainda está em processamento e não pode ser reproduzido.");
    }

    // 2. Server-side Access Authorization Check
    // Query accesses table for storeId + customerId + productId + status 'ACTIVE'
    const now = new Date();
    const accessRecord = await db.query.accesses.findFirst({
      where: and(
        eq(accesses.storeId, storeId),
        eq(accesses.customerId, customerId),
        eq(accesses.productId, video.productId),
        eq(accesses.status, "ACTIVE")
      ),
    });

    if (!accessRecord) {
      throw new Error("Você não possui acesso válido a este produto.");
    }

    if (accessRecord.expiresAt && new Date(accessRecord.expiresAt) < now) {
      throw new Error("Seu acesso a este produto expirou.");
    }

    // 3. Generate Temporary Bunny Playback Token Authorization
    const playbackAuth = generateBunnyPlaybackToken({
      videoId: video.bunnyVideoId,
      expiresInSeconds: 3600,
    });

    // 4. Load Customer Progress if exists
    const progress = await this.getVideoProgress(storeId, customerId, video.id);

    return {
      video: {
        id: video.id,
        storeId: video.storeId,
        productId: video.productId,
        productTitle: video.product?.title || "",
        title: video.title,
        description: video.description,
        position: video.position,
        durationSeconds: video.durationSeconds || 0,
        thumbnailUrl: video.thumbnailUrl,
      },
      playback: {
        playbackUrl: playbackAuth.playbackUrl,
        directUrl: playbackAuth.directUrl,
        expiresAt: playbackAuth.expiresAt,
      },
      progress: progress ? {
        positionSeconds: progress.positionSeconds,
        durationSeconds: progress.durationSeconds,
        progressPercent: Number(progress.progressPercent),
        completed: progress.completed,
        lastWatchedAt: progress.lastWatchedAt,
      } : null,
    };
  }

  /**
   * Save/Upsert customer video progress.
   */
  static async upsertVideoProgress(
    storeId: string,
    customerId: string,
    productVideoId: string,
    positionSecondsRaw: number,
    durationSecondsRaw: number
  ) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, productVideoId),
        eq(productVideos.storeId, storeId)
      ),
    });

    if (!video) {
      throw new Error("Vídeo de produto não encontrado.");
    }

    const durationSeconds = Math.max(0, Math.round(durationSecondsRaw || video.durationSeconds || 0));
    const positionSeconds = Math.min(durationSeconds > 0 ? durationSeconds : 86400, Math.max(0, Math.round(positionSecondsRaw || 0)));

    let progressPercent = 0;
    if (durationSeconds > 0) {
      progressPercent = Math.min(100, Math.round((positionSeconds / durationSeconds) * 10000) / 100);
    }

    const completed = progressPercent >= 90 || (durationSeconds > 0 && positionSeconds >= durationSeconds - 5);
    const now = new Date();

    const [record] = await db
      .insert(videoProgress)
      .values({
        storeId,
        customerId,
        productVideoId,
        positionSeconds,
        durationSeconds,
        progressPercent: progressPercent.toString(),
        completed,
        lastWatchedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [videoProgress.customerId, videoProgress.productVideoId],
        set: {
          positionSeconds: sql`GREATEST(EXCLUDED.position_seconds, video_progress.position_seconds)`,
          durationSeconds: sql`EXCLUDED.duration_seconds`,
          progressPercent: sql`GREATEST(EXCLUDED.progress_percent, video_progress.progress_percent)`,
          completed: sql`EXCLUDED.completed OR video_progress.completed`,
          lastWatchedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return record;
  }

  /**
   * Gets video progress for customer.
   */
  static async getVideoProgress(storeId: string, customerId: string, productVideoId: string) {
    return await db.query.videoProgress.findFirst({
      where: and(
        eq(videoProgress.storeId, storeId),
        eq(videoProgress.customerId, customerId),
        eq(videoProgress.productVideoId, productVideoId)
      ),
    });
  }
}
