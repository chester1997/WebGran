import { NextResponse } from 'next/server';
import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { banners } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getStorageProvider, generateMultiTenantStoragePath } from '@/lib/storage/provider';
import { checkLimit } from '@/lib/entitlements/entitlement-service';
import { MediaLifecycleService } from '@/lib/storage/lifecycle-service';
import { StorageUsageService } from '@/lib/storage/storage-usage-service';

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();
    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 400 });
    }

    const body = await req.json();
    const { title, imageUrl, linkType, linkValue, id } = body;

    if (!imageUrl || !imageUrl.trim()) {
      return NextResponse.json({ success: false, error: "A imagem do banner é obrigatória." }, { status: 400 });
    }

    let finalImageUrl = imageUrl.trim();

    // If a raw Data URL / Base64 is received for a new/edited banner, upload it via Storage Provider
    if (finalImageUrl.startsWith("data:")) {
      try {
        const parts = finalImageUrl.split(",");
        const meta = parts[0];
        const base64Data = parts[1] || "";
        const matchMime = meta.match(/data:(.*?);/);
        const mimeType = matchMime ? matchMime[1] : "image/webp";
        const buffer = Buffer.from(base64Data, "base64");
        const actualBytes = buffer.length;

        const reservation = await StorageUsageService.reserveStorageForUpload({
          sellerId: seller.id,
          storeId: store.id,
          bytes: actualBytes,
          referenceType: "image_upload",
        });

        if (!reservation.allowed) {
          return NextResponse.json(
            { success: false, code: "STORAGE_QUOTA_EXCEEDED", error: reservation.reason },
            { status: 403 }
          );
        }

        const storagePath = generateMultiTenantStoragePath(store.id, "banners", `banner-${Date.now()}.webp`);
        const provider = getStorageProvider();
        try {
          const uploadRes = await provider.upload(buffer, storagePath, mimeType);
          if (reservation.reservationId) {
            await StorageUsageService.confirmReservation(reservation.reservationId, uploadRes.sizeBytes || actualBytes);
          }
          finalImageUrl = uploadRes.url;
        } catch (uploadErr: any) {
          if (reservation.reservationId) {
            await StorageUsageService.releaseReservation(reservation.reservationId);
          }
          throw uploadErr;
        }
      } catch (uploadErr: any) {
        console.error("[Banner Storage Upload Error]:", uploadErr);
        return NextResponse.json({ success: false, error: uploadErr?.message || "Erro no upload do banner para o Storage CDN." }, { status: 500 });
      }
    }

    // Update existing banner
    if (id) {
      const existing = await db.query.banners.findFirst({
        where: eq(banners.id, id),
      });

      if (!existing || existing.storeId !== store.id) {
        return NextResponse.json({ success: false, error: "Banner não encontrado ou sem permissão." }, { status: 403 });
      }

      await db
        .update(banners)
        .set({
          title: (title || existing.title).trim(),
          imageUrl: finalImageUrl,
          linkType: linkType === "none" ? null : linkType || existing.linkType,
          linkValue: linkValue?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(banners.id, id));

      if (existing.imageUrl && finalImageUrl !== existing.imageUrl) {
        await MediaLifecycleService.handleImageReplacement({
          oldUrl: existing.imageUrl,
          newUrl: finalImageUrl,
          storeId: store.id,
          excludeEntityId: id,
        });
      }

      revalidatePath("/seller/banners");
      revalidatePath(`/miniapp/${store.slug}`);
      return NextResponse.json({ success: true, isEdit: true, imageUrl: finalImageUrl });
    }

    // Create new banner - Check entitlement limit
    const existingCount = await db
      .select({ count: count() })
      .from(banners)
      .where(eq(banners.storeId, store.id));

    const total = existingCount[0]?.count || 0;
    const bannerCheck = await checkLimit(seller.id, "max_banners", total);
    if (!bannerCheck.allowed) {
      return NextResponse.json({ success: false, error: `Limite de banners atingido (${total}/${bannerCheck.limit}). Faça upgrade do seu plano.` }, { status: 400 });
    }

    await db.insert(banners).values({
      storeId: store.id,
      title: (title || `Banner ${total + 1}`).trim(),
      imageUrl: finalImageUrl,
      linkType: linkType === "none" ? null : linkType || null,
      linkValue: linkValue?.trim() || null,
      position: total,
      status: 'active',
    });

    revalidatePath("/seller/banners");
    revalidatePath(`/miniapp/${store.slug}`);

    return NextResponse.json({ success: true, isEdit: false, imageUrl: finalImageUrl });
  } catch (err: any) {
    console.error("[Banner API Upload Error]:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro ao salvar banner." }, { status: 500 });
  }
}
