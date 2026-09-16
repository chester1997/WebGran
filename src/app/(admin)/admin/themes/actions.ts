"use server";

import { db } from "@/db";
import { themes } from "@/db/schema";
import { eq, not } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createTheme(formData: FormData) {
  try {
    await requireAdmin();
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const isDefault = formData.get("isDefault") === "on";

    if (!name || !slug) return { success: false, error: "Nome e slug são obrigatórios" };

    if (isDefault) {
      // Remover o isDefault dos outros
      await db.update(themes).set({ isDefault: false }).where(eq(themes.isDefault, true));
    }

    await db.insert(themes).values({
      name,
      slug,
      description,
      isDefault,
      isActive: true,
      config: {}
    });

    revalidatePath("/admin/themes");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function toggleThemeStatus(themeId: string, isActive: boolean) {
  try {
    await requireAdmin();
    const theme = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });
    if (theme?.isDefault && !isActive) {
      return { success: false, error: "Não é possível desativar o tema padrão." };
    }

    await db.update(themes).set({ isActive }).where(eq(themes.id, themeId));
    revalidatePath("/admin/themes");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function setAsDefaultTheme(themeId: string) {
  try {
    await requireAdmin();
    
    const targetTheme = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });
    if (!targetTheme?.isActive) {
      return { success: false, error: "O tema precisa estar ativo para ser o padrão." };
    }

    await db.update(themes).set({ isDefault: false }).where(not(eq(themes.id, themeId)));
    await db.update(themes).set({ isDefault: true }).where(eq(themes.id, themeId));
    
    revalidatePath("/admin/themes");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
