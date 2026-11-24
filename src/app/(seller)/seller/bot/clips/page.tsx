import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { ClipService } from "@/lib/clips/service";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import SetupStoreClient from "../../SetupStoreClient";
import ClipsClient from "./ClipsClient";
import ClipsClientV2 from "./ClipsClientV2";
import { notWebProduct } from "@/lib/webstore/scope";

export default async function SellerClipsPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const clipsList = await ClipService.listStoreClips(store.id);

  // Load seller's store products for selection dropdown
  const storeProducts = await db.query.products.findMany({
    where: and(eq(products.storeId, store.id), notWebProduct()),
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

  const isOwner = isOwnerAccount(user);

  const formattedClips = clipsList.map((c) => ({
    ...c,
    createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
    product: c.product
      ? {
          id: c.product.id,
          title: c.product.title,
          price: c.product.price,
          coverUrl: c.product.coverUrl,
          slug: c.product.slug,
          status: c.product.status,
        }
      : null,
  }));

  const formattedProducts = storeProducts.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    coverUrl: p.coverUrl,
    slug: p.slug,
    status: p.status,
  }));

  if (isOwner) {
    return (
      <ClipsClientV2
        initialClips={formattedClips}
        initialStats={{ total, published, processing, failed }}
        availableProducts={formattedProducts}
      />
    );
  }

  return (
    <ClipsClient
      initialClips={formattedClips}
      initialStats={{ total, published, processing, failed }}
      availableProducts={formattedProducts}
    />
  );
}
