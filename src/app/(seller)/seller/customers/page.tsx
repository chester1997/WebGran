import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import CustomersClient from "./CustomersClient";
import CustomersClientV2 from "./CustomersClientV2";
import { isOwnerAccount } from "@/lib/auth/owner-access";

import SetupStoreClient from "../SetupStoreClient";

export default async function CustomersPage() {
  await connection();
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const items = await db.query.telegramCustomers.findMany({
    where: eq(telegramCustomers.storeId, store.id),
    orderBy: [desc(telegramCustomers.createdAt)]
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total: items.length,
    newThisMonth: items.filter(c => new Date(c.createdAt) >= startOfMonth).length,
    withUsername: items.filter(c => Boolean(c.username)).length
  };

  const formattedCustomers = items.map(c => ({
    id: c.id,
    telegramUserId: c.telegramUserId,
    username: c.username,
    firstName: c.firstName,
    lastName: c.lastName,
    photoUrl: c.photoUrl,
    languageCode: c.languageCode,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
  }));

  // Redesign V2: só a conta proprietária vê; lojistas continuam na versão clássica.
  if (isOwnerAccount(seller)) {
    return <CustomersClientV2 customers={formattedCustomers} stats={stats} />;
  }

  return (
    <CustomersClient 
      customers={formattedCustomers}
      stats={stats}
    />
  );
}
