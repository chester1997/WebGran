"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createProductAction(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const title = formData.get("title") as string;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const shortDescription = formData.get("shortDescription") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string);
  const discountStr = formData.get("discount") as string;
  const discount = discountStr ? parseFloat(discountStr) : 0;
  
  let compareAtPrice: string | null = null;
  if (discount > 0 && discount < 100) {
    const originalPrice = price / (1 - (discount / 100));
    compareAtPrice = originalPrice.toFixed(2);
  }

  const categoryId = formData.get("categoryId") as string || null;
  const botId = formData.get("botId") as string || null;
  const status = formData.get("status") as string || "active";
  const duration = formData.get("duration") as string || "lifetime";
  const coverUrl = formData.get("imageUrl") as string || null;

  // Insert into DB
  await db.insert(products).values({
    storeId: store.id,
    botId,
    title,
    slug,
    shortDescription,
    description,
    price: price.toString(), // Drizzle decimal takes string
    compareAtPrice,
    categoryId,
    status,
    duration,
    coverUrl,
    position: 0,
  });

  revalidatePath("/seller/products");
  redirect("/seller/products");
}
