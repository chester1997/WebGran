"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

export async function createProductAction(formData: FormData) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    throw new Error("O título do produto é obrigatório.");
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim();

  if (!deliveryValue) {
    throw new Error(
      deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento."
    );
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
  const shortDescription = (formData.get("shortDescription") as string) || null;
  const description = (formData.get("description") as string) || null;
  const discountStr = formData.get("discount") as string;
  const discount = discountStr ? parseFloat(discountStr) : 0;

  let compareAtPrice: string | null = null;
  if (discount > 0 && discount < 100) {
    const originalPrice = price / (1 - (discount / 100));
    compareAtPrice = originalPrice.toFixed(2);
  }

  const categoryId = (formData.get("categoryId") as string) || null;
  const botId = (formData.get("botId") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const coverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;

  await db.insert(products).values({
    storeId: store.id,
    botId: botId || null,
    title,
    slug,
    shortDescription,
    description,
    price: price.toString(),
    compareAtPrice,
    categoryId: categoryId || null,
    status,
    duration,
    coverUrl,
    deliveryType,
    deliveryValue,
    position: 0,
  });

  revalidatePath("/seller/products");
  return { success: true };
}

export async function updateProductAction(productId: string, formData: FormData) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    throw new Error("O título do produto é obrigatório.");
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim();

  if (!deliveryValue) {
    throw new Error(
      deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento."
    );
  }

  const shortDescription = (formData.get("shortDescription") as string) || null;
  const description = (formData.get("description") as string) || null;
  const discountStr = formData.get("discount") as string;
  const discount = discountStr ? parseFloat(discountStr) : 0;

  let compareAtPrice: string | null = null;
  if (discount > 0 && discount < 100) {
    const originalPrice = price / (1 - (discount / 100));
    compareAtPrice = originalPrice.toFixed(2);
  }

  const categoryId = (formData.get("categoryId") as string) || null;
  const botId = (formData.get("botId") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const coverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;

  await db.update(products).set({
    botId: botId || null,
    title,
    shortDescription,
    description,
    price: price.toString(),
    compareAtPrice,
    categoryId: categoryId || null,
    status,
    duration,
    coverUrl,
    deliveryType,
    deliveryValue,
    updatedAt: new Date(),
  }).where(and(eq(products.id, productId), eq(products.storeId, store.id)));

  revalidatePath("/seller/products");
  return { success: true };
}

export async function deleteProductAction(productId: string) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  await db.delete(products).where(and(eq(products.id, productId), eq(products.storeId, store.id)));

  revalidatePath("/seller/products");
  return { success: true };
}
