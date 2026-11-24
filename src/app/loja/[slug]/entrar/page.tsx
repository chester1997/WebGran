import { notFound, redirect } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { AuthForm } from "../_components/AuthForm";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const { next } = await searchParams;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const safeNext = next === "carrinho" ? "carrinho" : "";
  if (await getWebCustomer(store.id)) redirect(safeNext ? `/loja/${slug}/carrinho` : `/loja/${slug}/conta`);
  return <AuthForm slug={slug} mode="login" next={safeNext} />;
}
