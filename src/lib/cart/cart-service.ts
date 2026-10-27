import { db } from "@/db";
import { carts, cartItems, products, combos, telegramCustomers } from "@/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { ComboService } from "@/lib/combos/combo-service";
import type { AppliedTierSummary, NextTierProgress } from "@/lib/combos/pricing-engine";

export interface CartItemDTO {
  id: string; // Product or Combo UUID
  slug: string;
  title: string;
  price: number;
  quantity: number;
  coverUrl: string | null;
  storeId: string;
  isCombo?: boolean;
  comboId?: string | null;
  productId?: string | null;
}

export interface CartDTO {
  id: string; // Cart UUID
  storeId: string;
  customerId: string;
  items: CartItemDTO[];
  subtotal: number;
  progressiveDiscount?: number;
  progressivePromotion?: {
    id: string;
    title: string;
    slug: string;
    savings: number;
    savingsPercentage: number;
    appliedTiers: AppliedTierSummary[];
    nextTierProgress: NextTierProgress | null;
  } | null;
  total: number;
  itemCount: number;
}

export class CartService {
  /**
   * Maximum allowed quantity per item in the cart.
   */
  static readonly MAX_ITEM_QUANTITY = 999;

  /**
   * Validates and sanitizes a requested quantity.
   */
  static sanitizeQuantity(rawQuantity: unknown): number {
    const qty = Number(rawQuantity);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
      throw new Error("Quantidade inválida. Deve ser um número inteiro maior ou igual a 1.");
    }
    if (qty > CartService.MAX_ITEM_QUANTITY) {
      throw new Error(`Quantidade máxima permitida é de ${CartService.MAX_ITEM_QUANTITY} unidades por item.`);
    }
    return qty;
  }

  /**
   * Retrieves or creates the active cart record for a given store and customer.
   */
  static async getOrCreateCartRecord(storeId: string, customerId: string) {
    if (!storeId || !customerId) {
      throw new Error("storeId e customerId são obrigatórios para identificar o carrinho.");
    }

    const existingCart = await db.query.carts.findFirst({
      where: and(
        eq(carts.storeId, storeId),
        eq(carts.customerId, customerId)
      ),
    });

    if (existingCart) {
      return existingCart;
    }

    // Attempt to insert with atomic conflict handling
    const [inserted] = await db
      .insert(carts)
      .values({
        storeId,
        customerId,
      })
      .onConflictDoNothing({
        target: [carts.storeId, carts.customerId],
      })
      .returning();

    if (inserted) {
      return inserted;
    }

    // If onConflictDoNothing returned empty, fetch the concurrent record
    const refetched = await db.query.carts.findFirst({
      where: and(
        eq(carts.storeId, storeId),
        eq(carts.customerId, customerId)
      ),
    });

    if (!refetched) {
      throw new Error("Não foi possível inicializar o carrinho no banco de dados.");
    }

    return refetched;
  }

  /**
   * Retrieves the full cart with active products and combos, recalculated prices and item count.
   */
  static async getCart(storeId: string, customerId: string): Promise<CartDTO> {
    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    const itemsWithDetails = await db.query.cartItems.findMany({
      where: eq(cartItems.cartId, cartRecord.id),
      with: {
        product: true,
        combo: true,
      },
    });

    const validItems: CartItemDTO[] = [];
    const orphanItemIdsToDelete: string[] = [];

    for (const item of itemsWithDetails) {
      if (item.comboId) {
        const combo = item.combo;
        if (!combo || combo.storeId !== storeId || combo.status !== "active") {
          orphanItemIdsToDelete.push(item.id);
          continue;
        }

        const unitPrice = Number(combo.price) || 0;
        validItems.push({
          id: combo.id,
          slug: combo.slug,
          title: combo.title,
          price: unitPrice,
          quantity: item.quantity,
          coverUrl: combo.coverUrl || null,
          storeId: combo.storeId,
          isCombo: true,
          comboId: combo.id,
          productId: null,
        });
      } else if (item.productId) {
        const prod = item.product;
        // Filter out deleted, inactive, or mismatched store products
        if (!prod || prod.storeId !== storeId || prod.status !== "active") {
          orphanItemIdsToDelete.push(item.id);
          continue;
        }

        const unitPrice = Number(prod.price) || 0;
        validItems.push({
          id: prod.id,
          slug: prod.slug,
          title: prod.title,
          price: unitPrice,
          quantity: item.quantity,
          coverUrl: prod.coverUrl || prod.bannerUrl || null,
          storeId: prod.storeId,
          isCombo: false,
          comboId: null,
          productId: prod.id,
        });
      } else {
        orphanItemIdsToDelete.push(item.id);
      }
    }

    // Clean up orphans asynchronously if any were detected
    if (orphanItemIdsToDelete.length > 0) {
      db.delete(cartItems)
        .where(inArray(cartItems.id, orphanItemIdsToDelete))
        .catch((err) => console.warn("[CartService] Falha não-bloqueante ao limpar itens órfãos:", err));
    }

    const subtotal = validItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const itemCount = validItems.reduce((acc, curr) => acc + curr.quantity, 0);

    // Avalia promoção progressiva ativa da loja para os produtos elegíveis do carrinho
    let progressiveDiscount = 0;
    let progressivePromotion: CartDTO["progressivePromotion"] = null;

    try {
      const progressiveEval = await ComboService.calculateProgressivePricingForCart(
        storeId,
        validItems.map((vi) => ({
          productId: vi.productId || null,
          quantity: vi.quantity,
          price: vi.price,
          title: vi.title,
        }))
      );

      if (progressiveEval.promotion && progressiveEval.pricingResult) {
        progressiveDiscount = progressiveEval.discountAmount;
        progressivePromotion = {
          id: progressiveEval.promotion.id,
          title: progressiveEval.promotion.title,
          slug: progressiveEval.promotion.slug,
          savings: progressiveEval.discountAmount,
          savingsPercentage: progressiveEval.pricingResult.savingsPercentage,
          appliedTiers: progressiveEval.pricingResult.appliedTiers,
          nextTierProgress: progressiveEval.pricingResult.nextTierProgress,
        };
      }
    } catch (err) {
      console.warn("[CartService] Falha não-bloqueante ao calcular oferta progressiva:", err);
    }

    const finalSubtotal = Math.round(subtotal * 100) / 100;
    const finalTotal = Math.max(0, Math.round((subtotal - progressiveDiscount) * 100) / 100);

    return {
      id: cartRecord.id,
      storeId,
      customerId,
      items: validItems,
      subtotal: finalSubtotal,
      progressiveDiscount,
      progressivePromotion,
      total: finalTotal,
      itemCount,
    };
  }

  /**
   * Adds a product to the customer's cart, incrementing quantity if already present.
   */
  static async addItem(
    storeId: string,
    customerId: string,
    productId: string,
    quantity: number = 1
  ): Promise<CartDTO> {
    const validQty = CartService.sanitizeQuantity(quantity);

    // Validate that product exists, belongs to this store and is active
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.storeId, storeId),
        eq(products.status, "active")
      ),
    });

    if (!product) {
      throw new Error("Produto não encontrado, inativo ou pertencente a outra loja.");
    }

    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    await db
      .insert(cartItems)
      .values({
        cartId: cartRecord.id,
        productId: product.id,
        quantity: validQty,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        targetWhere: sql`${cartItems.productId} IS NOT NULL`,
        set: {
          quantity: sql`LEAST(${CartService.MAX_ITEM_QUANTITY}, ${cartItems.quantity} + ${validQty})`,
          updatedAt: new Date(),
        },
      });

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return CartService.getCart(storeId, customerId);
  }

  /**
   * Adds a combo to the customer's cart, incrementing quantity if already present.
   */
  static async addComboItem(
    storeId: string,
    customerId: string,
    comboId: string,
    quantity: number = 1
  ): Promise<CartDTO> {
    const validQty = CartService.sanitizeQuantity(quantity);

    const combo = await db.query.combos.findFirst({
      where: and(
        eq(combos.id, comboId),
        eq(combos.storeId, storeId),
        eq(combos.status, "active")
      ),
    });

    if (!combo) {
      throw new Error("Combo não encontrado, inativo ou pertencente a outra loja.");
    }

    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    const existingItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, cartRecord.id),
        eq(cartItems.comboId, comboId)
      ),
    });

    if (existingItem) {
      const newQuantity = Math.min(CartService.MAX_ITEM_QUANTITY, existingItem.quantity + validQty);
      await db
        .update(cartItems)
        .set({
          quantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db
        .insert(cartItems)
        .values({
          cartId: cartRecord.id,
          comboId: combo.id,
          productId: null,
          quantity: validQty,
        });
    }

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return CartService.getCart(storeId, customerId);
  }

  /**
   * Sets the exact quantity for a product or combo. If quantity <= 0, the item is removed.
   */
  static async updateItemQuantity(
    storeId: string,
    customerId: string,
    itemId: string,
    quantity: number
  ): Promise<CartDTO> {
    if (quantity <= 0) {
      return CartService.removeItem(storeId, customerId, itemId);
    }

    const validQty = CartService.sanitizeQuantity(quantity);

    // Check if itemId is an active product
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, itemId),
        eq(products.storeId, storeId),
        eq(products.status, "active")
      ),
    });

    let isCombo = false;
    if (!product) {
      // Check if itemId is an active combo
      const combo = await db.query.combos.findFirst({
        where: and(
          eq(combos.id, itemId),
          eq(combos.storeId, storeId),
          eq(combos.status, "active")
        ),
      });

      if (!combo) {
        throw new Error("Item não encontrado, inativo ou pertencente a outra loja.");
      }
      isCombo = true;
    }

    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    const existingItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, cartRecord.id),
        isCombo ? eq(cartItems.comboId, itemId) : eq(cartItems.productId, itemId)
      ),
    });

    if (existingItem) {
      await db
        .update(cartItems)
        .set({
          quantity: validQty,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db
        .insert(cartItems)
        .values({
          cartId: cartRecord.id,
          productId: isCombo ? null : itemId,
          comboId: isCombo ? itemId : null,
          quantity: validQty,
        });
    }

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return CartService.getCart(storeId, customerId);
  }

  /**
   * Removes a product or combo completely from the cart.
   */
  static async removeItem(
    storeId: string,
    customerId: string,
    itemId: string
  ): Promise<CartDTO> {
    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    await db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartRecord.id),
          or(
            eq(cartItems.productId, itemId),
            eq(cartItems.comboId, itemId)
          )
        )
      );

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return CartService.getCart(storeId, customerId);
  }

  /**
   * Clears all items from the customer's cart.
   */
  static async clearCart(storeId: string, customerId: string): Promise<CartDTO> {
    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    await db
      .delete(cartItems)
      .where(eq(cartItems.cartId, cartRecord.id));

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return {
      id: cartRecord.id,
      storeId,
      customerId,
      items: [],
      subtotal: 0,
      total: 0,
      itemCount: 0,
    };
  }

  /**
   * Deterministically migrates and merges local items from browser storage into the server cart.
   * Resolves conflicts by taking the maximum quantity between local and remote state.
   */
  static async syncLocalItems(
    storeId: string,
    customerId: string,
    localItems: Array<{ id?: string; productId?: string; comboId?: string; isCombo?: boolean; quantity: number }>
  ): Promise<CartDTO> {
    if (!Array.isArray(localItems) || localItems.length === 0) {
      return CartService.getCart(storeId, customerId);
    }

    const cartRecord = await CartService.getOrCreateCartRecord(storeId, customerId);

    // Separate candidate product and combo IDs
    const productCandidateIds: string[] = [];
    const comboCandidateIds: string[] = [];

    for (const item of localItems) {
      const targetId = item.comboId || item.productId || item.id;
      if (!targetId || typeof targetId !== "string") continue;

      if (item.isCombo || item.comboId) {
        comboCandidateIds.push(targetId);
      } else {
        productCandidateIds.push(targetId);
      }
    }

    // Fetch verified active products
    const verifiedProducts = productCandidateIds.length > 0
      ? await db.query.products.findMany({
          where: and(
            eq(products.storeId, storeId),
            inArray(products.id, productCandidateIds),
            eq(products.status, "active")
          ),
        })
      : [];

    const productMap = new Map(verifiedProducts.map((p) => [p.id, p]));

    // Fetch verified active combos
    const verifiedCombos = comboCandidateIds.length > 0
      ? await db.query.combos.findMany({
          where: and(
            eq(combos.storeId, storeId),
            inArray(combos.id, comboCandidateIds),
            eq(combos.status, "active")
          ),
        })
      : [];

    const comboMap = new Map(verifiedCombos.map((c) => [c.id, c]));

    // Fetch existing cart items to merge quantities deterministically
    const existingItems = await db.query.cartItems.findMany({
      where: eq(cartItems.cartId, cartRecord.id),
    });

    const existingProductMap = new Map(
      existingItems.filter((i) => Boolean(i.productId)).map((i) => [i.productId!, i])
    );
    const existingComboMap = new Map(
      existingItems.filter((i) => Boolean(i.comboId)).map((i) => [i.comboId!, i])
    );

    for (const localItem of localItems) {
      const targetId = localItem.comboId || localItem.productId || localItem.id;
      if (!targetId) continue;

      let safeQty = 1;
      try {
        safeQty = CartService.sanitizeQuantity(localItem.quantity);
      } catch {
        safeQty = 1;
      }

      if (localItem.isCombo || localItem.comboId || comboMap.has(targetId)) {
        const combo = comboMap.get(targetId);
        if (!combo) continue;

        const existing = existingComboMap.get(combo.id);
        if (existing) {
          const mergedQty = Math.min(CartService.MAX_ITEM_QUANTITY, Math.max(existing.quantity, safeQty));
          if (mergedQty !== existing.quantity) {
            await db
              .update(cartItems)
              .set({ quantity: mergedQty, updatedAt: new Date() })
              .where(eq(cartItems.id, existing.id));
          }
        } else {
          await db.insert(cartItems).values({
            cartId: cartRecord.id,
            comboId: combo.id,
            productId: null,
            quantity: safeQty,
          });
        }
      } else {
        const prod = productMap.get(targetId);
        if (!prod) continue;

        await db
          .insert(cartItems)
          .values({
            cartId: cartRecord.id,
            productId: prod.id,
            quantity: safeQty,
          })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.productId],
            targetWhere: sql`${cartItems.productId} IS NOT NULL`,
            set: {
              quantity: sql`LEAST(${CartService.MAX_ITEM_QUANTITY}, GREATEST(${cartItems.quantity}, ${safeQty}))`,
              updatedAt: new Date(),
            },
          });
      }
    }

    await db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartRecord.id));

    return CartService.getCart(storeId, customerId);
  }

  // =========================================================================
  // TELEGRAM BOT PREPARATION HELPERS
  // =========================================================================

  /**
   * Resolves or registers a customer based on authenticated Telegram user metadata.
   */
  static async getOrCreateCustomer(
    storeId: string,
    telegramUser: {
      id: string | number;
      firstName?: string | null;
      first_name?: string | null;
      lastName?: string | null;
      last_name?: string | null;
      username?: string | null;
      photoUrl?: string | null;
    }
  ) {
    return CartService.getOrCreateCustomerForTelegramUser(storeId, telegramUser);
  }

  static async getOrCreateCustomerForTelegramUser(
    storeId: string,
    telegramUser: {
      id: string | number;
      firstName?: string | null;
      first_name?: string | null;
      lastName?: string | null;
      last_name?: string | null;
      username?: string | null;
      photoUrl?: string | null;
    }
  ) {
    if (!storeId || !telegramUser?.id) {
      throw new Error("storeId e telegramUser.id são obrigatórios.");
    }

    const telegramUserId = String(telegramUser.id).trim();
    const effectiveFirstName = telegramUser.firstName || telegramUser.first_name || "Cliente";
    const effectiveLastName = telegramUser.lastName || telegramUser.last_name || null;

    const existing = await db.query.telegramCustomers.findFirst({
      where: and(
        eq(telegramCustomers.storeId, storeId),
        eq(telegramCustomers.telegramUserId, telegramUserId)
      ),
    });

    if (existing) {
      return existing;
    }

    const [inserted] = await db
      .insert(telegramCustomers)
      .values({
        storeId,
        telegramUserId,
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        username: telegramUser.username || null,
        photoUrl: telegramUser.photoUrl || null,
      })
      .onConflictDoUpdate({
        target: [telegramCustomers.storeId, telegramCustomers.telegramUserId],
        set: {
          firstName: effectiveFirstName,
          lastName: effectiveLastName,
          username: telegramUser.username || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted;
  }

  /**
   * Retrieves cart directly via verified Telegram user identity.
   */
  static async getCartByTelegramUser(storeId: string, telegramUserId: string | number): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.getCart(storeId, customer.id);
  }

  /**
   * Adds an item directly via verified Telegram user identity.
   */
  static async addItemByTelegramUser(
    storeId: string,
    telegramUserId: string | number,
    productId: string,
    quantity: number = 1
  ): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.addItem(storeId, customer.id, productId, quantity);
  }

  /**
   * Adds a combo directly via verified Telegram user identity.
   */
  static async addComboByTelegramUser(
    storeId: string,
    telegramUserId: string | number,
    comboId: string,
    quantity: number = 1
  ): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.addComboItem(storeId, customer.id, comboId, quantity);
  }

  /**
   * Updates an item quantity directly via verified Telegram user identity.
   */
  static async updateQuantityByTelegramUser(
    storeId: string,
    telegramUserId: string | number,
    itemId: string,
    quantity: number
  ): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.updateItemQuantity(storeId, customer.id, itemId, quantity);
  }

  /**
   * Removes an item directly via verified Telegram user identity.
   */
  static async removeItemByTelegramUser(
    storeId: string,
    telegramUserId: string | number,
    itemId: string
  ): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.removeItem(storeId, customer.id, itemId);
  }

  /**
   * Clears cart directly via verified Telegram user identity.
   */
  static async clearCartByTelegramUser(storeId: string, telegramUserId: string | number): Promise<CartDTO> {
    const customer = await CartService.getOrCreateCustomerForTelegramUser(storeId, { id: telegramUserId });
    return CartService.clearCart(storeId, customer.id);
  }
}
