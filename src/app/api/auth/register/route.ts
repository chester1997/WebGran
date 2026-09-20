import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, themes } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password, storeName } = await req.json();

    if (!name || !email || !password || !storeName) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 });
    }

    // Check existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existingUser) {
      return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 400 });
    }

    // Find default theme
    const defaultTheme = await db.query.themes.findFirst({
      where: eq(themes.isDefault, true)
    });

    if (!defaultTheme) {
      return NextResponse.json({ error: "Erro crítico: Nenhum tema padrão configurado na plataforma." }, { status: 500 });
    }

    // Generate Slug for Store
    const slugBase = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const storeSlug = `${slugBase}-${randomSuffix}`;

    // Insert user
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const isOwnerEmail = email.toLowerCase() === 'lf49127@gmail.com';
    const userRole = isOwnerEmail ? 'admin' : 'seller';
    
    // We do a manual transaction approach since simple inserts are fine sequentially
    const newUser = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: userRole
    }).returning({ id: users.id });

    const sellerId = newUser[0].id;

    // Insert store
    await db.insert(stores).values({
      ownerId: sellerId,
      name: storeName,
      slug: storeSlug,
      themeId: defaultTheme.id,
      status: 'active'
    });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error: any) {
    console.error("REGISTER ERROR:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
