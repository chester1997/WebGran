import React from "react";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductCard } from "../components/ProductCard";
import { SearchInput } from "../components/SearchInput";
import { getStoreBySlug } from "@/lib/store-cache";
import { CatalogResolverService } from "@/lib/products/catalog-resolver";

export async function StudioSearch({ 
  storeSlug, 
  q,
  originBotId
}: { 
  storeSlug: string; 
  q: string;
  originBotId?: string | null;
}) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) notFound();

  const visibleProductIds = await CatalogResolverService.getVisibleProductIds(store.id, originBotId);

  let searchResults: any[] = [];
  
  if (visibleProductIds.length > 0) {
    if (q) {
      searchResults = await db.query.products.findMany({
        where: and(
          eq(products.storeId, store.id),
          eq(products.status, 'active'),
          inArray(products.id, visibleProductIds),
          ilike(products.title, `%${q}%`)
        ),
        orderBy: (products, { desc }) => [desc(products.createdAt)],
        limit: 100
      });
    } else {
      searchResults = await db.query.products.findMany({
        where: and(
          eq(products.storeId, store.id),
          eq(products.status, 'active'),
          inArray(products.id, visibleProductIds)
        ),
        orderBy: (products, { desc }) => [desc(products.createdAt)],
        limit: 100
      });
    }
  }

  return (
    <div className="p-4 pt-6 text-white bg-transparent w-full">
      <h1 className="text-xl font-bold mb-4">Explorar Catálogo</h1>
      <SearchInput storeSlug={storeSlug} initialQuery={q} />
      
      <div className="mt-6">
        {searchResults.length === 0 ? (
          <div className="text-center text-zinc-500 py-10">
            {q ? `Nenhum produto encontrado para "${q}".` : "Nenhum produto cadastrado."}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4">
            {searchResults.map(prod => (
              <div key={prod.id} className="w-full flex justify-center">
                <ProductCard storeSlug={storeSlug} product={prod} buttonVariant="details" className="w-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
