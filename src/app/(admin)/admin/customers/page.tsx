import { connection } from "next/server";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import CustomersClient from "./CustomersClient";

export default async function AdminCustomersPage() {
  await connection();
  await requireAdmin();

  const customersData = await db.query.telegramCustomers.findMany({
    with: { store: true },
    orderBy: [desc(telegramCustomers.createdAt)],
    limit: 150
  });

  const formattedCustomers = customersData.map((c) => ({
    id: c.id,
    telegramUserId: c.telegramUserId,
    firstName: c.firstName,
    lastName: c.lastName,
    username: c.username,
    photoUrl: c.photoUrl,
    createdAt: new Date(c.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    storeName: c.store?.name || null
  }));

  return <CustomersClient initialCustomers={formattedCustomers} />;
}
