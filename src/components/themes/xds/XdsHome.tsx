import React from "react";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { products, banners, telegramBots, productCarousels } from "@/db/schema";
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import { getStoreBySlug } from "@/lib/store-cache";
import { CatalogResolverService } from "@/lib/products/catalog-resolver";
import { HeroBanner } from "../studio/components/HeroBanner";
import { MiniAppAccent } from "../studio/components/MiniAppAccent";
import { XdsHeader, XdsCategoryChips } from "./XdsHeader";
import { XdsFeatured, XdsPosterRow, XdsCollection, XdsTop15, type XdsProduct } from "./XdsCards";

/**
 * Tela inicial do Tema XDs (Bot → Temas). Em teste: só bots da conta proprietária.
 * Usa os mesmos dados do tema Padrão: banners, categorias, Top 15 e carrosséis.
 * O estilo de cada carrossel (Destaque, cards pequenos/grandes, Coleção) vem de Carrosséis.
 */
export async function XdsHome({
  storeSlug,
  originBotId,
  brandName,
  brandLogoUrl,
  accentColor,
}: {
  storeSlug: string;
  originBotId?: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  accentColor: string | null;
}) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-home-${storeSlug}-${originBotId || "web"}`);

  const store = await getStoreBySlug(storeSlug);
  if (!store) return null;

  const visibleProductIds = await CatalogResolverService.getVisibleProductIds(store.id, originBotId);
  const visibleSet = new Set(visibleProductIds);

  const [storeBanners, carousels, activeBot] = await Promise.all([
    db.query.banners.findMany({
      where: and(eq(banners.storeId, store.id), eq(banners.status, "active")),
      orderBy: [asc(banners.position), desc(banners.createdAt)],
      limit: 5,
    }),
    db.query.productCarousels.findMany({
      where: and(eq(productCarousels.storeId, store.id), eq(productCarousels.status, "active")),
      orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
      with: { items: { orderBy: (items, { asc }) => [asc(items.position)], with: { product: true } } },
    }),
    originBotId
      ? db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, originBotId), eq(telegramBots.storeId, store.id)), columns: { photoUrl: true } })
      : null,
  ]);

  const toProducts = (items: { product: typeof products.$inferSelect | null }[]): XdsProduct[] =>
    items
      .map((i) => i.product)
      .filter((p): p is typeof products.$inferSelect => Boolean(p && p.status === "active" && visibleSet.has(p.id)))
      .map((p) => ({ id: p.id, slug: p.slug, title: p.title, coverUrl: p.coverUrl, bannerUrl: p.bannerUrl, price: p.price }));

  const ranking = carousels.find((c) => c.isRanking);
  const rankingProducts = ranking ? toProducts(ranking.items) : [];
  const standard = carousels
    .filter((c) => !c.isRanking)
    .map((c) => ({ ...c, list: toProducts(c.items) }))
    .filter((c) => c.list.length > 0);

  const featured = standard.filter((c) => c.displayStyle === "featured");
  const rows = standard.filter((c) => c.displayStyle !== "featured");

  // Sem carrosséis: mostra os mais recentes em cards pequenos e grandes
  let fallback: XdsProduct[] = [];
  if (rows.length === 0 && visibleProductIds.length > 0) {
    const recent = await db.query.products.findMany({
      where: and(eq(products.storeId, store.id), eq(products.status, "active"), inArray(products.id, visibleProductIds)),
      orderBy: [desc(products.createdAt)],
      limit: 16,
    });
    fallback = recent.map((p) => ({ id: p.id, slug: p.slug, title: p.title, coverUrl: p.coverUrl, bannerUrl: p.bannerUrl, price: p.price }));
  }

  const name = brandName || store.name;
  const logo = brandLogoUrl || activeBot?.photoUrl || store.logoUrl || null;
  const cats = (store.categories || []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  return (
    <div className="w-full pb-4">
      <MiniAppAccent storeSlug={storeSlug} color={accentColor} />
      <XdsHeader storeSlug={storeSlug} name={name} logoUrl={logo} />
      <XdsCategoryChips storeSlug={storeSlug} categories={cats} />

      <div className="mt-4 space-y-7">
        {/* Destaque: cards grandes passando sozinhos (carrosséis marcados como Destaque) */}
        {featured.length > 0
          ? featured.map((c) => <XdsFeatured key={c.id} storeSlug={storeSlug} products={c.list} seconds={c.autoplaySeconds || 5} />)
          : storeBanners.length > 0 && <HeroBanner storeSlug={storeSlug} banners={storeBanners} intervalSeconds={store.bannerInterval || 5} />}

        {/* Top 15 com emblema */}
        {rankingProducts.length > 0 && (
          <XdsTop15 storeSlug={storeSlug} title={ranking?.name || "Top 15"} products={rankingProducts} badgeColor={ranking?.badgeColor || "#3B82F6"} />
        )}

        {/* Carrosséis na ordem definida pelo vendedor */}
        {rows.map((c) =>
          c.displayStyle === "collection" ? (
            <XdsCollection key={c.id} storeSlug={storeSlug} title={c.name} subtitle={c.subtitle} coverUrl={c.coverImageUrl} products={c.list} />
          ) : (
            <XdsPosterRow key={c.id} storeSlug={storeSlug} title={c.name} products={c.list} size={c.displayStyle === "large" ? "large" : "small"} />
          )
        )}

        {rows.length === 0 && fallback.length > 0 && (
          <>
            <XdsPosterRow storeSlug={storeSlug} title="Novidades" products={fallback.slice(0, 8)} size="small" />
            <XdsPosterRow storeSlug={storeSlug} title="Adicionados recentemente" products={fallback.slice(8)} size="large" />
          </>
        )}
      </div>
    </div>
  );
}
