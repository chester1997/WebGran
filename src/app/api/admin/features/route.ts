import { NextResponse } from "next/server";
import { db } from "@/db";
import { features } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import { ensureEntitlementTablesAndSeed } from "@/db/ensure-entitlements";

export async function GET() {
  try {
    await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();

    const allFeatures = await db.query.features.findMany({
      orderBy: [desc(features.createdAt)],
    });

    const formattedFeatures = allFeatures.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      type: f.type,
      category: f.category,
      defaultValue: typeof f.defaultValue === "object" && f.defaultValue !== null && "value" in f.defaultValue
        ? f.defaultValue.value
        : f.defaultValue,
      isActive: f.isActive,
      createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({ features: formattedFeatures });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN GET FEATURES ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao buscar recursos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requirePlatformAdmin();
    await ensureEntitlementTablesAndSeed();
    const body = await req.json();
    const { key, name, description, type, category, defaultValue, isActive } = body;

    if (!key || !key.trim()) {
      return NextResponse.json({ error: "A chave (key) da feature é obrigatória." }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "O nome da feature é obrigatório." }, { status: 400 });
    }

    const validTypes = ["BOOLEAN", "LIMIT", "QUOTA"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido. Escolha BOOLEAN, LIMIT ou QUOTA." }, { status: 400 });
    }

    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");

    const existingKey = await db.query.features.findFirst({
      where: eq(features.key, cleanKey),
    });

    if (existingKey) {
      return NextResponse.json({ error: "Já existe uma feature cadastrada com esta chave." }, { status: 400 });
    }

    const formattedDefault = typeof defaultValue === "object" && defaultValue !== null && "value" in defaultValue
      ? defaultValue
      : { value: defaultValue };

    const created = await db
      .insert(features)
      .values({
        key: cleanKey,
        name: name.trim(),
        description: description ? description.trim() : null,
        type,
        category: category ? category.trim().toLowerCase() : "general",
        defaultValue: formattedDefault,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning();

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "CREATE_FEATURE",
      featureKey: cleanKey,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, feature: created[0] });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN POST FEATURE ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar recurso." }, { status: 500 });
  }
}
