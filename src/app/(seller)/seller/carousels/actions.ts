"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, carouselProducts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createCarouselAction(name: string, productIds: string[]) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  const [carousel] = await db.insert(productCarousels).values({
    storeId: store.id,
    name: name.trim(),
    position: 0,
    status: "active"
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
  revalidatePath("/miniapp/[slug]", "layout");
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

  // Sync products: remove old, add new
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
  revalidatePath("/miniapp/[slug]", "layout");
}

export async function deleteCarouselAction(carouselId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  await db.delete(productCarousels).where(
    and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  );

  revalidatePath("/seller/carousels");
  revalidatePath("/miniapp/[slug]", "layout");
}
