import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ClipService } from "@/lib/clips/service";
import { BunnyStreamService } from "@/lib/bunny/stream";
import { db } from "@/db";
import { clips, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { id } = await params;
    const existing = await ClipService.getClipById(id, store.id);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Clip não encontrado ou sem permissão." }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, isActive, productId } = body;

    const updatedData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ success: false, error: "O título do clipe é obrigatório." }, { status: 400 });
      }
      updatedData.title = title.trim();
    }

    if (description !== undefined) {
      updatedData.description = typeof description === "string" ? description.trim() || null : null;
    }

    if (isActive !== undefined) {
      updatedData.isActive = Boolean(isActive);
    }

    if (productId !== undefined) {
      if (!productId || typeof productId !== "string" || !productId.trim()) {
        updatedData.productId = null;
      } else {
        const targetProd = await db.query.products.findFirst({
          where: and(eq(products.id, productId.trim()), eq(products.storeId, store.id)),
        });
        if (!targetProd) {
          return NextResponse.json(
            { success: false, error: "O produto selecionado é inválido ou não pertence a esta loja." },
            { status: 400 }
          );
        }
        updatedData.productId = targetProd.id;
      }
    }

    const [updated] = await db
      .update(clips)
      .set(updatedData)
      .where(and(eq(clips.id, id), eq(clips.storeId, store.id)))
      .returning();

    // Fetch updated record with product relation included
    const fullUpdated = await ClipService.getClipById(id, store.id);

    return NextResponse.json({
      success: true,
      clip: fullUpdated || updated,
    });
  } catch (error: any) {
    console.error("[Seller Clip PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar clipe." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const { id } = await params;
    const existing = await ClipService.getClipById(id, store.id);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Clip não encontrado ou sem permissão." }, { status: 404 });
    }

    // Delete clip and Bunny Stream video with lifecycle fallback queue
    const success = await ClipService.deleteClip(id, store.id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Erro ao excluir clipe." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Clip excluído com sucesso.",
    });
  } catch (error: any) {
    console.error("[Seller Clip DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao excluir clipe." },
      { status: 500 }
    );
  }
}
