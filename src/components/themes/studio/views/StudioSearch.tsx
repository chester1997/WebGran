import React from "react";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductCard } from "../components/ProductCard";
import { SearchInput } from "../components/SearchInput";

export async function StudioSearch({ storeSlug, q }: { storeSlug: string, q: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) notFound();

  let searchResults: any[] = [];
  
  if (q) {
    searchResults = await db.query.products.findMany({
      where: and(
        eq(products.storeId, store.id),
        eq(products.status, 'active'),
        ilike(products.title, `%${q}%`)
      ),
      orderBy: (products, { desc }) => [desc(products.createdAt)],
      limit: 100
    });
  } else {
    searchResults = await db.query.products.findMany({
      where: and(
        eq(products.storeId, store.id),
        eq(products.status, 'active')
      ),
      orderBy: (products, { desc }) => [desc(products.createdAt)],
      limit: 100
    });
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
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {searchResults.map(prod => (
              <div key={prod.id} className="flex justify-center">
                <ProductCard storeSlug={storeSlug} product={prod} buttonVariant="details" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
