import { notFound } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { CartClient } from "./CartClient";

export default async function CarrinhoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const customer = await getWebCustomer(store.id);
  return <CartClient slug={slug} loggedIn={Boolean(customer)} />;
}
