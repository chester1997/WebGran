import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import SellersClient from "./SellersClient";

export default async function AdminSellersPage() {
  await requireAdmin();

  const sellersData = await db.query.users.findMany({
    where: eq(users.role, 'seller'),
    with: {
      stores: true
    },
    orderBy: [desc(users.createdAt)]
  });

  const formattedSellers = sellersData.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    createdAt: new Date(s.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    storesCount: s.stores.length,
    storeNames: s.stores.map((st) => st.name)
  }));

  return <SellersClient initialSellers={formattedSellers} />;
}
