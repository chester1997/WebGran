import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { getWebBranding } from "@/lib/webstore/settings";
import { getWebAvatar } from "@/lib/webstore/profile";
import { getStorePwaInfo, storeIconUrl } from "@/lib/webstore/pwa";
import { StoreShell } from "./_components/StoreShell";
import { getActiveVip } from "@/lib/webstore/vip";

/** App próprio da loja: manifest, ícones e títulos do vendedor no lugar dos da plataforma. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  "use cache";
  cacheLife("minutes");
  const { slug } = await params;
  const info = await getStorePwaInfo(slug).catch(() => null);
  if (!info) return { robots: { index: false, follow: false } };
  return {
    robots: { index: false, follow: false },
    manifest: `${info.base}/app.webmanifest`,
    applicationName: info.name,
    appleWebApp: { capable: true, title: info.shortName, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: storeIconUrl(info, "192"), sizes: "192x192", type: "image/png" }],
      apple: [{ url: storeIconUrl(info, "apple-180"), sizes: "180x180", type: "image/png" }],
    },
  };
}

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
  const [avatarUrl, vipActive] = customer
    ? await Promise.all([getWebAvatar(customer.shadowCustomerId).catch(() => null), getActiveVip(store.id, customer.shadowCustomerId).catch(() => null)])
    : [null, null];
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
        vip={Boolean(vipActive)}
      >
        {children}
      </StoreShell>
    </>
  );
}
