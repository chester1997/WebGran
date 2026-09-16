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
  const slug = formData.get("slug") as string;
  const shortDescription = formData.get("shortDescription") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string);
  const compareAtPriceStr = formData.get("compareAtPrice") as string;
  const compareAtPrice = compareAtPriceStr ? parseFloat(compareAtPriceStr) : null;
  const categoryId = formData.get("categoryId") as string || null;
  const status = formData.get("status") as string || "active";

  // Insert into DB
  await db.insert(products).values({
    storeId: store.id,
    title,
    slug,
    shortDescription,
    description,
    price: price.toString(), // Drizzle decimal takes string
    compareAtPrice: compareAtPrice ? compareAtPrice.toString() : null,
    categoryId,
    status,
    position: 0,
  });

  revalidatePath("/seller/products");
  redirect("/seller/products");
}
