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
    <div className="w-full min-h-screen bg-zinc-950 text-white p-4">
      <div className="flex items-center gap-4 mb-6 pt-4">
        <Link href={`/miniapp/${storeSlug}`} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{category.name}</h1>
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
