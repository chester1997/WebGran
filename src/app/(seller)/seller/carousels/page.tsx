import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { productCarousels, products } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { getOrCreateRankingCarouselAction } from "./actions";
import SetupStoreClient from "../SetupStoreClient";
import CarouselsClient from "./CarouselsClient";

export default async function SellerCarouselsPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Get or initialize store's Ranking Editorial Carousel (Top 15)
  const rankingCarousel = await getOrCreateRankingCarouselAction();

  // Load all standard carousels with items
  const standardCarousels = await db.query.productCarousels.findMany({
    where: and(
      eq(productCarousels.storeId, store.id),
      eq(productCarousels.isRanking, false)
    ),
    orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.position)],
        with: {
          product: true
        }
      }
    }
  });

  // Load all products for the store
  const storeProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    columns: { id: true, title: true, price: true, badge: true }
  });

  return (
    <CarouselsClient
      rankingCarousel={rankingCarousel}
      standardCarousels={standardCarousels}
      storeProducts={storeProducts}
    />
  );
}
