"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(formData: FormData) {
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const description = formData.get("description") as string;
  const imageUrl = formData.get("imageUrl") as string || null;
  const status = formData.get("status") as string || "active";

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
  redirect("/seller/categories");
}
