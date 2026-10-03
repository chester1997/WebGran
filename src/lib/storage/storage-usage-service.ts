import { db } from "@/db";
import { 
  sellerStorageUsage, 
  storageReservations, 
  users, 
  stores, 
  products, 
  categories, 
  banners, 
  clips 
} from "@/db/schema";
import { eq, and, sql, lt, inArray } from "drizzle-orm";
import { getSellerEntitlement } from "@/lib/entitlements/entitlement-service";

export const GB_IN_BYTES = 1024 * 1024 * 1024; // 1 GB = 1,073,741,824 bytes

export interface StorageUsageSummary {
  sellerId: string;
  usedBytes: number;
  reservedBytes: number;
  totalCommittedBytes: number;
  quotaBytes: number | null; // null if unlimited (-1)
  remainingBytes: number | null; // null if unlimited (-1)
  isUnlimited: boolean;
  source: string;
}

export interface ReservationResult {
  allowed: boolean;
  code?: string;
  usedBytes: number;
  reservedBytes: number;
  requestedBytes: number;
  quotaBytes: number | null;
  remainingBytes: number | null;
  isUnlimited: boolean;
  reservationId?: string;
  reason?: string;
}

export class StorageUsageService {
  /**
   * Resolves effective storage quota in bytes from EntitlementService
   */
  static async getQuotaBytes(sellerId: string): Promise<{ quotaBytes: number | null; isUnlimited: boolean; source: string }> {
    const entitlement = await getSellerEntitlement(sellerId, "storage_quota_gb");

    if (entitlement.source === "ADMIN_EXEMPT" || entitlement.isUnlimited || entitlement.value === -1) {
      return { quotaBytes: null, isUnlimited: true, source: entitlement.source };
    }

    const quotaGb = typeof entitlement.value === "number" ? entitlement.value : Number(entitlement.value) || 0;
    if (quotaGb === -1) {
      return { quotaBytes: null, isUnlimited: true, source: entitlement.source };
    }

    const quotaBytes = Math.max(0, quotaGb * GB_IN_BYTES);
    return { quotaBytes, isUnlimited: false, source: entitlement.source };
  }

  /**
   * Returns current storage usage summary for seller
   */
  static async getUsage(sellerId: string): Promise<StorageUsageSummary> {
    const row = await db.query.sellerStorageUsage.findFirst({
      where: eq(sellerStorageUsage.sellerId, sellerId),
    });

    const usedBytes = row?.usedBytes ?? 0;
    const reservedBytes = row?.reservedBytes ?? 0;
    const totalCommittedBytes = usedBytes + reservedBytes;

    const quotaInfo = await this.getQuotaBytes(sellerId);

    let remainingBytes: number | null = null;
    if (!quotaInfo.isUnlimited && quotaInfo.quotaBytes !== null) {
      remainingBytes = Math.max(0, quotaInfo.quotaBytes - totalCommittedBytes);
    }

    return {
      sellerId,
      usedBytes,
      reservedBytes,
      totalCommittedBytes,
      quotaBytes: quotaInfo.quotaBytes,
      remainingBytes,
      isUnlimited: quotaInfo.isUnlimited,
      source: quotaInfo.source,
    };
  }

  static async getUsedBytes(sellerId: string): Promise<number> {
    const usage = await this.getUsage(sellerId);
    return usage.usedBytes;
  }

  static async getReservedBytes(sellerId: string): Promise<number> {
    const usage = await this.getUsage(sellerId);
    return usage.reservedBytes;
  }

  static async getTotalCommittedBytes(sellerId: string): Promise<number> {
    const usage = await this.getUsage(sellerId);
    return usage.totalCommittedBytes;
  }

  /**
   * Increments usedBytes atomically
   */
  static async incrementUsedBytes(sellerId: string, bytes: number): Promise<void> {
    if (bytes <= 0) return;

    await db.execute(sql`
      INSERT INTO seller_storage_usage (seller_id, used_bytes, reserved_bytes, updated_at)
      VALUES (${sellerId}, ${bytes}, 0, NOW())
      ON CONFLICT (seller_id) DO UPDATE
      SET used_bytes = seller_storage_usage.used_bytes + ${bytes},
          updated_at = NOW()
    `);
  }

