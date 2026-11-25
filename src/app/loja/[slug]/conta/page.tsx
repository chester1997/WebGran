import { notFound, redirect } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { listCustomerOrders, listCustomerTickets, listOwnedProducts } from "@/lib/webstore/account";
import { getWebAvatar } from "@/lib/webstore/profile";
import { getActiveVip } from "@/lib/webstore/vip";
import { AccountClient } from "./AccountClient";

export default async function ContaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const customer = await getWebCustomer(store.id);
  if (!customer) redirect(`/loja/${slug}/entrar`);
  const [owned, orders, tickets, avatarUrl] = await Promise.all([
    listOwnedProducts(store.id, customer.shadowCustomerId),
    listCustomerOrders(store.id, customer.shadowCustomerId),
    listCustomerTickets(customer.id),
    getWebAvatar(customer.shadowCustomerId).catch(() => null),
  ]);
  const vip = await getActiveVip(store.id, customer.shadowCustomerId).catch(() => null);
  return (
    <AccountClient
      slug={slug}
      customer={{ name: customer.name, email: customer.email, whatsapp: customer.whatsapp, telegram: customer.telegram, createdAt: customer.createdAt.toISOString(), avatarUrl }}
      vip={vip ? { label: vip.label, until: vip.expiresAt ? vip.expiresAt.toISOString() : null } : null}
      owned={owned.map((o) => ({ ...o, expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null, grantedAt: o.grantedAt ? o.grantedAt.toISOString() : null }))}
      orders={orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => i.product?.title || i.combo?.title || (i.comboSnapshot as { title?: string } | null)?.title || "Produto"),
      }))}
      tickets={tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        sellerReply: t.sellerReply,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
