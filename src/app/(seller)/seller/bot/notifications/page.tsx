import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { db } from "@/db";
import { storeFloatingNotifications, products } from "@/db/schema";
import { eq, asc, desc, and } from "drizzle-orm";
import { NotificationsClient } from "./NotificationsClient";
import NotificationsClientV2 from "./NotificationsClientV2";
import SetupStoreClient from "../../SetupStoreClient";
import { notWebProduct } from "@/lib/webstore/scope";

export default async function SellerBotNotificationsPage() {
  await connection();
  const user = await requireSeller();
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
    where: and(eq(products.storeId, store.id), notWebProduct()),
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

  const isOwner = isOwnerAccount(user);

  // Redesign V2 — exclusivo da conta proprietária
  if (isOwner) {
    return (
      <NotificationsClientV2
        initialSettings={initialSettings}
        notifications={storeNotifications}
        products={storeProducts}
      />
    );
  }

  return (
    <NotificationsClient
      initialSettings={initialSettings}
      notifications={storeNotifications}
      products={storeProducts}
    />
  );
}
