import { db } from "@/db";
import { combos, comboProducts, products } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

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
      where: and(eq(combos.storeId, storeId), eq(combos.status, "active")),
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
}
