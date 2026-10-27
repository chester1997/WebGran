import { db } from "@/db";
import { combos, comboProducts, products, comboTiers } from "@/db/schema";
import { eq, and, asc, desc, ne, or } from "drizzle-orm";
import {
  ProgressivePricingEngine,
  ProgressiveTier,
  PricingItemInput,
  ProgressivePricingResult,
  AppliedTierSummary,
} from "./pricing-engine";

export interface ActiveComboProductDTO {
  id: string;
  title: string;
  price: number;
  coverUrl: string | null;
  position: number;
}

export interface ActiveComboDTO {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  normalPrice: number;
  savings: number;
  savingsPercentage: number;
  products: ActiveComboProductDTO[];
  position: number;
}

export class ComboService {
  /**
   * Retrieves all active combos for a given store, including valid component products
   * and server-verified savings calculations. Combos with fewer than 2 active products
   * are safely filtered out.
   */
  static async getActiveCombos(storeId: string): Promise<ActiveComboDTO[]> {
    if (!storeId) return [];

    const activeCombosFromDb = await db.query.combos.findMany({
      where: and(
        eq(combos.storeId, storeId),
        eq(combos.status, "active"),
        ne(combos.type, "progressive")
      ),
      orderBy: [asc(combos.position), desc(combos.createdAt)],
      with: {
        products: {
          with: {
            product: true,
          },
          orderBy: [asc(comboProducts.position)],
        },
      },
    });

    const result: ActiveComboDTO[] = [];

    for (const combo of activeCombosFromDb) {
      // Filter component products ensuring they belong to this store and are currently active
      const validProducts: ActiveComboProductDTO[] = (combo.products || [])
        .filter(
          (cp) =>
            cp.product &&
            cp.product.storeId === storeId &&
            cp.product.status === "active"
        )
        .map((cp) => ({
          id: cp.product.id,
          title: cp.product.title,
          price: Number(cp.product.price) || 0,
          coverUrl: cp.product.coverUrl || cp.product.bannerUrl || null,
          position: cp.position,
        }));

      // Combos must have at least 2 active component products to be offered
      if (validProducts.length < 2) {
        continue;
      }

      const normalPrice = validProducts.reduce((sum, p) => sum + p.price, 0);
      const promoPrice = Number(combo.price) || 0;
      const savings = Math.max(0, normalPrice - promoPrice);
      const savingsPercentage =
        normalPrice > 0 && promoPrice < normalPrice
          ? Math.round((savings / normalPrice) * 100)
          : 0;

      result.push({
        id: combo.id,
        storeId: combo.storeId,
        title: combo.title,
        slug: combo.slug,
        description: combo.description,
        coverUrl: combo.coverUrl,
        price: promoPrice,
        normalPrice: Math.round(normalPrice * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercentage,
        products: validProducts,
        position: combo.position,
      });
    }

    return result;
  }

  /**
   * Retrieves a specific active combo by its unique slug or ID within a store.
   */
  static async getActiveComboBySlug(
    storeId: string,
    slugOrId: string
  ): Promise<ActiveComboDTO | null> {
    if (!storeId || !slugOrId) return null;

    const combosList = await ComboService.getActiveCombos(storeId);
    return (
      combosList.find(
        (c) => c.slug === slugOrId || c.id === slugOrId
      ) || null
    );
  }

  /**
   * Retrieves the active progressive promotion for a given store, including its configured tiers
   * and eligible products list (if in specific_products mode).
   */
  static async getActiveProgressivePromotion(storeId: string): Promise<ActiveProgressivePromotionDTO | null> {
    if (!storeId) return null;

    const promoRecord = db.query.combos?.findFirst
      ? await db.query.combos.findFirst({
          where: and(
            eq(combos.storeId, storeId),
            eq(combos.status, "active"),
            eq(combos.type, "progressive")
          ),
          orderBy: [asc(combos.position), desc(combos.createdAt)],
          with: {
            tiers: {
              orderBy: [asc(comboTiers.minQuantity)],
            },
            products: true,
          },
        })
      : null;

    if (!promoRecord || !promoRecord.tiers || promoRecord.tiers.length === 0) {
      return null;
    }

    const mappedTiers: ProgressiveTier[] = promoRecord.tiers.map((t) => ({
      id: t.id,
      minQuantity: t.minQuantity,
      priceCents: Math.round(Number(t.price) * 100),
    }));

    try {
      ProgressivePricingEngine.validateTiers(mappedTiers);
    } catch (err) {
      console.warn(`[ComboService] Faixas progressivas inválidas na loja ${storeId}:`, err);
      return null;
    }

    const eligibleProductIds = (promoRecord.products || []).map((cp) => cp.productId);

    return {
      id: promoRecord.id,
      storeId: promoRecord.storeId,
      title: promoRecord.title,
      slug: promoRecord.slug,
      description: promoRecord.description,
      eligibilityMode: (promoRecord.eligibilityMode as "all_products" | "specific_products") || "all_products",
      eligibleProductIds,
      tiers: mappedTiers,
    };
  }

  /**
   * Evaluates progressive pricing for a given cart or items list against the store's active progressive offer.
   */
  static async calculateProgressivePricingForCart(
    storeId: string,
    items: { productId: string | null; quantity: number; price: number; title?: string }[]
  ): Promise<ProgressivePricingEvaluation> {
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return {
        hasPromotion: false,
        discountAmount: 0,
        pricingResult: null,
        promotion: null,
        snapshot: null,
      };
    }

    const promotion = await ComboService.getActiveProgressivePromotion(storeId);
    if (!promotion) {
      return {
        hasPromotion: false,
        discountAmount: 0,
        pricingResult: null,
        promotion: null,
        snapshot: null,
      };
    }

    // Filter items: only products (not legacy combos) and eligible products
    const eligibleCartItems = items.filter((item) => {
      if (!item.productId) return false;
      if (promotion.eligibilityMode === "specific_products") {
        return promotion.eligibleProductIds.includes(item.productId);
      }
      return true;
    });

    if (eligibleCartItems.length === 0) {
      return {
        hasPromotion: false,
        discountAmount: 0,
        pricingResult: null,
        promotion,
        snapshot: null,
      };
    }

    // Expand items by quantity into individual pricing units
    const pricingUnits: PricingItemInput[] = [];
    for (const item of eligibleCartItems) {
      const qty = Math.max(0, Math.floor(item.quantity));
      const priceCents = Math.round(Number(item.price) * 100);
      for (let i = 0; i < qty; i++) {
        pricingUnits.push({
          id: `${item.productId}_u${i}`,
          priceCents,
          title: item.title,
        });
      }
    }

    if (pricingUnits.length === 0) {
      return {
        hasPromotion: false,
        discountAmount: 0,
        pricingResult: null,
        promotion,
        snapshot: null,
      };
    }

    const pricingResult = ProgressivePricingEngine.calculate(pricingUnits, promotion.tiers);
    const discountAmount = Math.round(pricingResult.savingsCents) / 100;

    const snapshot: ProgressiveComboOrderSnapshot = {
      comboId: promotion.id,
      title: promotion.title,
      slug: promotion.slug,
      eligibilityMode: promotion.eligibilityMode,
      totalUnits: pricingResult.totalUnits,
      coveredUnits: pricingResult.coveredUnits,
      regularUnits: pricingResult.regularUnits,
      regularSubtotalCents: pricingResult.regularSubtotalCents,
      finalPriceCents: pricingResult.finalPriceCents,
      savingsCents: pricingResult.savingsCents,
      savingsPercentage: pricingResult.savingsPercentage,
      appliedTiers: pricingResult.appliedTiers,
      eligibleProducts: promotion.eligibilityMode === "specific_products" ? promotion.eligibleProductIds : "all_products",
      purchasedAt: new Date().toISOString(),
    };

    return {
      hasPromotion: discountAmount > 0 || Boolean(pricingResult.nextTierProgress),
      discountAmount,
      pricingResult,
      promotion,
      snapshot,
    };
  }
}

export interface ActiveProgressivePromotionDTO {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  eligibilityMode: "all_products" | "specific_products";
  eligibleProductIds: string[];
  tiers: ProgressiveTier[];
}

export interface ProgressiveComboOrderSnapshot {
  comboId: string;
  title: string;
  slug: string;
  eligibilityMode: "all_products" | "specific_products";
  totalUnits: number;
  coveredUnits: number;
  regularUnits: number;
  regularSubtotalCents: number;
  finalPriceCents: number;
  savingsCents: number;
  savingsPercentage: number;
  appliedTiers: AppliedTierSummary[];
  eligibleProducts: string[] | "all_products";
  purchasedAt: string;
}

export interface ProgressivePricingEvaluation {
  hasPromotion: boolean;
  discountAmount: number;
  pricingResult: ProgressivePricingResult | null;
  promotion: ActiveProgressivePromotionDTO | null;
  snapshot: ProgressiveComboOrderSnapshot | null;
}
