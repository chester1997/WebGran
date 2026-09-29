import { db } from "@/db";
import { clips } from "@/db/schema";
import { eq, and, asc, desc, max, inArray } from "drizzle-orm";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { resolveClipStatusTransition, ClipStatus } from "@/lib/bunny/webhook-utils";

export interface CreateClipInput {
  storeId: string;
  title: string;
  description?: string | null;
  bunnyVideoId: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  position?: number;
  productId?: string | null;
}

export class ClipService {
  /**
   * Registers a new Clip metadata record in Neon database with auto-calculated position.
   */
  static async createClip(input: CreateClipInput) {
    const thumbnailUrl = input.thumbnailUrl || BunnyStreamService.getThumbnailUrl(input.bunnyVideoId);

    // Calculate next available position in store
    let nextPosition = input.position;
    if (nextPosition === undefined) {
      const [maxPosResult] = await db
        .select({ maxPos: max(clips.position) })
        .from(clips)
        .where(eq(clips.storeId, input.storeId));
      nextPosition = (maxPosResult?.maxPos ?? -1) + 1;
    }

    const [inserted] = await db
      .insert(clips)
      .values({
        storeId: input.storeId,
        productId: input.productId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        bunnyVideoId: input.bunnyVideoId,
        thumbnailUrl,
        duration: input.duration || null,
        status: "UPLOADING",
        position: nextPosition,
        isActive: true,
      })
      .returning();

    return inserted;
  }

  /**
   * Finds a clip by Bunny Video ID (used by Webhook).
   */
  static async getClipByBunnyVideoId(bunnyVideoId: string) {
    return await db.query.clips.findFirst({
      where: eq(clips.bunnyVideoId, bunnyVideoId),
      with: { product: true },
    });
  }

  /**
   * Finds a clip by ID scoped strictly to a specific store (Multi-tenant check).
   */
  static async getClipById(clipId: string, storeId: string) {
    return await db.query.clips.findFirst({
      where: and(eq(clips.id, clipId), eq(clips.storeId, storeId)),
      with: { product: true },
    });
  }

  /**
   * Updates clip status and optional metadata in Neon by bunnyVideoId (Idempotent).
   */
  static async updateClipStatusByBunnyId(
    bunnyVideoId: string,
    status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED",
    metadata?: { duration?: number; thumbnailUrl?: string }
  ) {
    const existing = await this.getClipByBunnyVideoId(bunnyVideoId);
    if (!existing) {
      console.warn("[ClipService] Clip not found for bunnyVideoId:", bunnyVideoId);
      return null;
    }

    // Idempotency: skip update if status and metadata are unchanged
    const newThumbnail = metadata?.thumbnailUrl || existing.thumbnailUrl || BunnyStreamService.getThumbnailUrl(bunnyVideoId);
    const newDuration = metadata?.duration ?? existing.duration;

    if (
      existing.status === status &&
      existing.thumbnailUrl === newThumbnail &&
      existing.duration === newDuration
    ) {
      return existing;
    }

    const [updated] = await db
      .update(clips)
      .set({
        status,
        ...(newThumbnail ? { thumbnailUrl: newThumbnail } : {}),
        ...(newDuration !== undefined ? { duration: newDuration } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clips.id, existing.id))
      .returning();

    return updated;
  }

  /**
   * Synchronizes status of any pending clips (UPLOADING or PROCESSING) with Bunny Stream API.
   * Ensures self-healing status updates without hardcoded IDs.
   */
  static async syncPendingClipsForStore(storeId: string) {
    try {
      const pendingClips = await db.query.clips.findMany({
        where: and(
          eq(clips.storeId, storeId),
          inArray(clips.status, ["UPLOADING", "PROCESSING"])
        ),
      });

      if (!pendingClips || pendingClips.length === 0) return;

      for (const clip of pendingClips) {
        try {
          const videoDetails = await BunnyStreamService.getVideo(clip.bunnyVideoId);
          if (!videoDetails) continue;

          const targetStatus = resolveClipStatusTransition(
            videoDetails.status,
            clip.status as ClipStatus
          );

          let duration: number | undefined = undefined;
          let thumbnailUrl: string | undefined = undefined;

          if (targetStatus === "READY") {
            if (typeof videoDetails.length === "number" && videoDetails.length > 0) {
              duration = Math.round(videoDetails.length);
            }
            if (videoDetails.thumbnailFileName) {
              thumbnailUrl = BunnyStreamService.getThumbnailUrl(
                clip.bunnyVideoId,
                videoDetails.thumbnailFileName
              );
            }
          }

          if (targetStatus !== clip.status || duration !== undefined || thumbnailUrl !== undefined) {
            await this.updateClipStatusByBunnyId(clip.bunnyVideoId, targetStatus, {
              duration,
              thumbnailUrl,
            });
          }
        } catch (err) {
          console.error("[ClipService] Auto-sync error for clip:", clip.bunnyVideoId, err);
        }
      }
    } catch (err) {
      console.error("[ClipService] Failed to sync pending clips:", err);
    }
  }

  /**
   * Lists all clips for a store, auto-syncing pending clips with Bunny Stream API.
   */
  static async listStoreClips(storeId: string) {
    await this.syncPendingClipsForStore(storeId);

    return await db.query.clips.findMany({
      where: eq(clips.storeId, storeId),
      orderBy: [asc(clips.position), desc(clips.createdAt)],
      with: { product: true },
    });
  }

  /**
   * Deletes a clip from database and removes associated video from Bunny Stream.
   */
  static async deleteClip(clipId: string, storeId: string) {
    const clip = await this.getClipById(clipId, storeId);
    if (!clip) return false;

    // Delete video from Bunny Stream library
    try {
      await BunnyStreamService.deleteVideo(clip.bunnyVideoId);
    } catch (err) {
      console.error("[ClipService] Failed to delete video from Bunny Stream:", err);
    }

    // Delete record from Neon
    await db.delete(clips).where(eq(clips.id, clip.id));
    return true;
  }
}
