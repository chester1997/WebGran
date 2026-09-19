"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, carouselProducts } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getOrCreateRankingCarouselAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  let ranking = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.storeId, store.id), eq(productCarousels.isRanking, true)),
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.position)],
        with: {
          product: true
        }
      }
    }
  });

  if (!ranking) {
    const [created] = await db
      .insert(productCarousels)
      .values({
        storeId: store.id,
        name: "Top 15 Hoje",
        isRanking: true,
        position: 0,
        status: "active",
      })
      .returning();

    ranking = {
      ...created,
      items: [],
    };
  }

  return ranking;
}

export async function updateRankingCarouselAction(
  carouselId: string,
  name: string,
  status: string,
  productIds: string[]
) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  // Server-side validation: Max 15 products
  if (productIds.length > 15) {
    throw new Error("Esta seção permite no máximo 15 produtos.");
  }

  const existing = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  });
  if (!existing) throw new Error("Ranking não encontrado");

  await db.update(productCarousels).set({
    name: name.trim() || "Top 15 Hoje",
    status: status === "active" ? "active" : "inactive",
    updatedAt: new Date()
  }).where(eq(productCarousels.id, carouselId));

  // Sync products
  await db.delete(carouselProducts).where(eq(carouselProducts.carouselId, carouselId));

  if (productIds.length > 0) {
    await db.insert(carouselProducts).values(
      productIds.slice(0, 15).map((productId, idx) => ({
        carouselId,
        productId,
        position: idx
      }))
    );
  }

  revalidatePath("/seller/carousels");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function createCarouselAction(name: string, productIds: string[]) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  const [carousel] = await db.insert(productCarousels).values({
    storeId: store.id,
    name: name.trim(),
    position: 1,
    status: "active",
    isRanking: false,
  }).returning();

  if (productIds.length > 0) {
    await db.insert(carouselProducts).values(
      productIds.map((productId, idx) => ({
        carouselId: carousel.id,
        productId,
        position: idx
      }))
    );
  }

  revalidatePath("/seller/carousels");
  revalidatePath(`/miniapp/${store.slug}`);
}

export async function updateCarouselAction(carouselId: string, name: string, productIds: string[]) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  const existing = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  });
  if (!existing) throw new Error("Carrossel não encontrado");

  await db.update(productCarousels).set({
    name: name.trim(),
    updatedAt: new Date()
  }).where(eq(productCarousels.id, carouselId));

  await db.delete(carouselProducts).where(eq(carouselProducts.carouselId, carouselId));

  if (productIds.length > 0) {
    await db.insert(carouselProducts).values(
      productIds.map((productId, idx) => ({
        carouselId,
        productId,
        position: idx
      }))
    );
  }

  revalidatePath("/seller/carousels");
  revalidatePath(`/miniapp/${store.slug}`);
}

export async function deleteCarouselAction(carouselId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  await db.delete(productCarousels).where(
    and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  );

  revalidatePath("/seller/carousels");
  revalidatePath(`/miniapp/${store.slug}`);
}
