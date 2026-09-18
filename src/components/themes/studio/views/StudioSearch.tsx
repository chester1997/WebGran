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
        ilike(products.title, `%${q}%`)
      ),
      limit: 50
    });
  }

  return (
    <div className="p-4 pt-8 text-white bg-zinc-950 w-full">
      <SearchInput storeSlug={storeSlug} initialQuery={q} />
      
      <div className="mt-8">
        {!q ? (
          <div className="text-center text-zinc-500 py-10">
            Digite algo para buscar.
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center text-zinc-500 py-10">
            Nenhum produto encontrado para "{q}".
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {searchResults.map(prod => (
              <div key={prod.id} className="flex justify-center">
                <ProductCard storeSlug={storeSlug} product={prod} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
