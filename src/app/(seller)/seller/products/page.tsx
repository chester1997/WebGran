import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { db } from "@/db";
import { products, categories, telegramBots, productCarousels, carouselProducts } from "@/db/schema";
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import ProductsListClient from "./ProductsListClient";
import ProductsListClientV2 from "./ProductsListClientV2";

import SetupStoreClient from "../SetupStoreClient";
import { notWebProduct } from "@/lib/webstore/scope";

export default async function SellerProductsPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Consultas independentes em paralelo (antes rodavam uma depois da outra)
  const [allProducts, allCategories, storeBots, allCarousels] = await Promise.all([
    // Products with their categories and bot visibilities
    db.query.products.findMany({
      where: and(eq(products.storeId, store.id), notWebProduct()),
      orderBy: [desc(products.createdAt)],
      with: {
        category: true,
        botVisibilities: true,
      }
    }),
    db.query.categories.findMany({
      where: eq(categories.storeId, store.id),
      columns: { id: true, name: true }
    }),
    db.query.telegramBots.findMany({
      where: eq(telegramBots.storeId, store.id),
      columns: { id: true, username: true, displayName: true, photoUrl: true }
    }),
    // Custom non-ranking carousels of this store
    db.query.productCarousels.findMany({
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
    }),
  ]);

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

  const isOwner = isOwnerAccount(user);

  if (isOwner) {
    return (
      <ProductsListClientV2
        storeName={store.name}
        products={enrichedProducts}
        categories={allCategories}
        bots={storeBots}
        userRole={user?.role}
        isOwnerAccount={true}
        carousels={allCarousels}
      />
    );
  }

  return (
    <ProductsListClient 
      storeName={store.name}
      products={enrichedProducts}
      categories={allCategories}
      bots={storeBots}
      userRole={user?.role}
      isOwnerAccount={false}
      carousels={allCarousels}
    />
  );
}