  /**
   * Decrements usedBytes atomically
   */
  static async decrementUsedBytes(sellerId: string, bytes: number): Promise<void> {
    if (bytes <= 0) return;

    await db.execute(sql`
      UPDATE seller_storage_usage
      SET used_bytes = GREATEST(0, used_bytes - ${bytes}),
          updated_at = NOW()
      WHERE seller_id = ${sellerId}
    `);
  }

  /**
   * Resolves effective video storage quota in bytes from EntitlementService (video_storage_quota_gb)
   */
  static async getVideoQuotaBytes(sellerId: string): Promise<{ quotaBytes: number | null; isUnlimited: boolean; source: string }> {
    const entitlement = await getSellerEntitlement(sellerId, "video_storage_quota_gb");

    if (entitlement.source === "ADMIN_EXEMPT" || entitlement.isUnlimited || entitlement.value === -1) {
      return { quotaBytes: null, isUnlimited: true, source: entitlement.source };
    }

    const quotaGb = typeof entitlement.value === "number" ? entitlement.value : Number(entitlement.value) || 50;
    if (quotaGb === -1) {
      return { quotaBytes: null, isUnlimited: true, source: entitlement.source };
    }

    const quotaBytes = Math.max(0, quotaGb * GB_IN_BYTES);
    return { quotaBytes, isUnlimited: false, source: entitlement.source };
  }

  /**
   * Reserves storage for upload using atomic SQL update to prevent race conditions
   */
  static async reserveStorageForUpload(params: {
    sellerId: string;
    storeId?: string;
    bytes: number;
    referenceType: "clip_upload" | "image_upload" | "generic" | "product_video_upload";
    referenceId?: string;
    expirationMinutes?: number;
  }): Promise<ReservationResult> {
    const { sellerId, storeId, bytes, referenceType, referenceId } = params;
    const requestedBytes = Math.max(0, Math.round(bytes));

    const quotaInfo = referenceType === "product_video_upload"
      ? await this.getVideoQuotaBytes(sellerId)
      : await this.getQuotaBytes(sellerId);
    const expirationMinutes = params.expirationMinutes || 60;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Ensure usage row exists first
    await db.execute(sql`
      INSERT INTO seller_storage_usage (seller_id, used_bytes, reserved_bytes, updated_at)
      VALUES (${sellerId}, 0, 0, NOW())
      ON CONFLICT (seller_id) DO NOTHING
    `);

    if (quotaInfo.isUnlimited || quotaInfo.quotaBytes === null) {
      // Unlimited quota -> reserve without capacity check
      await db.execute(sql`
        UPDATE seller_storage_usage
        SET reserved_bytes = reserved_bytes + ${requestedBytes},
            updated_at = NOW()
        WHERE seller_id = ${sellerId}
      `);

      const [reservation] = await db
        .insert(storageReservations)
        .values({
          sellerId,
          storeId: storeId || null,
          referenceType,
          referenceId: referenceId || null,
          requestedBytes,
          status: "ACTIVE",
          expiresAt,
        })
        .returning();

      const usage = await this.getUsage(sellerId);
      return {
        allowed: true,
        usedBytes: usage.usedBytes,
        reservedBytes: usage.reservedBytes,
        requestedBytes,
        quotaBytes: null,
        remainingBytes: null,
        isUnlimited: true,
        reservationId: reservation.id,
      };
    }

    // Finite quota -> Atomic reservation update
    const updateResult = await db.execute(sql`
      UPDATE seller_storage_usage
      SET reserved_bytes = reserved_bytes + ${requestedBytes},
          updated_at = NOW()
      WHERE seller_id = ${sellerId}
        AND (used_bytes + reserved_bytes + ${requestedBytes}) <= ${quotaInfo.quotaBytes}
      RETURNING seller_id
    `);

    let updated = false;
    if (Array.isArray(updateResult)) {
      updated = updateResult.length > 0;
    } else if (Array.isArray((updateResult as any)?.rows)) {
      updated = (updateResult as any).rows.length > 0;
    } else {
      const rowCount = Number(
        (updateResult as any)?.rowCount ?? (updateResult as any)?.affectedRows ?? 0
      );
      updated = rowCount > 0;
    }

    if (updated) {
      const currentUsage = await this.getUsage(sellerId);
      const [reservation] = await db
        .insert(storageReservations)
        .values({
          sellerId,
          storeId: storeId || null,
          referenceType,
          referenceId: referenceId || null,
          requestedBytes,
          status: "ACTIVE",
          expiresAt,
        })
        .returning();

      return {
        allowed: true,
        usedBytes: currentUsage.usedBytes,
        reservedBytes: currentUsage.reservedBytes,
        requestedBytes,
        quotaBytes: quotaInfo.quotaBytes,
        remainingBytes: currentUsage.remainingBytes,
        isUnlimited: false,
        reservationId: reservation.id,
      };
    }

    const currentUsage = await this.getUsage(sellerId);

    return {
      allowed: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      usedBytes: currentUsage.usedBytes,
      reservedBytes: currentUsage.reservedBytes,
      requestedBytes,
      quotaBytes: quotaInfo.quotaBytes,
      remainingBytes: currentUsage.remainingBytes,
      isUnlimited: false,
      reason: `Capacidade de armazenamento insuficiente. Quota: ${(quotaInfo.quotaBytes / GB_IN_BYTES).toFixed(1)}GB.`,
    };
  }

