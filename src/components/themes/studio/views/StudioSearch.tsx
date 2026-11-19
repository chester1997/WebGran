import React from "react";
import { notFound } from "next/navigation";
import { ProductCard } from "../components/ProductCard";
import { SearchInput } from "../components/SearchInput";
import { getSearchPageData } from "@/lib/miniapp/catalog-page-cache";

export async function StudioSearch({ 
  storeSlug, 
  q,
  originBotId
}: { 
  storeSlug: string; 
  q: string;
  originBotId?: string | null;
}) {
  // Dados com cache curto (mesma política da página inicial); notFound fica fora do cache
  const data = await getSearchPageData(storeSlug, q || "", originBotId || null);

  if (!data) notFound();

  const searchResults: any[] = data.results;

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
