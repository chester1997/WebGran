import React from "react";
import { db } from "@/db";
import { products, telegramBots } from "@/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, PackageX } from "lucide-react";
import { StudioProductClient } from "./StudioProductClient";
import { getStoreBySlug } from "@/lib/store-cache";

export async function StudioProduct({ storeSlug, productSlug }: { storeSlug: string, productSlug: string }) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shadow-xl">
          <PackageX className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold">Loja Não Encontrada</h2>
        <p className="text-xs text-zinc-400 max-w-xs">
          A loja solicitada não está disponível no momento.
        </p>
      </div>
    );
  }

  const product = await db.query.products.findFirst({
    where: and(eq(products.storeId, store.id), eq(products.slug, productSlug)),
    with: {
      category: true
    }
  });

  if (!product || product.status !== "active") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-xl">
          <PackageX className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Produto Indisponível</h2>
        <p className="text-xs text-zinc-400 max-w-xs">
          Este produto foi desativado ou não está mais à venda nesta loja.
        </p>
        <Link
          href={`/miniapp/${storeSlug}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Catálogo</span>
        </Link>
      </div>
    );
  }

  // Concurrently fetch secondary data: bot username & recommendation candidates
  const [firstBot, sameCategoryProducts, storeProducts] = await Promise.all([
    db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    }),
    product.categoryId
      ? db.query.products.findMany({
          where: and(
            eq(products.storeId, store.id),
            eq(products.categoryId, product.categoryId),
            eq(products.status, 'active'),
            ne(products.id, product.id)
          ),
          limit: 10
        })
      : Promise.resolve([]),
    db.query.products.findMany({
      where: and(
        eq(products.storeId, store.id),
        eq(products.status, 'active'),
        ne(products.id, product.id)
      ),
      orderBy: [desc(products.createdAt)],
      limit: 12
    })
  ]);

  // Combine recommendations (same category first, filled up to 10 items without duplicates)
  const existingIds = new Set<string>([product.id]);
  const recommendedProducts: any[] = [];

  for (const p of sameCategoryProducts) {
    if (!existingIds.has(p.id) && recommendedProducts.length < 10) {
      existingIds.add(p.id);
      recommendedProducts.push(p);
    }
  }

  for (const p of storeProducts) {
    if (!existingIds.has(p.id) && recommendedProducts.length < 10) {
      existingIds.add(p.id);
      recommendedProducts.push(p);
    }
  }

  const botUsername = firstBot?.username || null;
  const hasAccess = false;

  return (
    <StudioProductClient
      storeSlug={storeSlug}
      product={{
        ...product,
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      }}
      hasAccess={hasAccess}
      botUsername={botUsername}
      recommendedProducts={recommendedProducts.map(p => ({
        ...p,
        price: Number(p.price)
      }))}
    />
  );
}
