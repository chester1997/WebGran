import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, themes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const user = await requireSeller();

    // Check if store already exists for this user
    const existingStore = await getCurrentStore();
    if (existingStore) {
      return NextResponse.json({
        success: true,
        store: existingStore,
        message: "Você já possui uma loja cadastrada."
      });
    }

    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Nome da loja é obrigatório." }, { status: 400 });
    }

    // Find default theme
    let defaultTheme = await db.query.themes.findFirst({
      where: eq(themes.isDefault, true)
    });

    if (!defaultTheme) {
      defaultTheme = await db.query.themes.findFirst();
    }

    // Generate Slug
    const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const storeSlug = `${slugBase || 'loja'}-${randomSuffix}`;

    // Create Store in DB
    const newStore = await db.insert(stores).values({
      ownerId: user.id,
      name: name.trim(),
      slug: storeSlug,
      themeId: defaultTheme?.id || null,
      status: 'active'
    }).returning();

    return NextResponse.json({
      success: true,
      store: newStore[0]
    });
  } catch (error: any) {
    console.error("STORE CREATE ERROR:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao criar loja." }, { status: 500 });
  }
}
