"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, carouselProducts } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3,8})$/;

function validateIndicator(
  type?: string,
  name?: string,
  color?: string,
  defaultType: "BAR" | "ICON" | "NONE" = "BAR",
  defaultColor: string = "#8B5CF6"
) {
  const validTypes = ["BAR", "ICON", "NONE"];
  const indicatorType = validTypes.includes(type || "") ? (type as "BAR" | "ICON" | "NONE") : defaultType;
  const iconName = name?.trim() || "Trophy";
  const iconColor = color && HEX_COLOR_REGEX.test(color.trim()) ? color.trim() : defaultColor;

  return { indicatorType, iconName, iconColor };
}

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
        indicatorType: "ICON",
        iconName: "Trophy",
        iconColor: "#FFD700",
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
  productIds: string[],
  indicatorType?: "BAR" | "ICON" | "NONE",
  iconName?: string,
  iconColor?: string
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

  const validated = validateIndicator(indicatorType, iconName, iconColor, "ICON", "#FFD700");

  await db.update(productCarousels).set({
    name: name.trim() || "Top 15 Hoje",
    status: status === "active" ? "active" : "inactive",
    indicatorType: validated.indicatorType,
    iconName: validated.iconName,
    iconColor: validated.iconColor,
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

export async function createCarouselAction(
  name: string, 
  productIds: string[],
  indicatorType?: "BAR" | "ICON" | "NONE",
  iconName?: string,
  iconColor?: string
) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  const validated = validateIndicator(indicatorType, iconName, iconColor, "BAR", "#8B5CF6");

  const [carousel] = await db.insert(productCarousels).values({
    storeId: store.id,
    name: name.trim(),
    indicatorType: validated.indicatorType,
    iconName: validated.iconName,
    iconColor: validated.iconColor,
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

export async function updateCarouselAction(
  carouselId: string, 
  name: string, 
  productIds: string[],
  indicatorType?: "BAR" | "ICON" | "NONE",
  iconName?: string,
  iconColor?: string
) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  const existing = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  });
  if (!existing) throw new Error("Carrossel não encontrado");

  const validated = validateIndicator(indicatorType, iconName, iconColor, "BAR", "#8B5CF6");

  await db.update(productCarousels).set({
    name: name.trim(),
    indicatorType: validated.indicatorType,
    iconName: validated.iconName,
    iconColor: validated.iconColor,
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

export async function moveCarouselPositionAction(carouselId: string, direction: "up" | "down") {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  const carousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false)
    ),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)]
  });

  const index = carousels.findIndex(c => c.id === carouselId);
  if (index === -1) return { success: false };

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= carousels.length) return { success: false };

  // Swap in array
  const temp = carousels[index];
  carousels[index] = carousels[targetIndex];
  carousels[targetIndex] = temp;

  // Update position values strictly in DB
  for (let i = 0; i < carousels.length; i++) {
    await db.update(productCarousels)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(productCarousels.id, carousels[i].id));
  }

  revalidatePath("/seller/carousels");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

