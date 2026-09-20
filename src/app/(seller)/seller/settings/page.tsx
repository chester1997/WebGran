import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { sellerPaymentConnections, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, seller.id),
  });

  const connection = await db.query.sellerPaymentConnections.findFirst({
    where: eq(sellerPaymentConnections.sellerId, seller.id),
  });

  return (
    <SettingsClient
      storeName={store?.name || "Minha Loja"}
      sellerProfile={{
        id: seller.id,
        name: userRecord?.name || seller.name || "Vendedor",
        email: seller.email || "",
        avatarUrl: userRecord?.avatarUrl || null,
      }}
      connection={connection ? {
        id: connection.id,
        status: connection.status,
        providerEmail: connection.providerEmail,
        providerUserId: connection.providerUserId,
        updatedAt: connection.updatedAt ? new Date(connection.updatedAt).toISOString() : null,
      } : null}
    />
  );
}
