import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { getStoreBySlug } from "@/lib/store-cache";
import { CatalogResolverService } from "@/lib/products/catalog-resolver";

/**
 * Dados das páginas públicas de categoria e busca do Mini App, com cache curto.
 * Mesma política da página inicial (StudioHome): cacheLife("minutes").
 * Não depende de sessão/cliente: o resultado é igual para todos que abrem a mesma
 * loja + bot + categoria/busca. Checkout, carrinho e liberação de acesso não usam isto.
 */

export async function getCategoryPageData(
  storeSlug: string,
  categorySlug: string,
  originBotId: string | null
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-${storeSlug}`, `store-category-${storeSlug}-${categorySlug}-${originBotId || "web"}`);

  const store = await getStoreBySlug(storeSlug);
  if (!store) return null;

  const [category, visibleProductIds] = await Promise.all([
    db.query.categories.findFirst({
      where: and(eq(categories.storeId, store.id), eq(categories.slug, categorySlug)),
    }),
    CatalogResolverService.getVisibleProductIds(store.id, originBotId),
  ]);

  if (!category) return null;

  const categoryProducts =
    visibleProductIds.length > 0
      ? await db.query.products.findMany({
          where: and(
            eq(products.storeId, store.id),
            eq(products.categoryId, category.id),
            eq(products.status, "active"),
            inArray(products.id, visibleProductIds)
          ),
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          limit: 100,
        })
      : [];

  return { category: { id: category.id, name: category.name }, products: categoryProducts };
}

export async function getSearchPageData(storeSlug: string, q: string, originBotId: string | null) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-${storeSlug}`, `store-search-${storeSlug}-${originBotId || "web"}`);

  const store = await getStoreBySlug(storeSlug);
  if (!store) return null;

  const visibleProductIds = await CatalogResolverService.getVisibleProductIds(store.id, originBotId);
  if (visibleProductIds.length === 0) return { results: [] };

  const results = await db.query.products.findMany({
    where: and(
      eq(products.storeId, store.id),
      eq(products.status, "active"),
      inArray(products.id, visibleProductIds),
      ...(q ? [ilike(products.title, `%${q}%`)] : [])
    ),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 100,
  });

  return { results };
}
