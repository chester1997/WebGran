import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { StoreShell } from "./_components/StoreShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LojaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const customer = await getWebCustomer(store.id);
  return (
    <>
      <title>{store.name}</title>
      <StoreShell
        store={{
          slug: store.slug,
          name: store.name,
          logoUrl: store.logoUrl,
          supportType: store.supportType,
          supportValue: store.supportValue,
        }}
        customer={
          customer
            ? {
                name: customer.name,
                email: customer.email,
                whatsapp: customer.whatsapp,
                telegram: customer.telegram,
              }
            : null
        }
      >
        {children}
      </StoreShell>
    </>
  );
}
