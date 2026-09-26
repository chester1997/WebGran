import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, categories, telegramBots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import ProductsListClient from "./ProductsListClient";

import SetupStoreClient from "../SetupStoreClient";

export default async function SellerProductsPage() {
  await connection();
  await requireSeller();
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

  return (
    <ProductsListClient 
      storeName={store.name}
      products={allProducts}
      categories={allCategories}
      bots={storeBots}
    />
  );
}
