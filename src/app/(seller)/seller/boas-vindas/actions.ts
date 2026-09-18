"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getWelcomeSettingsAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  return {
    welcomeMessage: store.welcomeMessage || "",
    welcomeBanners: (store.welcomeBanners as string[]) || [],
    supportType: store.supportType || "telegram",
    supportValue: store.supportValue || "",
  };
}

export async function updateWelcomeSettingsAction(data: {
  welcomeMessage?: string;
  welcomeBanners?: string[];
  supportType?: string;
  supportValue?: string;
}) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  await db
    .update(stores)
    .set({
      welcomeMessage: data.welcomeMessage ?? store.welcomeMessage,
      welcomeBanners: data.welcomeBanners ?? store.welcomeBanners,
      supportType: data.supportType ?? store.supportType,
      supportValue: data.supportValue ?? store.supportValue,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/boas-vindas");
  return { success: true };
}
