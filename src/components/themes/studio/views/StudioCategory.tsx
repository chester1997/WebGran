import React from "react";
import { notFound } from "next/navigation";
import { ProductCard } from "../components/ProductCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCategoryPageData } from "@/lib/miniapp/catalog-page-cache";

export async function StudioCategory({ 
  storeSlug, 
  categorySlug,
  originBotId
}: { 
  storeSlug: string; 
  categorySlug: string;
  originBotId?: string | null;
}) {
  // Dados com cache curto (mesma política da página inicial); notFound fica fora do cache
  const data = await getCategoryPageData(storeSlug, categorySlug, originBotId || null);

  if (!data) notFound();

  const { category, products: categoryProducts } = data;

  return (
    <div className="w-full bg-transparent text-white p-4">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link 
          href={`/miniapp/${storeSlug}`} 
          className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
          {category.name}
        </h1>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4">
        {categoryProducts.length === 0 ? (
          <p className="col-span-full text-zinc-500 text-center py-10">Nenhum título nesta categoria.</p>
        ) : (
          categoryProducts.map(prod => (
            <div key={prod.id} className="w-full flex justify-center">
              <ProductCard storeSlug={storeSlug} product={prod} buttonVariant="details" className="w-full" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
