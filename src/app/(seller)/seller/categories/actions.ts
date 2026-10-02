"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { categories, products, stores } from "@/db/schema";
import { eq, and, inArray, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { checkLimit, hasFeature } from "@/lib/entitlements/entitlement-service";
import { MediaLifecycleService } from "@/lib/storage/lifecycle-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

function assertAdminRole(user: { role?: string }) {
  const role = (user.role || "").toLowerCase();
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Acesso de gerenciamento de categorias restrito apenas ao administrador.");
  }
}

async function processImageUrl(
  rawUrl: string | null,
  storeId: string,
  sellerId: string,
  entityType: "products" | "banners" | "categories" | "store",
  prefix: string
): Promise<string | null> {
  if (!rawUrl || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("data:")) {
    const parts = trimmed.split(",");
    const meta = parts[0];
    const base64Data = parts[1] || "";
    const matchMime = meta.match(/data:(.*?);/);
    const mimeType = matchMime ? matchMime[1] : "image/webp";
    const buffer = Buffer.from(base64Data, "base64");
    const actualBytes = buffer.length;

    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId,
      storeId,
      bytes: actualBytes,
      referenceType: "image_upload",
    });

    if (!reservation.allowed) {
      throw new Error(reservation.reason || "Capacidade de armazenamento excedida para o seu plano.");
    }

    const storagePath = generateMultiTenantStoragePath(storeId, entityType, `${prefix}-${Date.now()}.webp`);
    const provider = getStorageProvider();
    try {
      const uploadRes = await provider.upload(buffer, storagePath, mimeType);
      if (reservation.reservationId) {
        await StorageUsageService.confirmReservation(reservation.reservationId, uploadRes.sizeBytes || actualBytes);
      }
      return uploadRes.url;
    } catch (err: any) {
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
      console.error("[Storage Upload Error]:", err);
      throw new Error(`Upload de imagem da categoria falhou: ${err?.message || "Erro no storage"}`);
    }
  }
  return trimmed;
}

export async function updateCategoryDisplayStyleAction(displayStyle: "IMAGE" | "ICON") {
  const user = await requireSeller();
  assertAdminRole(user);

  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const themeAllowed = await hasFeature(user.id, "custom_theme_enabled");
  if (!themeAllowed) {
    throw new Error("Personalização de tema/estilo não está disponível no seu plano. Faça upgrade.");
  }

  await db
    .update(stores)
    .set({
      categoryDisplayStyle: displayStyle,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/categories");
  revalidatePath("/miniapp/[slug]", "layout");
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireSeller();
  assertAdminRole(user);

  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const [categoryCountRes] = await db
    .select({ value: count() })
    .from(categories)
    .where(eq(categories.storeId, store.id));
  const currentCount = categoryCountRes?.value ?? 0;

  const categoryCheck = await checkLimit(user.id, "max_categories", currentCount);
  if (!categoryCheck.allowed) {
    throw new Error(`Limite de categorias atingido (${currentCount}/${categoryCheck.limit}). Faça upgrade do seu plano.`);
  }

  const rawName = (formData.get("name") as string) || "";
  const name = rawName.trim();
  const slug = name 
    ? (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || `categoria-${Date.now()}`)
    : `categoria-${Date.now()}`;
  const description = (formData.get("description") as string) || "";
  const rawImageUrl = (formData.get("imageUrl") as string) || null;
  const imageUrl = await processImageUrl(rawImageUrl, store.id, user.id, "categories", "category");
  const iconName = (formData.get("iconName") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const selectedProductIds = formData.getAll("selectedProductIds").map(id => String(id));

  const inserted = await db.insert(categories).values({
    storeId: store.id,
    name,
    slug,
    description,
    imageUrl,
    iconName,
    status,
    position: 0,
  }).returning();

  const newCategory = inserted[0];

  if (newCategory && selectedProductIds.length > 0) {
    await db
      .update(products)
      .set({ categoryId: newCategory.id })
      .where(and(eq(products.storeId, store.id), inArray(products.id, selectedProductIds)));
  }

  revalidatePath("/seller/categories");
  revalidatePath("/miniapp/[slug]", "layout");
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  const seller = await requireSeller();
  assertAdminRole(seller);

  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.storeId, store.id)),
  });

  const rawName = (formData.get("name") as string) || "";
  const name = rawName.trim();
  const slug = name 
    ? (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || categoryId)
    : categoryId;
  const description = (formData.get("description") as string) || "";
  const rawImageUrl = (formData.get("imageUrl") as string) || null;
  const imageUrl = await processImageUrl(rawImageUrl, store.id, seller.id, "categories", "category");
  const iconName = (formData.get("iconName") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const selectedProductIds = formData.getAll("selectedProductIds").map(id => String(id));

  await db.update(categories).set({
    name,
    slug,
    description,
    imageUrl,
    iconName,
    status,
    updatedAt: new Date()
  }).where(and(eq(categories.id, categoryId), eq(categories.storeId, store.id)));

  // Media Replacement Cleanup
  if (existing && imageUrl && existing.imageUrl && imageUrl !== existing.imageUrl) {
    await MediaLifecycleService.handleImageReplacement({
      oldUrl: existing.imageUrl,
      newUrl: imageUrl,
      storeId: store.id,
      excludeEntityId: categoryId,
    });
  }

  // 1. Remove category assignment for products currently in this category
  await db
    .update(products)
    .set({ categoryId: null })
    .where(and(eq(products.storeId, store.id), eq(products.categoryId, categoryId)));

  // 2. Assign selected products to this category
  if (selectedProductIds.length > 0) {
    await db
      .update(products)
      .set({ categoryId: categoryId })
      .where(and(eq(products.storeId, store.id), inArray(products.id, selectedProductIds)));
  }

  revalidatePath("/seller/categories");
  revalidatePath("/miniapp/[slug]", "layout");
}

export async function deleteCategoryAction(categoryId: string) {
  const seller = await requireSeller();
  assertAdminRole(seller);

  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.storeId, store.id)),
  });

  if (existing) {
    // Set categoryId to null on associated products before deletion
    await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, categoryId));

    await db.delete(categories).where(
      and(eq(categories.id, categoryId), eq(categories.storeId, store.id))
    );

    if (existing.imageUrl) {
      await MediaLifecycleService.deleteMediaFile(existing.imageUrl, store.id, categoryId);
    }
  }

  revalidatePath("/seller/categories");
  revalidatePath("/miniapp/[slug]", "layout");
}
