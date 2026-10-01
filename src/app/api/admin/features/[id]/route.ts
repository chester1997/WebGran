import { NextResponse } from "next/server";
import { db } from "@/db";
import { features } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id } = await params;
    const body = await req.json();

    const feature = await db.query.features.findFirst({
      where: eq(features.id, id),
    });

    if (!feature) {
      return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
    }

    const { name, description, category, defaultValue, isActive } = body;
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (category !== undefined) updateData.category = category ? category.trim().toLowerCase() : "general";
    if (defaultValue !== undefined) {
      updateData.defaultValue = typeof defaultValue === "object" && defaultValue !== null && "value" in defaultValue
        ? defaultValue
        : { value: defaultValue };
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await db
      .update(features)
      .set(updateData)
      .where(eq(features.id, id))
      .returning();

    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "UPDATE_FEATURE",
      featureId: id,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, feature: updated[0] });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Erro ao atualizar recurso." }, { status: 500 });
  }
}