  /**
   * Confirms active reservation, moving reservedBytes to usedBytes (handling under/over differences)
   * Supports both positional args (reservationId, actualBytes) and object arg ({ reservationId, actualBytes }).
   */
  static async confirmReservation(
    reservationIdOrParams?: string | { reservationId: string; actualBytes?: number },
    actualBytesArg?: number
  ): Promise<boolean> {
    if (!reservationIdOrParams) return false;
    const reservationId = typeof reservationIdOrParams === "string" ? reservationIdOrParams : reservationIdOrParams.reservationId;
    const actualBytes = typeof reservationIdOrParams === "string" ? actualBytesArg : reservationIdOrParams.actualBytes;

    const reservation = await db.query.storageReservations.findFirst({
      where: eq(storageReservations.id, reservationId),
    });

    if (!reservation || reservation.status !== "ACTIVE") {
      return false; // Idempotent: already confirmed or released
    }

    const finalBytes = actualBytes !== undefined ? Math.max(0, actualBytes) : reservation.requestedBytes;
    const reservedToRelease = reservation.requestedBytes;

    // Atomic update on usage
    await db.execute(sql`
      UPDATE seller_storage_usage
      SET used_bytes = GREATEST(0, used_bytes + ${finalBytes}),
          reserved_bytes = GREATEST(0, reserved_bytes - ${reservedToRelease}),
          updated_at = NOW()
      WHERE seller_id = ${reservation.sellerId}
    `);

    // Update reservation record status
    await db
      .update(storageReservations)
      .set({
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(eq(storageReservations.id, reservationId));

    return true;
  }

  /**
   * Releases an active reservation without increasing usedBytes (Idempotent)
   */
  static async releaseReservation(reservationId: string): Promise<boolean> {
    const reservation = await db.query.storageReservations.findFirst({
      where: eq(storageReservations.id, reservationId),
    });

    if (!reservation || reservation.status !== "ACTIVE") {
      return false; // Idempotent
    }

    await db.execute(sql`
      UPDATE seller_storage_usage
      SET reserved_bytes = GREATEST(0, reserved_bytes - ${reservation.requestedBytes}),
          updated_at = NOW()
      WHERE seller_id = ${reservation.sellerId}
    `);

    await db
      .update(storageReservations)
      .set({
        status: "RELEASED",
        updatedAt: new Date(),
      })
      .where(eq(storageReservations.id, reservationId));

    return true;
  }

  /**
   * Confirms reservation using referenceType and referenceId (Idempotent)
   */
  static async confirmReservationByReference(
    referenceType: "clip_upload" | "image_upload" | "generic" | "product_video_upload",
    referenceId: string,
    actualBytes: number
  ): Promise<boolean> {
    const reservation = await db.query.storageReservations.findFirst({
      where: and(
        eq(storageReservations.referenceType, referenceType),
        eq(storageReservations.referenceId, referenceId),
        eq(storageReservations.status, "ACTIVE")
      ),
    });

    if (!reservation) return false;
    return this.confirmReservation(reservation.id, actualBytes);
  }

  /**
   * Releases reservation using referenceType and referenceId (Idempotent)
   */
  static async releaseReservationByReference(
    referenceType: "clip_upload" | "image_upload" | "generic" | "product_video_upload",
    referenceId: string
  ): Promise<boolean> {
    const reservation = await db.query.storageReservations.findFirst({
      where: and(
        eq(storageReservations.referenceType, referenceType),
        eq(storageReservations.referenceId, referenceId),
        eq(storageReservations.status, "ACTIVE")
      ),
    });

    if (!reservation) return false;
    return this.releaseReservation(reservation.id);
  }

  /**
   * Expires abandoned reservations older than expiresAt.
   * Extends active processing clip reservations so valid uploads are not prematurely expired.
   */
  static async expireAbandonedReservations(): Promise<number> {
    const now = new Date();

    const expiredItems = await db.query.storageReservations.findMany({
      where: and(
        eq(storageReservations.status, "ACTIVE"),
        lt(storageReservations.expiresAt, now)
      ),
    });

    let count = 0;
    for (const item of expiredItems) {
      // If it's a clip upload and clip is actively processing, extend expiresAt instead of expiring
      if (item.referenceType === "clip_upload" && item.referenceId) {
        const clip = await db.query.clips.findFirst({
          where: eq(clips.bunnyVideoId, item.referenceId),
        });
        if (clip && (clip.status === "UPLOADING" || clip.status === "PROCESSING")) {
          const newExpiresAt = new Date(Date.now() + 180 * 60 * 1000);
          await db
            .update(storageReservations)
            .set({ expiresAt: newExpiresAt, updatedAt: new Date() })
            .where(eq(storageReservations.id, item.id));
          continue;
        }
      }

      await this.releaseReservation(item.id);
      await db
        .update(storageReservations)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(eq(storageReservations.id, item.id));
      count++;
    }

    return count;
  }

  /**
   * Reconciles seller storage by querying actual active DB entities
   */
  static async reconcileSellerStorage(sellerId: string): Promise<StorageUsageSummary> {
    const sellerStores = await db.query.stores.findMany({
      where: eq(stores.ownerId, sellerId),
      columns: { id: true, logoUrl: true },
    });

    const storeIds = sellerStores.map(s => s.id);
    let calculatedUsedBytes = 0;

    if (storeIds.length > 0) {
      // 1. Clips
      const storeClips = await db.query.clips.findMany({
        where: inArray(clips.storeId, storeIds),
      });
      for (const clip of storeClips) {
        calculatedUsedBytes += Math.max(1024 * 1024, (clip.duration || 30) * 200 * 1024);
      }

      // 2. Product images
      const storeProducts = await db.query.products.findMany({
        where: inArray(products.storeId, storeIds),
        columns: { coverUrl: true, bannerUrl: true },
      });
      for (const prod of storeProducts) {
        if (prod.coverUrl) calculatedUsedBytes += 300 * 1024;
        if (prod.bannerUrl) calculatedUsedBytes += 300 * 1024;
      }

      // 3. Category images
      const storeCategories = await db.query.categories.findMany({
        where: inArray(categories.storeId, storeIds),
        columns: { imageUrl: true },
      });
      for (const cat of storeCategories) {
        if (cat.imageUrl) calculatedUsedBytes += 300 * 1024;
      }

      // 4. Banners
      const storeBanners = await db.query.banners.findMany({
        where: inArray(banners.storeId, storeIds),
        columns: { imageUrl: true },
      });
      for (const b of storeBanners) {
        if (b.imageUrl) calculatedUsedBytes += 300 * 1024;
      }

      // 5. Store logo
      for (const s of sellerStores) {
        if (s.logoUrl) calculatedUsedBytes += 300 * 1024;
      }
    }

    await db.execute(sql`
      INSERT INTO seller_storage_usage (seller_id, used_bytes, reserved_bytes, updated_at)
      VALUES (${sellerId}, ${calculatedUsedBytes}, 0, NOW())
      ON CONFLICT (seller_id) DO UPDATE
      SET used_bytes = ${calculatedUsedBytes},
          updated_at = NOW()
    `);

    return await this.getUsage(sellerId);
  }
}
