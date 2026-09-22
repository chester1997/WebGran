import React from "react";
import { db } from "@/db";
import { products, categories, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductCard } from "../components/ProductCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export async function StudioCategory({ storeSlug, categorySlug }: { storeSlug: string, categorySlug: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) notFound();

  const category = await db.query.categories.findFirst({
    where: and(eq(categories.storeId, store.id), eq(categories.slug, categorySlug))
  });

  if (!category) notFound();

  const categoryProducts = await db.query.products.findMany({
    where: and(eq(products.storeId, store.id), eq(products.categoryId, category.id)),
    orderBy: (products, { desc }) => [desc(products.createdAt)],
    limit: 100
  });

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

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {categoryProducts.length === 0 ? (
          <p className="col-span-3 text-zinc-500 text-center py-10">Nenhum título nesta categoria.</p>
        ) : (
          categoryProducts.map(prod => (
            <div key={prod.id} className="flex justify-center">
              <ProductCard storeSlug={storeSlug} product={prod} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
