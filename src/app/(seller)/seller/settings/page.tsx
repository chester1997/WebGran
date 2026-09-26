export const instant = false;
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

  let subscriptionData: any = null;
  try {
    subscriptionData = await getSellerSubscription(seller.id);
  } catch (err) {
    console.error("Error fetching seller subscription in SettingsPage:", err);
  }

  // Safe fallbacks to prevent 500 server crashes in case of database or provider errors
  const safeSubscription = subscriptionData?.subscription || {
    id: "default-sub",
    status: "ACTIVE",
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
  };

  const safePlan = subscriptionData?.plan || {
    id: "default-plan",
    name: "WebGran",
    price: 89.90,
    currency: "BRL",
    billingInterval: "MONTHLY",
  };

  const safeLatestInvoice = subscriptionData?.latestInvoice ? {
    id: subscriptionData.latestInvoice.id,
    externalId: subscriptionData.latestInvoice.externalId || null,
    amount: Number(subscriptionData.latestInvoice.amount || 89.90),
    status: subscriptionData.latestInvoice.status || "PENDING",
    dueDate: subscriptionData.latestInvoice.dueDate ? new Date(subscriptionData.latestInvoice.dueDate).toISOString() : null,
    paidAt: subscriptionData.latestInvoice.paidAt ? new Date(subscriptionData.latestInvoice.paidAt).toISOString() : null,
    createdAt: subscriptionData.latestInvoice.createdAt ? new Date(subscriptionData.latestInvoice.createdAt).toISOString() : new Date().toISOString(),
    expiresAt: subscriptionData.latestInvoice.expiresAt ? new Date(subscriptionData.latestInvoice.expiresAt).toISOString() : null,
    qrCode: subscriptionData.latestInvoice.qrCode || null,
    qrCodeText: subscriptionData.latestInvoice.qrCodeText || null,
  } : null;

  const safeInvoiceHistory = (subscriptionData?.invoiceHistory || []).map((inv: any) => ({
    id: inv.id,
    externalId: inv.externalId || null,
    amount: Number(inv.amount || 89.90),
    status: inv.status || "PENDING",
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
    paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
    createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
    expiresAt: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : null,
    qrCode: inv.qrCode || null,
    qrCodeText: inv.qrCodeText || null,
  }));

  return (
    <SettingsClient
      storeName={store?.name || "Minha Loja"}
      isExempt={Boolean(subscriptionData?.isExempt)}
      sellerProfile={{
        id: seller.id,
        name: userRecord?.name || seller.name || "Vendedor",
        email: seller.email || "",
        avatarUrl: userRecord?.avatarUrl || null,
        role: userRecord?.role || seller.role || "seller",
      }}
      subscriptionData={{
        subscription: {
          id: safeSubscription.id,
          status: safeSubscription.status,
          currentPeriodStart: safeSubscription.currentPeriodStart 
            ? new Date(safeSubscription.currentPeriodStart).toISOString() 
            : new Date().toISOString(),
          currentPeriodEnd: safeSubscription.currentPeriodEnd 
            ? new Date(safeSubscription.currentPeriodEnd).toISOString() 
            : new Date().toISOString(),
        },
        plan: safePlan,
        latestInvoice: safeLatestInvoice,
        invoiceHistory: safeInvoiceHistory,
      }}
    />
  );
}
