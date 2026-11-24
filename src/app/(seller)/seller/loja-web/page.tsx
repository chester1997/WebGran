import { connection } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import { listSellerTickets, listSellerWebCustomers } from "@/lib/webstore/account";
import { webTablesReady } from "@/lib/webstore/web-store";
import { listWebProducts } from "@/lib/webstore/products";
import { getSections } from "@/lib/webstore/sections";
import { getWebBranding } from "@/lib/webstore/settings";
import SetupStoreClient from "../SetupStoreClient";
import WebStoreClient from "./WebStoreClient";

/** Vendas → Loja Web (esboço em teste, exclusivo da conta proprietária). */
export default async function LojaWebPage() {
  await connection();
  await requireOwnerAccount();
  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;

  const ready = await webTablesReady();
  const [customers, tickets] = ready ? await Promise.all([listSellerWebCustomers(store.id), listSellerTickets(store.id)]) : [[], []];
  const [webProducts, showcase, look] = await Promise.all([listWebProducts(store.id), getSections(store.id), getWebBranding(store.id)]);

  return (
    <WebStoreClient
      ready={ready}
      sectionsReady={showcase.ready}
      branding={look.branding}
      brandingReady={look.ready}
      storeName={store.name}
      sections={showcase.sections}
      webProducts={webProducts.map(({ createdAt: _c, position: _p, ...p }) => p)}
      storeSlug={store.slug}
      customers={customers.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        lastLoginAt: c.lastLoginAt ? c.lastLoginAt.toISOString() : null,
        lastPurchaseAt: c.lastPurchaseAt ? c.lastPurchaseAt.toISOString() : null,
      }))}
      tickets={tickets.map(({ t, name, email, whatsapp, telegram }) => ({
        id: t.id,
        webCustomerId: t.webCustomerId,
        subject: t.subject,
        message: t.message,
        contactVia: t.contactVia,
        status: t.status,
        sellerReply: t.sellerReply,
        orderId: t.orderId,
        createdAt: t.createdAt.toISOString(),
        customer: { name, email, whatsapp, telegram },
      }))}
    />
  );
}
