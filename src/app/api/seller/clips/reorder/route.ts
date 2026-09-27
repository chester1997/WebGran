import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const { clipIds } = body;

    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return NextResponse.json({ success: false, error: "Lista de IDs de clips inválida." }, { status: 400 });
    }

    // Verify all clipIds belong to seller's store
    const storeClips = await db.query.clips.findMany({
      where: eq(clips.storeId, store.id),
    });

    const storeClipIdSet = new Set(storeClips.map((c) => c.id));
    const isAllValid = clipIds.every((id: string) => storeClipIdSet.has(id));

    if (!isAllValid) {
      return NextResponse.json(
        { success: false, error: "Operação não permitida: um ou mais clips não pertencem a esta loja." },
        { status: 403 }
      );
    }

    // Update positions
    await Promise.all(
      clipIds.map((id: string, index: number) =>
        db
          .update(clips)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(clips.id, id), eq(clips.storeId, store.id)))
      )
    );

    return NextResponse.json({
      success: true,
      message: "Ordem dos clips atualizada com sucesso.",
    });
  } catch (error: any) {
    console.error("[Seller Clips Reorder Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao reordenar clips." },
      { status: 500 }
    );
  }
}
