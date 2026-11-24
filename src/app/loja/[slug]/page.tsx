import { notFound } from "next/navigation";
import { getWebCustomer, getWebStore, webTablesReady } from "@/lib/webstore/web-store";
import { buildStorefront } from "@/lib/webstore/sections";
import { ComboService } from "@/lib/combos/combo-service";
import { Storefront, type CardItem } from "./_components/Storefront";
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
  const [front, ready, promo] = await Promise.all([
    buildStorefront(store.id, customer?.shadowCustomerId || null),
    webTablesReady(),
    ComboService.getActiveProgressivePromotion(store.id).catch(() => null),
  ]);

  return (
    <Storefront
      slug={slug}
      storeName={store.name}
      notReady={!ready}
      hero={front.hero.map(card)}
      rows={front.rows.map((r) => ({ key: r.key, kind: r.kind, title: r.title, items: r.items.map(card), progress: r.progress }))}
      promo={
        promo && promo.eligibilityMode === "all_products"
          ? { title: promo.title, tiers: promo.tiers.map((t) => ({ minQuantity: t.minQuantity, price: t.priceCents / 100 })) }
          : null
      }
    />
  );
}
