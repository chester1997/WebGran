import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { invoices, subscriptions, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import AdminSubscriptionsClient from "./AdminSubscriptionsClient";

export default async function AdminSubscriptionsPage() {
  await connection();
  await requireAdmin();

  // 1. Fetch all subscription invoices with seller details
  let invoicesList: any[] = [];
  try {
    invoicesList = await db.query.invoices.findMany({
      orderBy: [desc(invoices.createdAt)],
      with: {
        seller: true,
      },
    });
  } catch (err) {
    console.error("Error fetching admin subscription invoices:", err);
  }

  // 2. Fetch active subscriptions count
  let activeSubscriptionsCount = 0;
  try {
    const activeSubs = await db.query.subscriptions.findMany({
      where: eq(subscriptions.status, "ACTIVE"),
    });
    activeSubscriptionsCount = activeSubs.length;
  } catch (err) {
    console.error("Error fetching active subscriptions:", err);
  }

  // 3. Compute metric summary
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let monthlyRevenue = 0;
  let pendingCount = 0;
  let expiredCount = 0;

  const formattedInvoices = invoicesList.map((inv) => {
    const amountNum = Number(inv.amount || 89.90);
    const isThisMonth = inv.paidAt && new Date(inv.paidAt) >= firstDayOfMonth;

    if (inv.status === "PAID" && isThisMonth) {
      monthlyRevenue += amountNum;
    }
    if (inv.status === "PENDING") {
      pendingCount++;
    }
    if (inv.status === "EXPIRED") {
      expiredCount++;
    }

    return {
      id: inv.id,
      sellerName: inv.seller?.name || "Vendedor",
      sellerEmail: inv.seller?.email || "vendedor@webgran.online",
      amount: amountNum,
      status: inv.status || "PENDING",
      externalId: inv.externalId || inv.id,
      createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
      paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      expiresAt: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : null,
    };
  });

  return (
    <AdminSubscriptionsClient
      metrics={{
        monthlyRevenue,
        activeSubscriptionsCount,
        pendingCount,
        expiredCount,
      }}
      invoices={formattedInvoices}
    />
  );
}
