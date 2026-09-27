import { db } from "@/db";
import { clips } from "@/db/schema";
import { eq, and, asc, desc, max } from "drizzle-orm";
import { BunnyStreamService } from "@/lib/bunny/stream";

export interface CreateClipInput {
  storeId: string;
  title: string;
  description?: string | null;
  bunnyVideoId: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  position?: number;
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
    });
  }

  /**
   * Finds a clip by ID scoped strictly to a specific store (Multi-tenant check).
   */
  static async getClipById(clipId: string, storeId: string) {
    return await db.query.clips.findFirst({
      where: and(eq(clips.id, clipId), eq(clips.storeId, storeId)),
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
   * Lists all clips for a store.
   */
  static async listStoreClips(storeId: string) {
    return await db.query.clips.findMany({
      where: eq(clips.storeId, storeId),
      orderBy: [asc(clips.position), desc(clips.createdAt)],
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
