import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ClipService } from "@/lib/clips/service";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import SetupStoreClient from "../../SetupStoreClient";
import ClipsClient from "./ClipsClient";

export default async function SellerClipsPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const clipsList = await ClipService.listStoreClips(store.id);

  // Load seller's store products for selection dropdown
  const storeProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [asc(products.title)],
  });

  // Stats calculation
  const total = clipsList.length;
  let published = 0;
  let processing = 0;
  let failed = 0;

  clipsList.forEach((c) => {
    if (c.status === "READY") published++;
    else if (c.status === "FAILED") failed++;
    else processing++; // UPLOADING or PROCESSING
  });

  return (
    <ClipsClient
      initialClips={clipsList.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }))}
      initialStats={{ total, published, processing, failed }}
      availableProducts={storeProducts.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        coverUrl: p.coverUrl,
        slug: p.slug,
        status: p.status,
      }))}
    />
  );
}
