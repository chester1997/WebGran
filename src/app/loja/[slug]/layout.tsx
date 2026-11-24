import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { getWebBranding } from "@/lib/webstore/settings";
import { getWebAvatar } from "@/lib/webstore/profile";
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
  const [customer, look] = await Promise.all([getWebCustomer(store.id), getWebBranding(store.id)]);
  const name = look.branding.displayName || store.name;
  const avatarUrl = customer ? await getWebAvatar(customer.shadowCustomerId).catch(() => null) : null;
  return (
    <>
      <title>{name}</title>
      <StoreShell
        store={{
          slug: store.slug,
          name,
          logoUrl: look.branding.logoUrl || store.logoUrl,
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
                avatarUrl,
              }
            : null
        }
      >
        {children}
      </StoreShell>
    </>
  );
}
