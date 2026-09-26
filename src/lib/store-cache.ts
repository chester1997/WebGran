import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { stores, categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getStoreBySlug(storeSlug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-${storeSlug}`);

  if (!storeSlug) return null;

  return await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug),
    with: {
      theme: true,
      categories: {
        where: eq(categories.status, "active"),
        orderBy: [asc(categories.position)],
      },
    },
  });
}
