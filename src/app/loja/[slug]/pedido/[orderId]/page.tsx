import { redirect, notFound } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { orderStatusAction } from "../../actions";
import { OrderClient } from "./OrderClient";

export default async function PedidoPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  if (!(await getWebCustomer(store.id))) redirect(`/loja/${slug}/entrar`);
  const res = await orderStatusAction(slug, orderId);
  if (!res.ok) notFound();
  return <OrderClient slug={slug} initial={res.order} />;
}
