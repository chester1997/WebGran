"use server";

import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateSellerProfileAction(data: { name: string; avatarUrl?: string | null }) {
  const seller = await requireSeller();

  if (!data.name || !data.name.trim()) {
    throw new Error("O nome é obrigatório.");
  }

  // Validate avatarUrl size if it's base64 data URL (max 5MB image string ~7MB base64)
  if (data.avatarUrl && data.avatarUrl.startsWith("data:") && data.avatarUrl.length > 8 * 1024 * 1024) {
    throw new Error("A imagem do perfil excede o limite máximo de 5MB.");
  }

  const updatedAvatar = data.avatarUrl !== undefined ? (data.avatarUrl ? data.avatarUrl.trim() : null) : undefined;

  await db
    .update(users)
    .set({
      name: data.name.trim(),
      ...(updatedAvatar !== undefined ? { avatarUrl: updatedAvatar } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, seller.id));

  revalidatePath("/seller");
  revalidatePath("/seller/settings");

  return { success: true };
}
