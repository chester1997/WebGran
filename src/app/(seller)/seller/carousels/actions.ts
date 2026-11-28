"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, carouselProducts, telegramBots } from "@/db/schema";
import { eq, and, asc, desc, count, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkLimit } from "@/lib/entitlements/entitlement-service";

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

/** Opções do Tema XDs para um carrossel (só aplicadas quando enviadas). */
export interface CarouselThemeOptions {
  displayStyle?: string | null;
  autoplaySeconds?: number | null;
  coverImageUrl?: string | null;
  subtitle?: string | null;
}

const DISPLAY_STYLES = ["small", "large", "featured", "collection"];

function themeOptionsPayload(opts?: CarouselThemeOptions): Record<string, any> {
  if (!opts) return {};
  const style = DISPLAY_STYLES.includes(String(opts.displayStyle)) ? String(opts.displayStyle) : "small";
  const secs = Math.round(Number(opts.autoplaySeconds) || 0);
  const cover = String(opts.coverImageUrl || "").trim();
  return {
    displayStyle: style,
    autoplaySeconds: style === "featured" ? Math.min(30, Math.max(2, secs || 5)) : null,
    coverImageUrl: style === "collection" && /^https:\/\//i.test(cover) ? cover : null,
    subtitle: style === "collection" ? String(opts.subtitle || "").trim().slice(0, 40) || null : null,
  };
}

/**
 * Carrosséis por bot. Devolve o bot quando ele é da loja; senão null (carrossel da loja toda).
 */
async function carouselBotScope(store: { id: string; ownerId?: string | null }, botId?: string | null): Promise<string | null> {
  if (!botId) return null;
  const bot = await db.query.telegramBots.findFirst({
    where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id)),
    columns: { id: true },
  });
  return bot?.id || null;
}

export async function getOrCreateRankingCarouselAction(botId?: string | null) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  const scopedBotId = await carouselBotScope(store, botId);

  let ranking = await db.query.productCarousels.findFirst({
    // Top 15 do bot; enquanto ele não tiver um, usa o da loja toda (sem bot), que é o que o Mini App mostra
    where: scopedBotId
      ? and(
          eq(productCarousels.storeId, store.id),
          eq(productCarousels.isRanking, true),
          or(eq(productCarousels.botId, scopedBotId), isNull(productCarousels.botId))
        )
      : and(eq(productCarousels.storeId, store.id), eq(productCarousels.isRanking, true)),
    orderBy: [asc(productCarousels.botId)], // ASC = NULLS LAST: o do bot vem antes
    with: {
      items: {
        orderBy: (items, { asc, desc }) => [asc(items.position), desc(items.createdAt)],
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
        botId: scopedBotId,
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
  iconColor?: string,
  badgeColor?: string | null
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
    ...(badgeColor !== undefined ? { badgeColor: badgeColor && /^#[0-9a-f]{6}$/i.test(badgeColor.trim()) ? badgeColor.trim().toUpperCase() : null } : {}),
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
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function getStoreCarouselsAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) return [];

  return await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false)
    ),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
    columns: {
      id: true,
      name: true,
      indicatorType: true,
      iconName: true,
      iconColor: true,
      position: true,
      status: true,
      displayStyle: true,
      autoplaySeconds: true,
      coverImageUrl: true,
      subtitle: true,
    }
  });
}

export async function createCarouselAction(
  name: string, 
  productIds?: string[],
  indicatorType?: "BAR" | "ICON" | "NONE",
  iconName?: string,
  iconColor?: string,
  themeOptions?: CarouselThemeOptions,
  botId?: string | null
) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");
  if (!name.trim()) throw new Error("Nome do carrossel é obrigatório");

  // Limite do plano conta por bot (cada bot tem os seus carrosséis)
  const scopedBotId = await carouselBotScope(store, botId);
  const [carouselCountRes] = await db
    .select({ value: count() })
    .from(productCarousels)
    .where(and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false),
      scopedBotId ? eq(productCarousels.botId, scopedBotId) : isNull(productCarousels.botId)
    ));
  const currentCount = carouselCountRes?.value ?? 0;

  const check = await checkLimit(seller.id, "max_product_carousels", currentCount);
  if (!check.allowed) {
    throw new Error(`Limite de carrosséis de produtos atingido (${currentCount}/${check.limit}). Faça upgrade do seu plano.`);
  }

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
    botId: scopedBotId,
    ...themeOptionsPayload(themeOptions),
  }).returning();

  if (Array.isArray(productIds) && productIds.length > 0) {
    await db.insert(carouselProducts).values(
      productIds.map((productId, idx) => ({
        carouselId: carousel.id,
        productId,
        position: idx
      }))
    );
  }

  revalidatePath("/seller/carousels");
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
  return carousel;
}

export async function updateCarouselAction(
  carouselId: string, 
  name: string, 
  productIds?: string[],
  indicatorType?: "BAR" | "ICON" | "NONE",
  iconName?: string,
  iconColor?: string,
  status?: string,
  themeOptions?: CarouselThemeOptions
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

  const updatePayload: Record<string, any> = {
    name: name.trim(),
    indicatorType: validated.indicatorType,
    iconName: validated.iconName,
    iconColor: validated.iconColor,
    ...themeOptionsPayload(themeOptions),
    updatedAt: new Date()
  };

  if (status) {
    updatePayload.status = status === "active" ? "active" : "inactive";
  }

  await db.update(productCarousels).set(updatePayload).where(eq(productCarousels.id, carouselId));

  // Only synchronize products if an array was explicitly provided
  if (Array.isArray(productIds)) {
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
  }

  revalidatePath("/seller/carousels");
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

export async function toggleCarouselStatusAction(carouselId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  const existing = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  });
  if (!existing) throw new Error("Carrossel não encontrado");

  const newStatus = existing.status === "active" ? "inactive" : "active";
  await db.update(productCarousels).set({
    status: newStatus,
    updatedAt: new Date()
  }).where(eq(productCarousels.id, carouselId));

  revalidatePath("/seller/carousels");
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true, status: newStatus };
}

export async function deleteCarouselAction(carouselId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  await db.delete(productCarousels).where(
    and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id))
  );

  revalidatePath("/seller/carousels");
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
}

export async function moveCarouselPositionAction(carouselId: string, direction: "up" | "down") {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada");

  // Reordena só entre os carrosséis do mesmo bot (ou os da loja toda)
  const moving = await db.query.productCarousels.findFirst({
    where: and(eq(productCarousels.id, carouselId), eq(productCarousels.storeId, store.id)),
    columns: { botId: true },
  });
  if (!moving) return { success: false };

  const carousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false),
      moving.botId ? eq(productCarousels.botId, moving.botId) : isNull(productCarousels.botId)
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
  revalidatePath("/seller/products");
  revalidatePath(`/miniapp/${store.slug}`);
  return { success: true };
}

