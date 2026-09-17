"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const description = formData.get("description") as string;
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const status = (formData.get("status") as string) || "active";

  await db.insert(categories).values({
    storeId: store.id,
    name,
    slug,
    description,
    imageUrl,
    status,
    position: 0,
  });

  revalidatePath("/seller/categories");
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || categoryId;
  const description = formData.get("description") as string;
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const status = (formData.get("status") as string) || "active";

  await db.update(categories).set({
    name,
    slug,
    description,
    imageUrl,
    status,
    updatedAt: new Date()
  }).where(and(eq(categories.id, categoryId), eq(categories.storeId, store.id)));

  revalidatePath("/seller/categories");
}

export async function deleteCategoryAction(categoryId: string) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Loja não encontrada");
  }

  // Set categoryId to null on associated products before deletion
  await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, categoryId));

  await db.delete(categories).where(
    and(eq(categories.id, categoryId), eq(categories.storeId, store.id))
  );

  revalidatePath("/seller/categories");
}
