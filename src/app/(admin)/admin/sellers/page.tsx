import { connection } from "next/server";
import { db } from "@/db";
import { users, stores, subscriptions, invoices } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import SellersClient from "./SellersClient";
import { redirect } from "next/navigation";

export default async function AdminSellersPage() {
  await connection();
  
  try {
    await requirePlatformAdmin();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    redirect("/seller");
  }

  const sellersData = await db.query.users.findMany({
    where: eq(users.role, 'seller'),
    with: {
      stores: true
    },
    orderBy: [desc(users.createdAt)]
  });

  const now = new Date();

  const formattedSellers = await Promise.all(
    sellersData.map(async (seller) => {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.sellerId, seller.id),
        with: {
          plan: true,
          invoices: {
            orderBy: [desc(invoices.createdAt)],
            limit: 1
          }
        }
      });

      const store = seller.stores[0] || null;

      // Status calculation
      let computedStatus = 'active';
      if (store?.status === 'suspended' || sub?.status === 'SUSPENDED') {
        computedStatus = 'suspended';
      } else if (store?.status === 'inactive') {
        computedStatus = 'inactive';
      } else if (sub?.status === 'PAST_DUE' || sub?.status === 'EXPIRED') {
        computedStatus = 'pending';
      }

      const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
      const isExpired = periodEnd ? periodEnd < now : false;

      return {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role,
        createdAt: seller.createdAt ? new Date(seller.createdAt).toISOString() : new Date().toISOString(),
        status: computedStatus,
        store: store ? {
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          createdAt: store.createdAt ? new Date(store.createdAt).toISOString() : new Date().toISOString()
        } : null,
        subscription: sub ? {
          id: sub.id,
          planName: sub.plan?.name || 'WebGran SaaS',
          price: sub.plan?.price ? Number(sub.plan.price) : 89.90,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toISOString() : null,
          currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
          isExpired
        } : null,
        latestInvoice: sub?.invoices && sub.invoices.length > 0 ? {
          id: sub.invoices[0].id,
          amount: Number(sub.invoices[0].amount),
          status: sub.invoices[0].status,
          provider: sub.invoices[0].provider,
          externalId: sub.invoices[0].externalId,
          paidAt: sub.invoices[0].paidAt ? new Date(sub.invoices[0].paidAt).toISOString() : null,
          dueDate: sub.invoices[0].dueDate ? new Date(sub.invoices[0].dueDate).toISOString() : null
        } : null
      };
    })
  );

  return <SellersClient initialSellers={formattedSellers} />;
}
