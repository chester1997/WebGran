import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { products, webHeroImages } from "@/db/schema";

/** Imagem horizontal de cada título nos Destaques do topo (migration 0032). Sem a tabela, nada quebra. */

function isMissingTable(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  const code = e?.code || e?.cause?.code;
  return code === "42P01" || /relation "web_hero_images" does not exist/i.test(String(e?.message || ""));
}

export async function getHeroImages(storeId: string): Promise<{ ready: boolean; images: Record<string, string> }> {
  try {
    const rows = await db.select().from(webHeroImages).where(eq(webHeroImages.storeId, storeId));
    return { ready: true, images: Object.fromEntries(rows.map((r) => [r.productId, r.imageUrl])) };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, images: {} };
    throw err;
  }
}

export async function saveHeroImage(storeId: string, productId: string, url: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, error: "Produto inválido." };
  const own = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.storeId, storeId), like(products.status, "web_%")), columns: { id: true } });
  if (!own) return { ok: false, error: "Produto não encontrado na Loja Web." };
  const clean = url && /^https:\/\/\S+$/i.test(url) && url.length <= 1000 ? url : null;
  try {
    if (!clean) {
      await db.delete(webHeroImages).where(and(eq(webHeroImages.storeId, storeId), eq(webHeroImages.productId, productId)));
    } else {
      await db
        .insert(webHeroImages)
        .values({ storeId, productId, imageUrl: clean })
        .onConflictDoUpdate({ target: [webHeroImages.storeId, webHeroImages.productId], set: { imageUrl: clean, updatedAt: new Date() } });
    }
    return { ok: true };
  } catch (err) {
    if (isMissingTable(err)) return { ok: false, error: "Rode a migration 0032_web_hero_images.sql no Neon para salvar." };
    throw err;
  }
}
