"use server";

import { db } from "@/db";
import { stores, storeFloatingNotifications, products } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface FloatingNotificationSettings {
  floatingNotificationsEnabled: boolean;
  floatingNotificationsPages: string[];
  floatingNotificationsDisplayDuration: number;
  floatingNotificationsIntervalMin: number;
  floatingNotificationsIntervalMax: number;
}

export interface FloatingNotificationInput {
  id?: string;
  text: string;
  icon: string;
  enabled?: boolean;
  productId?: string | null;
  countMin?: number | null;
  countMax?: number | null;
}

const DEFAULT_TEMPLATES = [
  { text: "🔥 {count} pessoas estão comprando agora", icon: "🔥", countMin: 5, countMax: 18 },
  { text: "👀 {count} pessoas estão de olho neste título", icon: "👀", countMin: 4, countMax: 15 },
  { text: "⚡ Este título está em alta hoje", icon: "⚡", countMin: 3, countMax: 12 },
  { text: "❤️ Um dos favoritos da loja", icon: "❤️", countMin: 5, countMax: 20 },
  { text: "🛒 Garanta seu acesso agora", icon: "🛒", countMin: null, countMax: null },
  { text: "🔥 Título em destaque", icon: "🔥", countMin: null, countMax: null },
  { text: "⚡ Aproveite enquanto está disponível", icon: "⚡", countMin: null, countMax: null },
];

/**
 * Update global store floating notification settings
 */
export async function updateFloatingSettingsAction(data: FloatingNotificationSettings) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  // Validation
  const displayDuration = Math.max(1, Math.min(60, Number(data.floatingNotificationsDisplayDuration) || 5));
  const intervalMin = Math.max(1, Math.min(300, Number(data.floatingNotificationsIntervalMin) || 15));
  const intervalMax = Math.max(intervalMin, Math.min(300, Number(data.floatingNotificationsIntervalMax) || 30));

  await db
    .update(stores)
    .set({
      floatingNotificationsEnabled: Boolean(data.floatingNotificationsEnabled),
      floatingNotificationsPages: Array.isArray(data.floatingNotificationsPages) ? data.floatingNotificationsPages : ["home", "product", "category", "search"],
      floatingNotificationsDisplayDuration: displayDuration,
      floatingNotificationsIntervalMin: intervalMin,
      floatingNotificationsIntervalMax: intervalMax,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}

/**
 * Create or update a floating notification item
 */
export async function saveFloatingNotificationAction(data: FloatingNotificationInput) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  if (!data.text || !data.text.trim()) {
    throw new Error("O texto da mensagem é obrigatório.");
  }

  const cleanText = data.text.trim();
  const cleanIcon = (data.icon && data.icon.trim()) || "🔥";
  const productId = data.productId && data.productId.trim() !== "" ? data.productId.trim() : null;

  let countMin = data.countMin !== undefined && data.countMin !== null ? Number(data.countMin) : 5;
  let countMax = data.countMax !== undefined && data.countMax !== null ? Number(data.countMax) : 18;

  if (countMin < 1) countMin = 1;
  if (countMax < countMin) countMax = countMin;

  if (data.id) {
    // Verify ownership before updating
    const existing = await db.query.storeFloatingNotifications.findFirst({
      where: and(
        eq(storeFloatingNotifications.id, data.id),
        eq(storeFloatingNotifications.storeId, store.id)
      ),
    });

    if (!existing) {
      throw new Error("Notificação não encontrada.");
    }

    await db
      .update(storeFloatingNotifications)
      .set({
        text: cleanText,
        icon: cleanIcon,
        productId,
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : existing.enabled,
        countMin: cleanText.includes("{count}") ? countMin : null,
        countMax: cleanText.includes("{count}") ? countMax : null,
        updatedAt: new Date(),
      })
      .where(and(eq(storeFloatingNotifications.id, data.id), eq(storeFloatingNotifications.storeId, store.id)));
  } else {
    // Get highest current position
    const currentItems = await db.query.storeFloatingNotifications.findMany({
      where: eq(storeFloatingNotifications.storeId, store.id),
      columns: { position: true },
      orderBy: [desc(storeFloatingNotifications.position)],
      limit: 1,
    });

    const nextPos = currentItems.length > 0 ? (currentItems[0].position || 0) + 1 : 0;

    await db.insert(storeFloatingNotifications).values({
      storeId: store.id,
      productId,
      text: cleanText,
      icon: cleanIcon,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      position: nextPos,
      countMin: cleanText.includes("{count}") ? countMin : null,
      countMax: cleanText.includes("{count}") ? countMax : null,
    });
  }

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}

/**
 * Toggle active state of a notification item
 */
export async function toggleFloatingNotificationAction(id: string, enabled: boolean) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  await db
    .update(storeFloatingNotifications)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(and(eq(storeFloatingNotifications.id, id), eq(storeFloatingNotifications.storeId, store.id)));

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}

/**
 * Delete a floating notification item
 */
export async function deleteFloatingNotificationAction(id: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  await db
    .delete(storeFloatingNotifications)
    .where(and(eq(storeFloatingNotifications.id, id), eq(storeFloatingNotifications.storeId, store.id)));

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}

/**
 * Reorder floating notifications
 */
export async function reorderFloatingNotificationsAction(orderedIds: string[]) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(storeFloatingNotifications)
      .set({ position: i, updatedAt: new Date() })
      .where(and(eq(storeFloatingNotifications.id, orderedIds[i]), eq(storeFloatingNotifications.storeId, store.id)));
  }

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}

/**
 * Seed default template messages if none exist or requested
 */
export async function seedDefaultFloatingNotificationsAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
    const tpl = DEFAULT_TEMPLATES[i];
    await db.insert(storeFloatingNotifications).values({
      storeId: store.id,
      text: tpl.text,
      icon: tpl.icon,
      enabled: true,
      position: i,
      countMin: tpl.countMin,
      countMax: tpl.countMax,
    });
  }

  revalidatePath("/seller/bot/notifications");
  return { success: true };
}
