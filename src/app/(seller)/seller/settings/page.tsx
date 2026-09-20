import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSellerSubscription } from "@/lib/billing/subscription-service";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  let userRecord: any = null;
  try {
    userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });
  } catch (err) {
    console.error("Error fetching user profile record:", err);
  }

  const subscriptionData = await getSellerSubscription(seller.id);

  return (
    <SettingsClient
      storeName={store?.name || "Minha Loja"}
      sellerProfile={{
        id: seller.id,
        name: userRecord?.name || seller.name || "Vendedor",
        email: seller.email || "",
        avatarUrl: userRecord?.avatarUrl || null,
      }}
      subscriptionData={{
        subscription: {
          id: subscriptionData.subscription.id,
          status: subscriptionData.subscription.status,
          currentPeriodStart: subscriptionData.subscription.currentPeriodStart 
            ? new Date(subscriptionData.subscription.currentPeriodStart).toISOString() 
            : new Date().toISOString(),
          currentPeriodEnd: subscriptionData.subscription.currentPeriodEnd 
            ? new Date(subscriptionData.subscription.currentPeriodEnd).toISOString() 
            : new Date().toISOString(),
        },
        plan: {
          id: subscriptionData.plan.id,
          name: subscriptionData.plan.name,
          price: subscriptionData.plan.price,
          currency: subscriptionData.plan.currency,
          billingInterval: subscriptionData.plan.billingInterval,
        },
        latestInvoice: subscriptionData.latestInvoice ? {
          id: subscriptionData.latestInvoice.id,
          externalId: subscriptionData.latestInvoice.externalId,
          amount: Number(subscriptionData.latestInvoice.amount),
          status: subscriptionData.latestInvoice.status,
          dueDate: subscriptionData.latestInvoice.dueDate ? new Date(subscriptionData.latestInvoice.dueDate).toISOString() : null,
          paidAt: subscriptionData.latestInvoice.paidAt ? new Date(subscriptionData.latestInvoice.paidAt).toISOString() : null,
          createdAt: subscriptionData.latestInvoice.createdAt ? new Date(subscriptionData.latestInvoice.createdAt).toISOString() : new Date().toISOString(),
          qrCode: subscriptionData.latestInvoice.qrCode,
          qrCodeText: subscriptionData.latestInvoice.qrCodeText,
        } : null,
        invoiceHistory: subscriptionData.invoiceHistory,
      }}
    />
  );
}
