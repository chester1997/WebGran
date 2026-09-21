import React from "react";
import { db } from "@/db";
import { products, stores, telegramBots } from "@/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StudioProductClient } from "./StudioProductClient";

export async function StudioProduct({ storeSlug, productSlug }: { storeSlug: string, productSlug: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) notFound();

  const product = await db.query.products.findFirst({
    where: and(eq(products.storeId, store.id), eq(products.slug, productSlug)),
    with: {
      category: true
    }
  });

  if (!product) notFound();

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
