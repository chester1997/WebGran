"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { banners, stores } from "@/db/schema";
import { eq, and, asc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getStoreBanners() {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  const list = await db.query.banners.findMany({
    where: eq(banners.storeId, store.id),
    orderBy: [asc(banners.position), asc(banners.createdAt)],
  });

  return {
    banners: list,
    bannerInterval: store.bannerInterval || 5,
    maxLimit: 5,
  };
}

export async function createBannerAction(data: {
  imageUrl: string;
  title?: string;
  linkType?: string;
  linkValue?: string;
}) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  if (!data.imageUrl || !data.imageUrl.trim()) {
    throw new Error("A URL da imagem do banner é obrigatória.");
  }

  // Server-side validation: Max 5 banners per store
  const existingCount = await db
    .select({ count: count() })
    .from(banners)
    .where(eq(banners.storeId, store.id));

  const total = existingCount[0]?.count || 0;
  if (total >= 5) {
    throw new Error("Você pode cadastrar no máximo 5 banners.");
  }

  await db.insert(banners).values({
    storeId: store.id,
    title: (data.title || `Banner ${total + 1}`).trim(),
    imageUrl: data.imageUrl.trim(),
    linkType: data.linkType || null,
    linkValue: data.linkValue?.trim() || null,
    position: total,
    status: 'active',
  });

  revalidatePath("/seller/banners");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function updateBannerAction(data: {
  id: string;
  title?: string;
  imageUrl?: string;
  status?: string;
  position?: number;
  linkType?: string;
  linkValue?: string;
}) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  // Ownership check
  const existing = await db.query.banners.findFirst({
    where: and(eq(banners.id, data.id), eq(banners.storeId, store.id)),
  });

  if (!existing) {
    throw new Error("Banner não encontrado ou sem permissão.");
  }

  await db
    .update(banners)
    .set({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl.trim() }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.linkType !== undefined && { linkType: data.linkType }),
      ...(data.linkValue !== undefined && { linkValue: data.linkValue }),
      updatedAt: new Date(),
    })
    .where(eq(banners.id, data.id));

  revalidatePath("/seller/banners");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function deleteBannerAction(id: string) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  // Ownership check
  const existing = await db.query.banners.findFirst({
    where: and(eq(banners.id, id), eq(banners.storeId, store.id)),
  });

  if (!existing) {
    throw new Error("Banner não encontrado ou sem permissão.");
  }

  await db.delete(banners).where(eq(banners.id, id));

  revalidatePath("/seller/banners");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function reorderBannersAction(orderedIds: string[]) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  for (let i = 0; i < orderedIds.length; i++) {
    const bannerId = orderedIds[i];
    await db
      .update(banners)
      .set({ position: i, updatedAt: new Date() })
      .where(and(eq(banners.id, bannerId), eq(banners.storeId, store.id)));
  }

  revalidatePath("/seller/banners");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function updateBannerIntervalAction(intervalSeconds: number) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  const validIntervals = [3, 5, 7, 10];
  const interval = validIntervals.includes(intervalSeconds) ? intervalSeconds : 5;

  await db
    .update(stores)
    .set({ bannerInterval: interval, updatedAt: new Date() })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/banners");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}
