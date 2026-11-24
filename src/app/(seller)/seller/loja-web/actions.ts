"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { webCustomers, webSupportTickets } from "@/db/schema";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { getSellerWebCustomerDetail } from "@/lib/webstore/account";

async function ownerStore() {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) return null;
  return getCurrentStore();
}

export async function customerDetailAction(webCustomerId: string) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  const d = await getSellerWebCustomerDetail(store.id, webCustomerId);
  if (!d) return { ok: false as const, error: "Cliente não encontrado." };
  return {
    ok: true as const,
    detail: {
      orders: d.orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        discount: Number(o.discount),
        paymentMethod: o.paymentMethod,
        couponCode: o.couponCode,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        items: o.items.map((i) => ({
          title: i.product?.title || i.combo?.title || (i.comboSnapshot as { title?: string } | null)?.title || "Produto",
          quantity: i.quantity,
          total: Number(i.total),
          isCombo: Boolean(i.comboId),
        })),
      })),
      owned: d.owned.map((o) => ({
        title: o.title,
        status: o.status,
        deliveryType: o.deliveryType,
        expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
        grantedAt: o.grantedAt ? o.grantedAt.toISOString() : null,
      })),
      tickets: d.tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt.toISOString() })),
    },
  };
}

export async function replyTicketAction(ticketId: string, reply: string, close: boolean) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  const text = String(reply || "").trim().slice(0, 2000);
  if (!text && !close) return { ok: false as const, error: "Escreva a resposta." };
  const now = new Date();
  await db
    .update(webSupportTickets)
    .set({
      ...(text ? { sellerReply: text, repliedAt: now } : {}),
      status: close ? "closed" : "answered",
      updatedAt: now,
    })
    .where(and(eq(webSupportTickets.id, ticketId), eq(webSupportTickets.storeId, store.id)));
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}

export async function setCustomerStatusAction(webCustomerId: string, blocked: boolean) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  await db
    .update(webCustomers)
    .set({ status: blocked ? "blocked" : "active", updatedAt: new Date() })
    .where(and(eq(webCustomers.id, webCustomerId), eq(webCustomers.storeId, store.id)));
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}
