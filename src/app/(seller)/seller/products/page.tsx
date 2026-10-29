import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, categories, telegramBots, productCarousels, carouselProducts } from "@/db/schema";
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import ProductsListClient from "./ProductsListClient";

import SetupStoreClient from "../SetupStoreClient";

export default async function SellerProductsPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Load products with their categories
  const allProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    with: {
      category: true
    }
  });

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.storeId, store.id),
    columns: { id: true, name: true }
  });

  const storeBots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id),
    columns: { id: true, username: true, displayName: true }
  });

  // Load custom non-ranking carousels of this store
  const allCarousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false)
    ),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
    columns: {
      id: true,
      name: true,
      indicatorType: true,
      iconName: true,
      iconColor: true,
      status: true,
      position: true,
    }
  });

  // Map product carousels
  const customCarouselIds = allCarousels.map((c) => c.id);
  const productCarouselMap: Record<string, string[]> = {};

  if (customCarouselIds.length > 0) {
    const associations = await db.query.carouselProducts.findMany({
      where: inArray(carouselProducts.carouselId, customCarouselIds),
      columns: {
        productId: true,
        carouselId: true,
      }
    });

    for (const assoc of associations) {
      if (!productCarouselMap[assoc.productId]) {
        productCarouselMap[assoc.productId] = [];
      }
      productCarouselMap[assoc.productId].push(assoc.carouselId);
    }
  }

  const enrichedProducts = allProducts.map((p) => ({
    ...p,
    carouselIds: productCarouselMap[p.id] || [],
  }));

  return (
    <ProductsListClient 
      storeName={store.name}
      products={enrichedProducts}
      categories={allCategories}
      bots={storeBots}
      userRole={user?.role}
      carousels={allCarousels}
    />
  );
}
