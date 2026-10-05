import { db } from "@/db";
import {
  productVideos,
  productVideoAssignments,
  videoProgress,
  products,
  accesses,
  telegramCustomers,
  storageReservations,
  pendingDeletions,
  videoLibrarySubscriptions,
} from "@/db/schema";
import { eq, and, asc, desc, count, sql, ilike, gt, ne, inArray } from "drizzle-orm";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { generateBunnyPlaybackToken } from "@/lib/bunny/token";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { hasFeature, checkLimit, getSellerEntitlement } from "@/lib/entitlements/entitlement-service";
import { resolveClipStatusTransition, ClipStatus } from "@/lib/bunny/webhook-utils";

export interface CreateProductVideoOptions {
  sellerId: string;
  storeId: string;
  productId?: string | null;
  title: string;
  description?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  fileSizeBytes?: number | null;
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
   * Supports both product_video_assignments table and legacy direct productId field.
   */
  static async listProductVideos(storeId: string, productId: string, activeOnly = false) {
    if (!productId || productId === "pending" || productId === "library") {
      return [];
    }

    const assignments = await db.query.productVideoAssignments.findMany({
      where: and(
        eq(productVideoAssignments.storeId, storeId),
        eq(productVideoAssignments.productId, productId)
      ),
      with: {
        video: true,
      },
      orderBy: [asc(productVideoAssignments.position), asc(productVideoAssignments.createdAt)],
    });

    const legacyConditions = [
      eq(productVideos.storeId, storeId),
      eq(productVideos.productId, productId),
    ];
    if (activeOnly) {
      legacyConditions.push(eq(productVideos.active, true));
    }
    const legacyVideos = await db.query.productVideos.findMany({
      where: and(...legacyConditions),
      orderBy: [asc(productVideos.position), asc(productVideos.createdAt)],
    });

    const resultList: any[] = [];
    const seenVideoIds = new Set<string>();

    for (const a of assignments) {
      if (a.video && (!activeOnly || a.video.active)) {
        seenVideoIds.add(a.video.id);
        resultList.push({
          id: a.video.id,
          assignmentId: a.id,
          storeId: a.storeId,
          productId: a.productId,
          videoId: a.videoId,
          bunnyVideoId: a.video.bunnyVideoId,
          title: a.video.title,
          description: a.video.description,
          position: a.position,
          durationSeconds: a.video.durationSeconds,
          fileSizeBytes: a.video.fileSizeBytes,
          thumbnailUrl: a.video.thumbnailUrl,
          status: a.video.status,
          active: a.video.active,
          createdAt: a.video.createdAt,
          updatedAt: a.video.updatedAt,
        });
      }
    }

    for (const v of legacyVideos) {
      if (!seenVideoIds.has(v.id)) {
        seenVideoIds.add(v.id);
        resultList.push({
          id: v.id,
          assignmentId: null,
          storeId: v.storeId,
          productId: v.productId,
          videoId: v.id,
          bunnyVideoId: v.bunnyVideoId,
          title: v.title,
          description: v.description,
          position: v.position,
          durationSeconds: v.durationSeconds,
          fileSizeBytes: v.fileSizeBytes,
          thumbnailUrl: v.thumbnailUrl,
          status: v.status,
          active: v.active,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        });
      }
    }

    resultList.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return resultList;
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
        ? 4096
        : Number(sizeEntitlement.value) || 4096;
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

    // Multi-tenant Product Validation (only if productId is a real UUID, not "pending" or "library")
    const isPending = productId === "pending";
    const isLibrary = !productId || productId === "library";
    const isRealProduct = !isPending && !isLibrary;

    if (isRealProduct) {
      const targetProduct = await db.query.products.findFirst({
        where: and(eq(products.id, productId!), eq(products.storeId, storeId)),
      });
      if (!targetProduct) {
        throw new Error("O produto selecionado é inválido ou não pertence a esta loja.");
      }
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
    let nextPosition = 0;
    if (isRealProduct) {
      const currentVideos = await this.listProductVideos(storeId, productId!);
      nextPosition = currentVideos.length > 0 ? Math.max(...currentVideos.map((v) => v.position)) + 1 : 0;
    }

    // 3. Register Product Video metadata in Neon DB (skip DB insert if isPending)
    let videoRecord: any;
    if (!isPending) {
      const targetProductId = isRealProduct ? productId! : null;
      try {
        const inserted = await db
          .insert(productVideos)
          .values({
            storeId,
            productId: targetProductId,
            bunnyVideoId: bunnyVideo.videoId,
            title: title.trim(),
            description: description?.trim() || null,
            position: nextPosition,
            fileSizeBytes: fileSize ? Number(fileSize) : null,
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
    } else {
      videoRecord = {
        id: `pending_${bunnyVideo.videoId}`,
        storeId,
        productId: "pending",
        bunnyVideoId: bunnyVideo.videoId,
        title: title.trim(),
        description: description?.trim() || null,
        position: 0,
        status: "UPLOADING",
        active: true,
        createdAt: new Date().toISOString(),
      };
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
   * Attach pending videos to a newly created product ID.
   */
  static async attachPendingVideos(
    sellerId: string,
    storeId: string,
    productId: string,
    pendingVideos: Array<{
      bunnyVideoId: string;
      title: string;
      description?: string | null;
      position?: number;
    }>
  ) {
    if (!pendingVideos || pendingVideos.length === 0) return [];

    const targetProduct = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!targetProduct) {
      throw new Error("Produto não encontrado para associação de vídeos.");
    }

    const insertedRecords = [];
    for (let idx = 0; idx < pendingVideos.length; idx++) {
      const item = pendingVideos[idx];
      const [inserted] = await db
        .insert(productVideos)
        .values({
          storeId,
          productId,
          bunnyVideoId: item.bunnyVideoId,
          title: item.title.trim(),
          description: item.description?.trim() || null,
          position: item.position !== undefined ? item.position : idx,
          status: "UPLOADING",
          active: true,
        })
        .returning();
      insertedRecords.push(inserted);
    }

    return insertedRecords;
  }

  /**
   * Cleanup pending Bunny videos and storage reservations if product creation is cancelled.
   */
  static async cleanupPendingVideos(
    sellerId: string,
    storeId: string,
    pendingBunnyVideoIds: string[]
  ) {
    if (!pendingBunnyVideoIds || pendingBunnyVideoIds.length === 0) return { success: true };

    for (const bunnyVideoId of pendingBunnyVideoIds) {
      if (!bunnyVideoId) continue;
      let bunnySuccess = false;
      try {
        bunnySuccess = await BunnyStreamService.deleteVideo(bunnyVideoId);
      } catch (err: any) {
        console.warn("[ProductVideoService] Cleanup Bunny video failed:", err.message);
      }

      if (!bunnySuccess) {
        await db.insert(pendingDeletions).values({
          storeId,
          provider: "bunny_stream",
          path: bunnyVideoId,
          resourceId: bunnyVideoId,
        });
      }

      await StorageUsageService.releaseReservationByReference("product_video_upload", bunnyVideoId);
    }

    return { success: true };
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
   * Assigns videos from seller library to a product via product_video_assignments.
   * Enforces multi-tenant security, entitlement (product_videos_enabled, max_product_videos), and READY status requirement.
   */
  static async assignVideosToProduct(
    storeId: string,
    productId: string,
    videoIds: string[],
    sellerId?: string
  ) {
    if (!videoIds || videoIds.length === 0) return await this.listProductVideos(storeId, productId);

    // 1. Multi-tenant Product Check
    const targetProduct = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!targetProduct) {
      throw new Error("Produto não encontrado ou sem permissão nesta loja.");
    }

    // 2. Entitlement Check
    if (sellerId) {
      const isEnabled = await hasFeature(sellerId, "product_videos_enabled");
      if (!isEnabled) {
        throw new Error("A funcionalidade de Vídeos de Produtos não está ativa no seu plano.");
      }

      const currentVideos = await this.listProductVideos(storeId, productId);
      const newTotal = currentVideos.length + videoIds.length;
      const limitCheck = await checkLimit(sellerId, "max_product_videos", currentVideos.length);
      if (!limitCheck.allowed && limitCheck.limit !== null && newTotal > limitCheck.limit) {
        throw new Error(`Limite máximo de vídeos por produto atingido (${limitCheck.limit}).`);
      }
    }

    const existingList = await this.listProductVideos(storeId, productId);
    let maxPos = existingList.length > 0 ? Math.max(...existingList.map((v) => v.position || 0)) + 1 : 0;

    for (const vid of videoIds) {
      // 3. Multi-tenant Video & READY status check
      const video = await db.query.productVideos.findFirst({
        where: and(eq(productVideos.id, vid), eq(productVideos.storeId, storeId)),
      });

      if (!video) {
        throw new Error(`Vídeo não encontrado ou não pertence a esta loja.`);
      }

      if (video.status !== "READY") {
        throw new Error(`O vídeo "${video.title}" ainda está sendo processado e não pode ser vinculado ao produto.`);
      }

      // 4. Upsert Assignment
      await db
        .insert(productVideoAssignments)
        .values({
          storeId,
          productId,
          videoId: vid,
          position: maxPos++,
        })
        .onConflictDoNothing();
    }

    return await this.listProductVideos(storeId, productId);
  }

  /**
   * Removes a video assignment from a product (removes association ONLY, DOES NOT delete from library or Bunny).
   */
  static async removeVideoAssignment(storeId: string, productId: string, videoId: string) {
    const targetProduct = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!targetProduct) {
      throw new Error("Produto não encontrado ou sem permissão nesta loja.");
    }

    // 1. Remove assignment record
    await db
      .delete(productVideoAssignments)
      .where(
        and(
          eq(productVideoAssignments.storeId, storeId),
          eq(productVideoAssignments.productId, productId),
          eq(productVideoAssignments.videoId, videoId)
        )
      );

    // 2. Clear legacy productId if set on productVideos
    await db
      .update(productVideos)
      .set({ productId: null, updatedAt: new Date() })
      .where(
        and(
          eq(productVideos.id, videoId),
          eq(productVideos.storeId, storeId),
          eq(productVideos.productId, productId)
        )
      );

    return { success: true, removedVideoId: videoId };
  }

  /**
   * Reorders product videos by position.
   */
  static async reorderProductVideos(storeId: string, productId: string, orderedVideoIds: string[]) {
    const targetProduct = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!targetProduct) {
      throw new Error("Produto não encontrado ou sem permissão nesta loja.");
    }

    for (let index = 0; index < orderedVideoIds.length; index++) {
      const vid = orderedVideoIds[index];
      await db
        .update(productVideoAssignments)
        .set({ position: index, updatedAt: new Date() })
        .where(
          and(
            eq(productVideoAssignments.storeId, storeId),
            eq(productVideoAssignments.productId, productId),
            eq(productVideoAssignments.videoId, vid)
          )
        );

      await db
        .update(productVideos)
        .set({ position: index, updatedAt: new Date() })
        .where(
          and(
            eq(productVideos.id, vid),
            eq(productVideos.storeId, storeId),
            eq(productVideos.productId, productId)
          )
        );
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
   * Lists videos assigned to a product that the customer has active access to.
   */
  static async listCustomerProductVideos(storeId: string, customerId: string, productId: string) {
    const now = new Date();
    const accessRecord = await db.query.accesses.findFirst({
      where: and(
        eq(accesses.storeId, storeId),
        eq(accesses.customerId, customerId),
        eq(accesses.productId, productId),
        eq(accesses.status, "ACTIVE")
      ),
    });

    if (!accessRecord) {
      throw new Error("Você não possui acesso válido a este produto.");
    }

    if (accessRecord.expiresAt && new Date(accessRecord.expiresAt) < now) {
      throw new Error("Seu acesso a este produto expirou.");
    }

    const assignments = await db.query.productVideoAssignments.findMany({
      where: and(
        eq(productVideoAssignments.storeId, storeId),
        eq(productVideoAssignments.productId, productId)
      ),
      orderBy: [asc(productVideoAssignments.position)],
      with: {
        video: true,
      },
    });

    const legacyVideos = await db.query.productVideos.findMany({
      where: and(
        eq(productVideos.storeId, storeId),
        eq(productVideos.productId, productId),
        eq(productVideos.status, "READY"),
        eq(productVideos.active, true)
      ),
      orderBy: [asc(productVideos.position)],
    });

    const videoMap = new Map<string, { video: any; position: number }>();

    for (const assign of assignments) {
      if (assign.video && assign.video.status === "READY" && assign.video.active) {
        videoMap.set(assign.video.id, {
          video: assign.video,
          position: assign.position ?? assign.video.position ?? 0,
        });
      }
    }

    for (const leg of legacyVideos) {
      if (!videoMap.has(leg.id)) {
        videoMap.set(leg.id, {
          video: leg,
          position: leg.position ?? 0,
        });
      }
    }

    const sortedList = Array.from(videoMap.values()).sort((a, b) => a.position - b.position);

    const result = await Promise.all(
      sortedList.map(async ({ video, position }) => {
        const progress = await this.getVideoProgress(storeId, customerId, video.id);
        return {
          id: video.id,
          title: video.title,
          description: video.description,
          position,
          durationSeconds: video.durationSeconds || 0,
          thumbnailUrl: video.thumbnailUrl,
          progress: progress
            ? {
                positionSeconds: progress.positionSeconds,
                durationSeconds: progress.durationSeconds,
                progressPercent: Number(progress.progressPercent),
                completed: progress.completed,
                lastWatchedAt: progress.lastWatchedAt,
              }
            : null,
        };
      })
    );

    return result;
  }

  /**
   * Authorizes video playback for an authenticated Telegram customer after verifying active product access.
   */
  static async getProductVideoForPlayback(
    storeId: string,
    customerId: string,
    videoId: string,
    productId?: string,
    triggerToken?: string | null
  ) {
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

    if (video.status === "PROCESSING" || video.status === "UPLOADING") {
      throw new Error("Este vídeo ainda está em processamento e não pode ser reproduzido.");
    }

    if (video.status === "FAILED") {
      throw new Error("Falha no processamento do vídeo.");
    }

    if (video.status !== "READY") {
      throw new Error("Este vídeo não está disponível para reprodução.");
    }

    // Check Trigger Token if provided
    let isPublicTrigger = false;
    if (triggerToken) {
      const { VideoTriggerService } = await import("@/lib/videos/video-trigger-service");
      const resolvedTrigger = await VideoTriggerService.resolveTriggerToken(triggerToken);
      
      if (resolvedTrigger.video.id !== video.id) {
        throw new Error("O link de vídeo não corresponde ao vídeo solicitado.");
      }

      if (!resolvedTrigger.requiresAccess) {
        isPublicTrigger = true;
      }
    }

    // 2. Find associated product IDs for this video
    const assignments = await db.query.productVideoAssignments.findMany({
      where: and(
        eq(productVideoAssignments.storeId, storeId),
        eq(productVideoAssignments.videoId, video.id)
      ),
    });

    const associatedProductIds = new Set<string>();
    for (const a of assignments) {
      associatedProductIds.add(a.productId);
    }
    if (video.productId) {
      associatedProductIds.add(video.productId);
    }

    if (!isPublicTrigger && associatedProductIds.size === 0) {
      throw new Error("Vídeo sem produto vinculado.");
    }

    if (!isPublicTrigger && productId && !associatedProductIds.has(productId)) {
      throw new Error("Vídeo não está associado ao produto especificado.");
    }

    // 3. Server-side Access Authorization Check (Skipped if isPublicTrigger)
    let validAccessRecord = null;
    if (!isPublicTrigger) {
      const now = new Date();
      const candidateProductIds = productId ? [productId] : Array.from(associatedProductIds);

      let hasExpiredAccess = false;

      for (const pid of candidateProductIds) {
        const accessRecord = await db.query.accesses.findFirst({
          where: and(
            eq(accesses.storeId, storeId),
            eq(accesses.customerId, customerId),
            eq(accesses.productId, pid),
            eq(accesses.status, "ACTIVE")
          ),
        });

        if (accessRecord) {
          if (accessRecord.expiresAt && new Date(accessRecord.expiresAt) < now) {
            hasExpiredAccess = true;
          } else {
            validAccessRecord = accessRecord;
            break;
          }
        }
      }

      if (!validAccessRecord) {
        if (hasExpiredAccess) {
          throw new Error("Seu acesso a este produto expirou.");
        }
        throw new Error("Você não possui acesso válido a este produto.");
      }
    }

    // 4. Generate Temporary Bunny Playback Token Authorization
    const playbackAuth = generateBunnyPlaybackToken({
      videoId: video.bunnyVideoId,
      expiresInSeconds: 3600,
    });

    // 5. Load Customer Progress if exists
    const progress = await this.getVideoProgress(storeId, customerId, video.id);

    // 6. Build Server-Verified Watermark for Buyer Traceability
    let watermarkLabel = "";
    try {
      const customer = db.query?.telegramCustomers?.findFirst
        ? await db.query.telegramCustomers.findFirst({
            where: eq(telegramCustomers.id, customerId),
          })
        : null;

      if (customer?.username) {
        const cleanUsername = customer.username.trim();
        watermarkLabel = cleanUsername.startsWith("@") ? cleanUsername : `@${cleanUsername}`;
      } else if (customer?.firstName || customer?.lastName) {
        watermarkLabel = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
      } else {
        const cleanId = (validAccessRecord?.id || "access").replace(/-/g, "");
        watermarkLabel = `#WG${cleanId.slice(-6).toUpperCase()}`;
      }
    } catch {
      const cleanId = (validAccessRecord?.id || "access").replace(/-/g, "");
      watermarkLabel = `#WG${cleanId.slice(-6).toUpperCase()}`;
    }

    return {
      video: {
        id: video.id,
        storeId: video.storeId,
        productId: validAccessRecord?.productId || video.productId || "",
        productTitle: video.product?.title || "",
        productSlug: video.product?.slug || null,
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
      progress: progress
        ? {
            positionSeconds: progress.positionSeconds,
            durationSeconds: progress.durationSeconds,
            progressPercent: Number(progress.progressPercent),
            completed: progress.completed,
            lastWatchedAt: progress.lastWatchedAt,
          }
        : null,
      watermark: {
        brand: "WEBGRAN",
        label: watermarkLabel,
      },
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

  /**
   * List seller library videos for a store.
   */
  static async listSellerLibraryVideos(
    storeId: string,
    options?: { search?: string; statusFilter?: string }
  ) {
    const conditions = [eq(productVideos.storeId, storeId)];

    if (options?.search && options.search.trim()) {
      conditions.push(ilike(productVideos.title, `%${options.search.trim()}%`));
    }

    if (options?.statusFilter && options.statusFilter !== "ALL") {
      conditions.push(eq(productVideos.status, options.statusFilter));
    }

    const videos = await db.query.productVideos.findMany({
      where: and(...conditions),
      orderBy: [desc(productVideos.createdAt)],
      with: {
        assignments: {
          with: {
            product: true,
          },
        },
        product: true,
      },
    });

    // Auto-sync pending videos (UPLOADING or PROCESSING) directly with Bunny Stream API
    const pendingVideos = videos.filter(
      (v) => v.status === "UPLOADING" || v.status === "PROCESSING"
    );

    if (pendingVideos.length > 0) {
      await Promise.all(
        pendingVideos.map(async (v) => {
          try {
            const bunnyInfo = await BunnyStreamService.getVideo(v.bunnyVideoId);
            if (!bunnyInfo) return;

            let newStatus = v.status;
            let durationSeconds = v.durationSeconds;
            let thumbnailUrl = v.thumbnailUrl;
            let fileSizeBytes = v.fileSizeBytes;

            const resolvedStatus = resolveClipStatusTransition(bunnyInfo.status, v.status as ClipStatus);
            newStatus = resolvedStatus;

            if (resolvedStatus === "READY") {
              durationSeconds = bunnyInfo.length ? Math.round(bunnyInfo.length) : v.durationSeconds;
              thumbnailUrl = BunnyStreamService.getThumbnailUrl(
                v.bunnyVideoId,
                bunnyInfo.thumbnailFileName
              );
              const info = bunnyInfo as any;
              if (info.storageSize || info.size) {
                fileSizeBytes = Number(info.storageSize || info.size);
              }
            }

            if (
              newStatus !== v.status ||
              durationSeconds !== v.durationSeconds ||
              thumbnailUrl !== v.thumbnailUrl ||
              fileSizeBytes !== v.fileSizeBytes
            ) {
              v.status = newStatus;
              v.durationSeconds = durationSeconds;
              v.thumbnailUrl = thumbnailUrl;
              if (fileSizeBytes) v.fileSizeBytes = fileSizeBytes;

              await db
                .update(productVideos)
                .set({
                  status: newStatus,
                  durationSeconds,
                  thumbnailUrl,
                  fileSizeBytes: fileSizeBytes || undefined,
                  updatedAt: new Date(),
                })
                .where(eq(productVideos.id, v.id));

              if (newStatus === "READY") {
                const actualBytes =
                  fileSizeBytes ||
                  (durationSeconds ? durationSeconds * 200 * 1024 : 10 * 1024 * 1024);
                await StorageUsageService.confirmReservationByReference(
                  "product_video_upload",
                  v.bunnyVideoId,
                  actualBytes
                );
              } else if (newStatus === "FAILED") {
                await StorageUsageService.releaseReservationByReference(
                  "product_video_upload",
                  v.bunnyVideoId
                );
              }
            }
          } catch (syncErr) {
            // Ignore temporary API fetch errors gracefully during polling
          }
        })
      );
    }

    return videos.map((v) => {
      const productMap = new Map<string, { id: string; title: string; slug: string }>();
      if (v.product) {
        productMap.set(v.product.id, { id: v.product.id, title: v.product.title, slug: v.product.slug });
      }
      if (v.assignments && v.assignments.length > 0) {
        for (const a of v.assignments) {
          if (a.product) {
            productMap.set(a.product.id, { id: a.product.id, title: a.product.title, slug: a.product.slug });
          }
        }
      }

      const assignedProducts = Array.from(productMap.values());

      return {
        id: v.id,
        storeId: v.storeId,
        bunnyVideoId: v.bunnyVideoId,
        title: v.title,
        description: v.description,
        durationSeconds: v.durationSeconds || 0,
        fileSizeBytes: v.fileSizeBytes || 0,
        thumbnailUrl: v.thumbnailUrl,
        status: v.status,
        active: v.active,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        assignedProductsCount: assignedProducts.length,
        assignedProducts,
      };
    });
  }

  /**
   * Gets Video Storage Usage metrics for seller.
   */
  static async getSellerVideoStorageUsage(sellerId: string, storeId: string) {
    const entitlement = await getSellerEntitlement(sellerId, "video_storage_quota_gb");
    const isUnlimited = entitlement.source === "ADMIN_EXEMPT" || entitlement.isUnlimited || entitlement.value === -1;
    const hasVideoSubscription = entitlement.source === "ADMIN_EXEMPT" || entitlement.source === "PLAN" || entitlement.source === "OVERRIDE";
    const quotaGb = isUnlimited ? null : (typeof entitlement.value === "number" ? entitlement.value : (entitlement.value !== null && entitlement.value !== undefined && !isNaN(Number(entitlement.value)) ? Number(entitlement.value) : 0));
    const quotaBytes = (quotaGb === null || quotaGb === -1) ? null : Math.max(0, quotaGb * 1024 * 1024 * 1024);

    const [usedRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(${productVideos.fileSizeBytes}), 0)` })
      .from(productVideos)
      .where(
        and(
          eq(productVideos.storeId, storeId),
          ne(productVideos.status, "FAILED")
        )
      );

    const usedBytes = Number(usedRes?.total || 0);

    const [reservedRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(${storageReservations.requestedBytes}), 0)` })
      .from(storageReservations)
      .where(
        and(
          eq(storageReservations.sellerId, sellerId),
          eq(storageReservations.status, "ACTIVE"),
          gt(storageReservations.expiresAt, new Date()),
          eq(storageReservations.referenceType, "product_video_upload")
        )
      );

    const reservedBytes = Number(reservedRes?.total || 0);
    const totalCommittedBytes = usedBytes + reservedBytes;
    const remainingBytes = quotaBytes !== null ? Math.max(0, quotaBytes - totalCommittedBytes) : null;
    const percentUsed = quotaBytes !== null && quotaBytes > 0 ? Math.min(100, (totalCommittedBytes / quotaBytes) * 100) : 0;

    const videos = await db.query.productVideos.findMany({
      where: eq(productVideos.storeId, storeId),
    });

    const totalVideosCount = videos.length;
    const readyCount = videos.filter((v) => v.status === "READY").length;
    const processingCount = videos.filter((v) => v.status === "PROCESSING" || v.status === "UPLOADING").length;
    const failedCount = videos.filter((v) => v.status === "FAILED").length;

    let planName: string | null = isUnlimited ? "ADMIN / ILIMITADO" : null;
    let planPriceCents: number | null = null;

    if (!isUnlimited) {
      try {
        const videoSub = await db.query.videoLibrarySubscriptions.findFirst({
          where: and(
            eq(videoLibrarySubscriptions.sellerId, sellerId),
            eq(videoLibrarySubscriptions.status, "ACTIVE")
          ),
          with: { plan: true },
          orderBy: [desc(videoLibrarySubscriptions.createdAt)],
        });
        if (videoSub && videoSub.plan) {
          planName = videoSub.plan.name;
          planPriceCents = Math.round(Number(videoSub.plan.price || 0) * 100);
        }
      } catch (subErr) {
        console.warn("Error fetching video plan details:", subErr);
      }
    }

    return {
      sellerId,
      storeId,
      usedBytes,
      reservedBytes,
      totalCommittedBytes,
      quotaBytes,
      quotaGb,
      remainingBytes,
      percentUsed: Number(percentUsed.toFixed(1)),
      isUnlimited,
      hasVideoSubscription,
      planName,
      planPriceCents,
      totalVideosCount,
      readyCount,
      processingCount,
      failedCount,
    };
  }

  /**
   * Authorizes video playback preview for seller library.
   */
  static async getLibraryVideoForPreview(storeId: string, videoId: string) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.storeId, storeId)
      ),
    });

    if (!video) {
      throw new Error("Vídeo não encontrado ou sem permissão de acesso.");
    }

    const playbackAuth = generateBunnyPlaybackToken({
      videoId: video.bunnyVideoId,
      expiresInSeconds: 3600,
    });

    return {
      video: {
        id: video.id,
        storeId: video.storeId,
        title: video.title,
        description: video.description,
        durationSeconds: video.durationSeconds || 0,
        thumbnailUrl: video.thumbnailUrl,
        status: video.status,
      },
      playback: {
        playbackUrl: playbackAuth.playbackUrl,
        directUrl: playbackAuth.directUrl,
        expiresAt: playbackAuth.expiresAt,
      },
    };
  }

  /**
   * Updates title or description of a seller library video.
   */
  static async updateLibraryVideo(
    storeId: string,
    videoId: string,
    options: UpdateProductVideoOptions
  ) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.storeId, storeId)
      ),
    });

    if (!video) {
      throw new Error("Vídeo não encontrado ou sem permissão de acesso.");
    }

    const payload: any = { updatedAt: new Date() };
    if (options.title !== undefined) payload.title = options.title.trim();
    if (options.description !== undefined) payload.description = options.description?.trim() || null;
    if (options.active !== undefined) payload.active = Boolean(options.active);

    const [updated] = await db
      .update(productVideos)
      .set(payload)
      .where(eq(productVideos.id, videoId))
      .returning();

    return updated;
  }

  /**
   * Deletes a video from seller library safely, checking for product assignments first.
   */
  static async deleteLibraryVideo(storeId: string, videoId: string, force = false) {
    const video = await db.query.productVideos.findFirst({
      where: and(
        eq(productVideos.id, videoId),
        eq(productVideos.storeId, storeId)
      ),
      with: {
        assignments: {
          with: { product: true },
        },
        product: true,
      },
    });

    if (!video) {
      throw new Error("Vídeo não encontrado ou sem permissão de acesso.");
    }

    const productMap = new Map<string, { id: string; title: string; slug: string }>();
    if (video.product) {
      productMap.set(video.product.id, { id: video.product.id, title: video.product.title, slug: video.product.slug });
    }
    if (video.assignments && video.assignments.length > 0) {
      for (const a of video.assignments) {
        if (a.product) {
          productMap.set(a.product.id, { id: a.product.id, title: a.product.title, slug: a.product.slug });
        }
      }
    }
    const assignedProducts = Array.from(productMap.values());

    if (assignedProducts.length > 0 && !force) {
      return {
        success: false,
        isAssigned: true,
        assignedCount: assignedProducts.length,
        products: assignedProducts,
        message: `Este vídeo está vinculado a ${assignedProducts.length} produto(s).`,
      };
    }

    const bunnyVideoId = video.bunnyVideoId;

    await db.delete(productVideoAssignments).where(eq(productVideoAssignments.videoId, videoId));
    await db.delete(productVideos).where(eq(productVideos.id, videoId));

    let bunnySuccess = false;
    try {
      bunnySuccess = await BunnyStreamService.deleteVideo(bunnyVideoId);
    } catch (err: any) {
      console.warn("[ProductVideoService] Bunny Stream delete API failed, enqueuing pending_deletion:", err.message);
    }

    if (!bunnySuccess) {
      await db.insert(pendingDeletions).values({
        storeId,
        provider: "bunny_stream",
        path: bunnyVideoId,
        resourceId: bunnyVideoId,
      });
    }

    await StorageUsageService.releaseReservationByReference("product_video_upload", bunnyVideoId);

    return { success: true, deletedVideoId: videoId };
  }
}
