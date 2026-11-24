import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, banners } from "@/db/schema";
import { ComboService } from "@/lib/combos/combo-service";
import { WEB_ACTIVE } from "./scope";

export interface WebProduct {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  categoryId: string | null;
  deliveryType: string;
  duration: string | null;
}

export interface WebCombo {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  normalPrice: number;
  savingsPercentage: number;
  products: { id: string; title: string; coverUrl: string | null }[];
}

const toProduct = (p: typeof products.$inferSelect): WebProduct => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  shortDescription: p.shortDescription,
  description: p.description,
  coverUrl: p.coverUrl || p.bannerUrl || null,
  bannerUrl: p.bannerUrl,
  price: Number(p.price) || 0,
  compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
  badge: p.badge,
  categoryId: p.categoryId,
  deliveryType: p.deliveryType || "telegram",
  duration: p.duration,
});

/** Vitrine: produtos ativos, combos, categorias, banners e promoção progressiva. */
export async function loadWebCatalog(storeId: string) {
  const [prods, cats, bans, combos, promo] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(products.storeId, storeId), eq(products.status, "active")),
      orderBy: [asc(products.position), desc(products.createdAt)],
    }),
    db.query.categories.findMany({
      where: and(eq(categories.storeId, storeId), eq(categories.status, "active")),
      orderBy: [asc(categories.position)],
    }),
    db.query.banners.findMany({
      where: and(eq(banners.storeId, storeId), eq(banners.status, "active")),
      orderBy: [asc(banners.position)],
    }),
    ComboService.getActiveCombos(storeId).catch(() => []),
    ComboService.getActiveProgressivePromotion(storeId).catch(() => null),
  ]);
  const productList = prods.map(toProduct);
  const usedCats = new Set(productList.map((p) => p.categoryId).filter(Boolean));
  return {
    products: productList,
    categories: cats.filter((c) => usedCats.has(c.id)).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    banners: bans.map((b) => ({ id: b.id, title: b.title, imageUrl: b.imageUrl })),
    combos: combos.map(
      (c): WebCombo => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        coverUrl: c.coverUrl,
        price: c.price,
        normalPrice: c.normalPrice,
        savingsPercentage: c.savingsPercentage,
        products: c.products.map((p) => ({ id: p.id, title: p.title, coverUrl: p.coverUrl })),
      })
    ),
    promotion: promo
      ? {
          title: promo.title,
          tiers: promo.tiers.map((t) => ({ minQuantity: t.minQuantity, price: t.priceCents / 100 })),
          allProducts: promo.eligibilityMode === "all_products",
          productIds: promo.eligibleProductIds,
        }
      : null,
  };
}

export async function loadWebProduct(storeId: string, slug: string) {
  const p = await db.query.products.findFirst({
    where: and(eq(products.storeId, storeId), eq(products.slug, slug), eq(products.status, WEB_ACTIVE)),
  });
  return p ? toProduct(p) : null;
}

export interface CartLine {
  id: string;
  isCombo: boolean;
  quantity: number;
}

export interface CartQuote {
  lines: { id: string; isCombo: boolean; slug: string; title: string; coverUrl: string | null; price: number; quantity: number; total: number }[];
  subtotal: number;
  discount: number;
  promotionTitle: string | null;
  nextTier: string | null;
  total: number;
}

/** Recalcula o carrinho no servidor (preço real + promoção progressiva). Itens inválidos somem. */
export async function quoteCart(storeId: string, raw: CartLine[]): Promise<CartQuote> {
  const items = (Array.isArray(raw) ? raw : [])
    .filter((l) => l && typeof l.id === "string" && /^[0-9a-f-]{36}$/i.test(l.id))
    .map((l) => ({ id: l.id, isCombo: Boolean(l.isCombo), quantity: Math.min(99, Math.max(1, Math.floor(Number(l.quantity) || 1))) }))
    .slice(0, 50);

  const prodIds = items.filter((l) => !l.isCombo).map((l) => l.id);
  const prods = prodIds.length
    ? await db.query.products.findMany({ where: and(eq(products.storeId, storeId), inArray(products.id, prodIds), eq(products.status, WEB_ACTIVE)) })
    : [];
  // Combos do Mini App usam produtos dos bots; na Loja Web só entram produtos da própria loja.
  const combos: Awaited<ReturnType<typeof ComboService.getActiveCombos>> = [];

  const lines: CartQuote["lines"] = [];
  for (const l of items) {
    if (l.isCombo) {
      const c = combos.find((x) => x.id === l.id);
      if (c) lines.push({ id: c.id, isCombo: true, slug: c.slug, title: c.title, coverUrl: c.coverUrl, price: c.price, quantity: l.quantity, total: c.price * l.quantity });
    } else {
      const p = prods.find((x) => x.id === l.id);
      if (p) {
        const price = Number(p.price) || 0;
        lines.push({ id: p.id, isCombo: false, slug: p.slug, title: p.title, coverUrl: p.coverUrl || p.bannerUrl || null, price, quantity: l.quantity, total: price * l.quantity });
      }
    }
  }

  const subtotal = Math.round(lines.reduce((a, l) => a + l.total, 0) * 100) / 100;
  let discount = 0;
  let promotionTitle: string | null = null;
  let nextTier: string | null = null;
  try {
    const ev = await ComboService.calculateProgressivePricingForCart(
      storeId,
      lines.map((l) => ({ productId: l.isCombo ? null : l.id, quantity: l.quantity, price: l.price, title: l.title }))
    );
    if (ev.promotion && ev.pricingResult) {
      discount = ev.discountAmount;
      promotionTitle = ev.promotion.title;
      const n = ev.pricingResult.nextTierProgress;
      if (n && n.unitsRemaining > 0) {
        nextTier = `Adicione mais ${n.unitsRemaining} ${n.unitsRemaining === 1 ? "item" : "itens"} e libere a próxima faixa de desconto.`;
      }
    }
  } catch {
    // sem promoção
  }
  return { lines, subtotal, discount, promotionTitle, nextTier, total: Math.max(0, Math.round((subtotal - discount) * 100) / 100) };
}
