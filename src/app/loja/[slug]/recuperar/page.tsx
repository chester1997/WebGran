import { notFound } from "next/navigation";
import { getWebStore } from "@/lib/webstore/web-store";
import { RecoverForm } from "./RecoverForm";

export default async function RecuperarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  return <RecoverForm slug={slug} />;
}
