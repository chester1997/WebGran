"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { parseSupportConfig } from "@/lib/support/support-helper";

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
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");

  const welcomeAllowed = await hasFeature(seller.id, "welcome_bot_message_enabled");
  if (!welcomeAllowed) {
    throw new Error("A mensagem de boas-vindas do bot não está disponível no seu plano. Faça upgrade.");
  }

  const finalSupportType = data.supportType ?? store.supportType ?? "telegram";
  let finalSupportValue =
    data.supportValue !== undefined
      ? data.supportValue.trim()
      : (store.supportValue ?? "");

  if (finalSupportValue) {
    const parsed = parseSupportConfig(finalSupportType, finalSupportValue);
    if (!parsed.isValid) {
      throw new Error(parsed.errorMessage || "Configuração de suporte inválida.");
    }
    finalSupportValue = parsed.normalizedValue;
  } else {
    finalSupportValue = "";
  }

  await db
    .update(stores)
    .set({
      welcomeMessage: data.welcomeMessage ?? store.welcomeMessage,
      welcomeBanners: data.welcomeBanners ?? store.welcomeBanners,
      supportType: finalSupportType,
      supportValue: finalSupportValue,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  revalidatePath("/seller/boas-vindas");
  if (store.slug) {
    revalidatePath(`/miniapp/${store.slug}`);
    revalidatePath(`/miniapp/${store.slug}/[...all]`);
  }
  revalidatePath("/miniapp/[slug]", "layout");

  return { success: true };
}
