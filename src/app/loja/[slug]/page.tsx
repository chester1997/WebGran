import { notFound } from "next/navigation";
import { getWebCustomer, getWebStore, webTablesReady } from "@/lib/webstore/web-store";
import { buildStorefront } from "@/lib/webstore/sections";
import { getWebBranding } from "@/lib/webstore/settings";
import { getHeroImages } from "@/lib/webstore/hero-images";
import { loadWebCombos, loadWebProgressive } from "@/lib/webstore/catalog";
import { Storefront, type CardItem, type ComboCard } from "./_components/Storefront";
import type { WebProductRow } from "@/lib/webstore/products";

const card = (p: WebProductRow): CardItem => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  coverUrl: p.coverUrl,
  bannerUrl: p.bannerUrl,
  shortDescription: p.shortDescription,
  price: p.price,
  compareAtPrice: p.compareAtPrice,
  duration: p.duration,
  videoCount: p.videoCount,
  isNew: Date.now() - +p.createdAt < 10 * 86400_000,
});

export default async function LojaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const customer = await getWebCustomer(store.id);
  const [front, ready, promo, look, combos, heroImgs] = await Promise.all([
    buildStorefront(store.id, customer?.shadowCustomerId || null),
    webTablesReady(),
    loadWebProgressive(store.id).catch(() => null),
    getWebBranding(store.id),
    loadWebCombos(store.id).catch(() => []),
    getHeroImages(store.id).catch(() => ({ ready: false, images: {} as Record<string, string> })),
  ]);

  return (
    <Storefront
      slug={slug}
      storeName={look.branding.displayName || store.name}
      promoImage={look.branding.promoImageUrl}
      combos={combos.map(
        (c): ComboCard => ({
          id: c.id,
          title: c.title,
          description: c.description,
          coverUrl: c.coverUrl,
          price: c.price,
          normalPrice: c.normalPrice,
          savingsPercentage: c.savingsPercentage,
          items: c.products.map((p) => ({ title: p.title, coverUrl: p.coverUrl })),
        })
      )}
      notReady={!ready}
      topId={front.rows.find((r) => r.kind === "top15")?.items[0]?.id || null}
      hero={front.hero.map((p) => ({ ...card(p), heroUrl: heroImgs.images[p.id] || null }))}
      rows={front.rows.map((r) => ({ key: r.key, kind: r.kind, title: r.title, items: r.items.map(card), progress: r.progress }))}
      promo={
        promo && promo.eligibilityMode === "all_products"
          ? { title: promo.title, tiers: promo.tiers.map((t) => ({ minQuantity: t.minQuantity, price: t.priceCents / 100 })) }
          : null
      }
    />
  );
}
