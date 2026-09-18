import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { sellerPaymentConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  const connection = await db.query.sellerPaymentConnections.findFirst({
    where: eq(sellerPaymentConnections.sellerId, seller.id),
  });

  return (
    <SettingsClient
      storeName={store?.name || "Minha Loja"}
      ownerEmail={seller.email || ""}
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
