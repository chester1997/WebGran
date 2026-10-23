"use server";

import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateSellerProfileAction(data: { name: string; avatarUrl?: string | null }) {
  const seller = await requireSeller();

  if (!data.name || !data.name.trim()) {
    throw new Error("O nome Ã© obrigatÃ³rio.");
  }

  // Validate avatarUrl size if it's base64 data URL (max 5MB image string ~7MB base64)
  if (data.avatarUrl && data.avatarUrl.startsWith("data:") && data.avatarUrl.length > 8 * 1024 * 1024) {
    throw new Error("A imagem do perfil excede o limite mÃ¡ximo de 5MB.");
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

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const seller = await requireSeller();

  const { currentPassword, newPassword, confirmPassword } = data;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("Todos os campos de senha sÃ£o obrigatÃ³rios.");
  }

  if (newPassword.length < 6) {
    throw new Error("A nova senha deve ter no mÃ­nimo 6 caracteres.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("A confirmaÃ§Ã£o da nova senha nÃ£o confere.");
  }

  if (newPassword === currentPassword) {
    throw new Error("A nova senha nÃ£o pode ser igual Ã  senha atual.");
  }

  const bcrypt = await import("bcryptjs");
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, seller.id),
  });

  if (!userRecord) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  const isCurrentValid = await bcrypt.default.compare(currentPassword, userRecord.password);
  if (!isCurrentValid) {
    throw new Error("A senha atual informada estÃ¡ incorreta.");
  }

  const hashedPassword = await bcrypt.default.hash(newPassword, 10);

  await db
    .update(users)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, seller.id));

  return { success: true, message: "Senha alterada com sucesso!" };
}

export async function saveSellerNotificationPreferenceAction(data: {
  telegramNotificationId: string | null;
}) {
  const { requireSeller, getCurrentStore } = await import("@/lib/auth");
  const { stores, telegramBots } = await import("@/db/schema");
  const { and } = await import("drizzle-orm");

  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja nÃ£o encontrada.");

  const cleanId = (data.telegramNotificationId || "").trim();

  if (cleanId) {
    if (!/^-?\d+$/.test(cleanId)) {
      throw new Error("O Telegram ID deve conter apenas nÃºmeros (ex: 123456789).");
    }

    const storeBots = db.query.telegramBots?.findMany
      ? await db.query.telegramBots.findMany({
          where: eq(telegramBots.storeId, store.id),
        })
      : [];

    const isBotId = (storeBots || []).some(
      (b: any) => String(b.botId).trim() === cleanId || String(b.id).trim() === cleanId
    );

    if (isBotId) {
      throw new Error(
        `O ID informado (${cleanId}) pertence ao bot da sua loja. VocÃª deve informar o seu ID pessoal de usuÃ¡rio (obtido com @userinfobot).`
      );
    }
  }

  await db
    .update(stores)
    .set({ telegramNotificationId: cleanId || null, updatedAt: new Date() })
    .where(and(eq(stores.id, store.id), eq(stores.ownerId, seller.id)));

  revalidatePath("/seller/settings");
  revalidatePath("/seller/store");

  return { success: true, telegramNotificationId: cleanId || null };
}
