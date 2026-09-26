import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { storeFloatingNotifications, products } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { NotificationsClient } from "./NotificationsClient";
import SetupStoreClient from "../../SetupStoreClient";

export default async function SellerBotNotificationsPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Fetch floating notifications for the seller's store
  const storeNotifications = await db.query.storeFloatingNotifications.findMany({
    where: eq(storeFloatingNotifications.storeId, store.id),
    orderBy: [asc(storeFloatingNotifications.position), desc(storeFloatingNotifications.createdAt)],
    with: {
      product: {
        columns: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Fetch store products for dropdown select
  const storeProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [desc(products.createdAt)],
    columns: {
      id: true,
      title: true,
    },
  });

  const initialSettings = {
    floatingNotificationsEnabled: store.floatingNotificationsEnabled ?? true,
    floatingNotificationsPages: (store.floatingNotificationsPages as string[]) || [
      "home",
      "product",
      "category",
      "search",
    ],
    floatingNotificationsDisplayDuration: store.floatingNotificationsDisplayDuration ?? 5,
    floatingNotificationsIntervalMin: store.floatingNotificationsIntervalMin ?? 15,
    floatingNotificationsIntervalMax: store.floatingNotificationsIntervalMax ?? 30,
  };

  return (
    <NotificationsClient
      initialSettings={initialSettings}
      notifications={storeNotifications}
      products={storeProducts}
    />
  );
}
