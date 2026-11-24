import { notFound } from "next/navigation";
import { getWebStore, webTablesReady } from "@/lib/webstore/web-store";
import { loadWebCatalog } from "@/lib/webstore/catalog";
import { Storefront } from "./_components/Storefront";

export default async function LojaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const [catalog, ready] = await Promise.all([loadWebCatalog(store.id), webTablesReady()]);
  return (
    <>
      {!ready && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4">
          <p className="rounded-[12px] border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-200">
            Loja Web em teste: rode a migration <b>0028_web_store.sql</b> no Neon para liberar cadastro, login e compras.
          </p>
        </div>
      )}
      <Storefront
        slug={slug}
        storeName={store.name}
        description={store.description || null}
        catalog={catalog}
      />
    </>
  );
}
