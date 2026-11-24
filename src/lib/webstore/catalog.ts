import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
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

export interface CartPromo {
  title: string;
  savings: number;
  applied: { minQuantity: number; price: number; count: number }[];
  next: { remaining: number; targetQuantity: number; targetPrice: number; current: number } | null;
  tiers: { minQuantity: number; price: number }[];
}

export interface CartQuote {
  lines: {
    id: string;
    isCombo: boolean;
    slug: string;
    title: string;
    coverUrl: string | null;
    price: number;
    quantity: number;
    total: number;
    comboItems?: string[];
    normalPrice?: number;
  }[];
  subtotal: number;
  discount: number;
  promotionTitle: string | null;
  nextTier: string | null;
  promo: CartPromo | null;
  total: number;
}

/** Combos ativos da Loja Web (só com títulos da própria Loja Web). */
export function loadWebCombos(storeId: string) {
  return ComboService.getActiveCombos(storeId, { comboStatus: WEB_ACTIVE, productStatus: WEB_ACTIVE });
}

/** Oferta progressiva ativa da Loja Web (independente da do Mini App). */
export function loadWebProgressive(storeId: string) {
  return ComboService.getActiveProgressivePromotion(storeId, WEB_ACTIVE);
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
  // Só combos da própria Loja Web (o Mini App usa os seus).
  const combos = items.some((l) => l.isCombo) ? await loadWebCombos(storeId).catch(() => []) : [];

  const lines: CartQuote["lines"] = [];
  for (const l of items) {
    if (l.isCombo) {
      const c = combos.find((x) => x.id === l.id);
      if (c)
        lines.push({
          id: c.id,
          isCombo: true,
          slug: c.slug,
          title: c.title,
          coverUrl: c.coverUrl || c.products[0]?.coverUrl || null,
          price: c.price,
          quantity: l.quantity,
          total: c.price * l.quantity,
          comboItems: c.products.map((p) => p.title),
          normalPrice: c.normalPrice,
        });
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
  let promo: CartPromo | null = null;
  try {
    const ev = await ComboService.calculateProgressivePricingForCart(
      storeId,
      lines.map((l) => ({ productId: l.isCombo ? null : l.id, quantity: l.quantity, price: l.price, title: l.title })),
      WEB_ACTIVE
    );
    if (ev.promotion) {
      const tiers = ev.promotion.tiers.map((t) => ({ minQuantity: t.minQuantity, price: t.priceCents / 100 }));
      const r = ev.pricingResult;
      discount = r ? ev.discountAmount : 0;
      promotionTitle = ev.promotion.title;
      const n = r?.nextTierProgress || null;
      const eligibleUnits = r?.totalUnits || 0;
      if (n && n.unitsRemaining > 0) {
        nextTier = `Faltam ${n.unitsRemaining} ${n.unitsRemaining === 1 ? "título" : "títulos"} para liberar ${n.targetQuantity} por ${(n.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}.`;
      }
      promo = {
        title: ev.promotion.title,
        savings: discount,
        applied: (r?.appliedTiers || []).map((a) => ({ minQuantity: a.minQuantity, price: a.priceCents / 100, count: a.count })),
        next:
          n && n.unitsRemaining > 0
            ? { remaining: n.unitsRemaining, targetQuantity: n.targetQuantity, targetPrice: n.targetTierPriceCents / 100, current: Math.max(0, Math.min(eligibleUnits, n.targetQuantity - n.unitsRemaining)) }
            : null,
        tiers,
      };
    }
  } catch {
    // sem promoção
  }
  return { lines, subtotal, discount, promotionTitle, nextTier, promo, total: Math.max(0, Math.round((subtotal - discount) * 100) / 100) };
}
