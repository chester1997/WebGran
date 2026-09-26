import { NextResponse } from 'next/server';
import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { banners } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';


export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();
    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 400 });
    }

    const body = await req.json();
    const { title, imageUrl, linkType, linkValue, id } = body;

    if (!imageUrl || !imageUrl.trim()) {
      return NextResponse.json({ success: false, error: "A imagem do banner é obrigatória." }, { status: 400 });
    }

    // 20MB payload validation
    if (imageUrl.startsWith("data:") && imageUrl.length > 28 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "A imagem do banner excede o tamanho máximo de 20MB." }, { status: 400 });
    }

    // Update existing banner
    if (id) {
      const existing = await db.query.banners.findFirst({
        where: eq(banners.id, id),
      });

      if (!existing || existing.storeId !== store.id) {
        return NextResponse.json({ success: false, error: "Banner não encontrado ou sem permissão." }, { status: 403 });
      }

      await db
        .update(banners)
        .set({
          title: (title || existing.title).trim(),
          imageUrl: imageUrl.trim(),
          linkType: linkType === "none" ? null : linkType || existing.linkType,
          linkValue: linkValue?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(banners.id, id));

      revalidatePath("/seller/banners");
      revalidatePath(`/miniapp/${store.slug}`);
      return NextResponse.json({ success: true, isEdit: true });
    }

    // Create new banner - Check limit (max 5)
    const existingCount = await db
      .select({ count: count() })
      .from(banners)
      .where(eq(banners.storeId, store.id));

    const total = existingCount[0]?.count || 0;
    if (total >= 5) {
      return NextResponse.json({ success: false, error: "Você pode cadastrar no máximo 5 banners." }, { status: 400 });
    }

    await db.insert(banners).values({
      storeId: store.id,
      title: (title || `Banner ${total + 1}`).trim(),
      imageUrl: imageUrl.trim(),
      linkType: linkType === "none" ? null : linkType || null,
      linkValue: linkValue?.trim() || null,
      position: total,
      status: 'active',
    });

    revalidatePath("/seller/banners");
    revalidatePath(`/miniapp/${store.slug}`);

    return NextResponse.json({ success: true, isEdit: false });
  } catch (err: any) {
    console.error("[Banner API Upload Error]:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro ao salvar banner." }, { status: 500 });
  }
}
