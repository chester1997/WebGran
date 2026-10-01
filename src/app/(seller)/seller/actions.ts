"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, products, categories } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { AnalyticsService } from "@/lib/analytics/analytics-service";
import { checkLimit } from "@/lib/entitlements/entitlement-service";
import { MediaLifecycleService } from "@/lib/storage/lifecycle-service";

export async function getDashboardAnalyticsAction(period: string = "30D") {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  return await AnalyticsService.getStoreAnalytics(store.id, period);
}

export async function updateStoreSettings(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const logoUrl = formData.get("logoUrl") as string;
  const slug = formData.get("slug") as string; // in real world, validate slug

  if (store) {
    const oldLogo = store.logoUrl;
    await db.update(stores).set({
      name, description, logoUrl, slug
    }).where(eq(stores.id, store.id));

    if (oldLogo && logoUrl && oldLogo !== logoUrl) {
      await MediaLifecycleService.handleImageReplacement({
        oldUrl: oldLogo,
        newUrl: logoUrl,
        storeId: store.id,
        excludeEntityId: store.id,
      });
    }
  } else {
    // Creating store for the first time
    const [storeCountRes] = await db
      .select({ value: count() })
      .from(stores)
      .where(eq(stores.ownerId, user.id));
    const currentCount = storeCountRes?.value ?? 0;

    const storeCheck = await checkLimit(user.id, "max_stores", currentCount);
    if (!storeCheck.allowed) {
      throw new Error(`Limite de lojas atingido (${currentCount}/${storeCheck.limit}). Faça upgrade do seu plano para criar mais lojas.`);
    }

    await db.insert(stores).values({
      name, description, logoUrl, slug, ownerId: user.id
    });
  }

  revalidatePath("/seller/store");
}

export async function createCategory(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Store required");

  const [categoryCountRes] = await db
    .select({ value: count() })
    .from(categories)
    .where(eq(categories.storeId, store.id));
  const currentCount = categoryCountRes?.value ?? 0;

  const categoryCheck = await checkLimit(user.id, "max_categories", currentCount);
  if (!categoryCheck.allowed) {
    throw new Error(`Limite de categorias atingido (${currentCount}/${categoryCheck.limit}). Faça upgrade do seu plano.`);
  }

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const imageUrl = formData.get("imageUrl") as string;
  const position = parseInt(formData.get("position") as string) || 0;
  const status = (formData.get("status") as string) || "active";
  
  await db.insert(categories).values({
    storeId: store.id,
    name,
    slug,
    description,
    imageUrl,
    position,
    status
  });
  revalidatePath("/seller/categories");
}

export async function createProduct(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Store required");

  const [prodCountRes] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.storeId, store.id));
  const currentCount = prodCountRes?.value ?? 0;

  const productCheck = await checkLimit(user.id, "max_products", currentCount);
  if (!productCheck.allowed) {
    throw new Error(`Limite de produtos atingido (${currentCount}/${productCheck.limit}). Faça upgrade do seu plano.`);
  }

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const price = formData.get("price") as string;
  const compareAtPrice = formData.get("compareAtPrice") as string;
  const shortDescription = formData.get("shortDescription") as string;
  const description = formData.get("description") as string;
  const coverUrl = formData.get("coverUrl") as string;
  const bannerUrl = formData.get("bannerUrl") as string;
  const categoryId = formData.get("categoryId") as string;
  const status = (formData.get("status") as string) || "active";
  const position = parseInt(formData.get("position") as string) || 0;

  await db.insert(products).values({
    storeId: store.id,
    title,
    slug,
    price,
    compareAtPrice: compareAtPrice || null,
    shortDescription,
    description,
    coverUrl,
    bannerUrl,
    categoryId: categoryId || null,
    status,
    position
  });
  revalidatePath("/seller/products");
}
