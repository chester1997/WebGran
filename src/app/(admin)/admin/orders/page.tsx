import { connection } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import OrdersClient from "./OrdersClient";

export default async function AdminOrdersPage() {
  await connection();
  await requireAdmin();

  const allOrders = await db.query.orders.findMany({
    with: { store: true, customer: true },
    orderBy: [desc(orders.createdAt)],
    limit: 150
  });

  const formattedOrders = allOrders.map((o) => ({
    id: o.id,
    total: Number(o.total),
    status: o.status,
    paymentMethod: o.paymentMethod,
    createdAt: new Date(o.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),
    storeName: o.store?.name || "Loja Excluída",
    customerName: o.customer?.firstName
      ? `${o.customer.firstName} ${o.customer.lastName || ""}`.trim()
      : "Cliente Telegram",
    customerUsername: o.customer?.username || null
  }));

  return <OrdersClient initialOrders={formattedOrders} />;
}
