import { notFound } from "next/navigation";
import { getWebStore } from "@/lib/webstore/web-store";
import { listWebProducts } from "@/lib/webstore/products";
import { SearchClient } from "./SearchClient";

export default async function BuscarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const list = await listWebProducts(store.id, { onlyActive: true });
  return <SearchClient slug={slug} items={list.map((p) => ({ id: p.id, slug: p.slug, title: p.title, coverUrl: p.coverUrl, price: p.price }))} />;
}
