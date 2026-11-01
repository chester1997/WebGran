import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { OrdersClient, SerializedOrder } from "./OrdersClient";
import SetupStoreClient from "../SetupStoreClient";

export default async function OrdersPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const items = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
      accesses: {
        with: {
          product: true,
        },
      },
    },
  });

  const serializedOrders: SerializedOrder[] = items.map((order) => ({
    id: order.id,
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
    total: order.total,
    status: order.status,
    customer: order.customer
      ? {
          id: order.customer.id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          photoUrl: order.customer.photoUrl,
        }
      : null,
    accesses: (order.accesses || []).map((access) => ({
      id: access.id,
      deliveryStatus: access.deliveryStatus,
      status: access.status,
      telegramChatId: access.telegramChatId,
      deliveryError: access.deliveryError,
      product: access.product
        ? {
            id: access.product.id,
            title: access.product.title,
          }
        : null,
    })),
  }));

  return <OrdersClient initialOrders={serializedOrders} />;
}
