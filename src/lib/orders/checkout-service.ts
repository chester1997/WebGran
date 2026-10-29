import { db } from "@/db";
import { products, orders, orderItems, stores, coupons, combos, comboProducts } from "@/db/schema";
import { eq, inArray, and, sql, asc, desc } from "drizzle-orm";
import { paymentService } from "@/lib/payments/payment-service";
import { ComboService } from "@/lib/combos/combo-service";

export interface CheckoutItemInput {
  id: string;
  quantity: number;
  isCombo?: boolean;
  comboId?: string | null;
}

export interface CreateCheckoutInput {
  storeId: string;
  customerId: string;
  storeSlug: string;
  items: CheckoutItemInput[];
  couponCode?: string;
  paymentGateway?: "mercadopago" | "pushinpay" | "syncpay";
  sessionId?: string | null;
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  orderId?: string;
  subtotal?: number;
  discount?: number;
  progressiveDiscount?: number;
  couponDiscount?: number;
  total?: number;
  paymentGateway?: "mercadopago" | "pushinpay" | "syncpay";
  pix?: {
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
  };
}

export class CheckoutService {
  /**
   * Core canonical checkout engine shared between Mini App and Telegram Bot.
   * Performs complete server-side price calculation, progressive promotion evaluation,
   * coupon verification, idempotency checking, and gateway Pix charge generation.
   */
  static async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const {
      storeId,
      customerId,
      storeSlug,
      items,
      couponCode,
      paymentGateway,
      sessionId,
    } = input;

    try {
      if (!storeId || !customerId) {
        return { success: false, error: "Sessão inválida ou cliente não identificado." };
      }

      if (!items || items.length === 0) {
        return { success: false, error: "Carrinho vazio" };
      }

      // 1. Validate store existence and owner
      const storeRecord = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });

      if (!storeRecord || !storeRecord.ownerId) {
        return { success: false, error: "Loja não encontrada." };
      }

      // 2. Validate quantities and item IDs
      for (const item of items) {
        const qty = Math.floor(Number(item.quantity));
        if (isNaN(qty) || qty <= 0) {
          return { success: false, error: "Quantidade inválida para um ou mais itens." };
        }
        if (qty > 99) {
          return { success: false, error: "Quantidade máxima permitida por item é 99." };
        }
        if (!item.id || typeof item.id !== "string") {
          return { success: false, error: "Item inválido no carrinho." };
        }
      }

      const candidateIds = Array.from(new Set(items.map((i) => i.comboId || i.id)));

      // 3. Fetch active products belonging to this store
      const realProducts = await db.query.products.findMany({
        where: and(
          eq(products.storeId, storeId),
          inArray(products.id, candidateIds),
          eq(products.status, "active")
        ),
      });

      // 4. Fetch active combos belonging to this store with component products
      const realCombos = db.query.combos
        ? await db.query.combos.findMany({
            where: and(
              eq(combos.storeId, storeId),
              inArray(combos.id, candidateIds),
              eq(combos.status, "active")
            ),
            with: {
              products: {
                with: {
                  product: true,
                },
                orderBy: [asc(comboProducts.position), asc(comboProducts.createdAt)],
              },
            },
          })
        : [];

      // 5. Check seller max_orders_per_month entitlement
      const { getMonthlyOrderUsage } = await import("@/lib/orders/order-usage-service");
      const { checkLimit } = await import("@/lib/entitlements/entitlement-service");

      const currentUsage = await getMonthlyOrderUsage(storeRecord.ownerId);
      const orderLimitCheck = await checkLimit(storeRecord.ownerId, "max_orders_per_month", currentUsage);
      if (!orderLimitCheck.allowed) {
        return {
          success: false,
          error: `Limite mensal de pedidos atingido para esta loja (${currentUsage}/${orderLimitCheck.limit}). Entre em contato com o suporte da loja.`,
        };
      }

      let subtotal = 0;
      const itemsToInsert: {
        productId: string | null;
        comboId: string | null;
        comboSnapshot: any | null;
        quantity: number;
        unitPrice: string;
        total: string;
      }[] = [];

      for (const item of items) {
        const qty = Math.floor(Number(item.quantity));
        const targetId = item.isCombo && item.comboId ? item.comboId : item.id;

        const matchedCombo = item.isCombo || item.comboId
          ? realCombos.find((c) => c.id === targetId)
          : realCombos.find((c) => c.id === targetId);

        const matchedProduct = !item.isCombo && !item.comboId
          ? realProducts.find((p) => p.id === targetId)
          : null;

        // Discriminate or validate existence
        if (item.isCombo || item.comboId) {
          if (!matchedCombo || matchedCombo.status !== "active") {
            return {
              success: false,
              error: "Combo inexistente, inativo ou pertencente a outra loja.",
            };
          }
        } else if (
          (!matchedProduct || matchedProduct.status !== "active") &&
          (!matchedCombo || matchedCombo.status !== "active")
        ) {
          return {
            success: false,
            error: "Alguns produtos ou combos são inválidos ou estão indisponíveis",
          };
        }

        if (matchedCombo && (item.isCombo || item.comboId || !matchedProduct)) {
          // Validate combo components: must have at least 2 active products belonging to the same store
          if (!matchedCombo.products || matchedCombo.products.length < 2) {
            return {
              success: false,
              error: `O combo "${matchedCombo.title}" deve possuir pelo menos dois produtos participantes.`,
            };
          }

          const invalidComponents = matchedCombo.products.filter(
            (cp) => !cp.product || cp.product.storeId !== storeId || cp.product.status !== "active"
          );

          if (invalidComponents.length > 0) {
            return {
              success: false,
              error: `O combo "${matchedCombo.title}" possui produtos indisponíveis ou pertencentes a outra loja.`,
            };
          }

          const validComponents = matchedCombo.products;
          const normalPrice = validComponents.reduce((acc, cp) => acc + Number(cp.product.price), 0);
          const promoPrice = Number(matchedCombo.price);
          if (isNaN(promoPrice) || promoPrice < 0) {
            return { success: false, error: "Preço inválido para o combo." };
          }

          const savings = Math.max(0, normalPrice - promoPrice);
          const savingsPercentage = normalPrice > 0 ? Math.round((savings / normalPrice) * 100) : 0;
          const totalLine = Math.round(promoPrice * qty * 100) / 100;

          subtotal = Math.round((subtotal + totalLine) * 100) / 100;

          // Frozen immutable snapshot for delivery & historic preservation
          const comboSnapshot = {
            comboId: matchedCombo.id,
            title: matchedCombo.title,
            slug: matchedCombo.slug,
            description: matchedCombo.description || null,
            coverUrl: matchedCombo.coverUrl || null,
            priceAtPurchase: promoPrice.toFixed(2),
            calculatedNormalPrice: normalPrice.toFixed(2),
            savings: savings.toFixed(2),
            savingsPercentage,
            products: validComponents.map((cp) => ({
              id: cp.product.id,
              title: cp.product.title,
              slug: cp.product.slug,
              price: Number(cp.product.price).toFixed(2),
              deliveryType: cp.product.deliveryType || null,
              deliveryValue: cp.product.deliveryValue || null,
              botId: cp.product.botId || null,
            })),
            purchasedAt: new Date().toISOString(),
          };

          itemsToInsert.push({
            productId: null,
            comboId: matchedCombo.id,
            comboSnapshot,
            quantity: qty,
            unitPrice: promoPrice.toFixed(2),
            total: totalLine.toFixed(2),
          });
        } else if (matchedProduct) {
          const unitPrice = Number(matchedProduct.price);
          if (isNaN(unitPrice) || unitPrice < 0) {
            return { success: false, error: "Preço inválido para o produto." };
          }

          const totalLine = Math.round(unitPrice * qty * 100) / 100;
          subtotal = Math.round((subtotal + totalLine) * 100) / 100;

          itemsToInsert.push({
            productId: matchedProduct.id,
            comboId: null,
            comboSnapshot: null,
            quantity: qty,
            unitPrice: unitPrice.toFixed(2),
            total: totalLine.toFixed(2),
          });
        }
      }

      if (itemsToInsert.length !== items.length) {
        return { success: false, error: "Alguns produtos ou combos são inválidos ou estão indisponíveis" };
      }

      // 6. Evaluate progressive promotion server-side
      let progressiveDiscount = 0;
      let progressiveComboId: string | null = null;
      let progressiveComboSnapshot: any = null;

      try {
        const progressiveEval = await ComboService.calculateProgressivePricingForCart(
          storeId,
          itemsToInsert.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: Number(i.unitPrice),
          }))
        );

        if (progressiveEval.discountAmount > 0 && progressiveEval.promotion && progressiveEval.pricingResult) {
          progressiveDiscount = progressiveEval.discountAmount;
          progressiveComboId = progressiveEval.promotion.id;
          progressiveComboSnapshot = progressiveEval.snapshot;
        }
      } catch (err) {
        console.warn("[CheckoutService] Falha ao calcular oferta progressiva:", err);
      }

      // 7. Process Coupon Validation & Discount
      let couponDiscount = 0;
      let appliedCouponCode: string | null = null;
      const baseForCoupon = Math.max(0, subtotal - progressiveDiscount);

      if (couponCode && couponCode.trim()) {
        const cleanCode = couponCode.trim().toUpperCase();
        const foundCoupons = await db
          .select()
          .from(coupons)
          .where(
            and(
              eq(coupons.storeId, storeId),
              sql`UPPER(${coupons.code}) = ${cleanCode}`
            )
          );

        if (foundCoupons.length > 0) {
          const c = foundCoupons[0];
          const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
          const isLimitReached = c.maxUses !== null && c.usedCount >= c.maxUses;
          const minOrder = c.minOrderValue ? parseFloat(c.minOrderValue) : 0;

          if (c.status === "active" && !isExpired && !isLimitReached && baseForCoupon >= minOrder) {
            const discVal = parseFloat(c.discountValue);
            if (c.discountType === "percentage") {
              couponDiscount = (baseForCoupon * discVal) / 100;
            } else {
              couponDiscount = Math.min(baseForCoupon, discVal);
            }
            couponDiscount = Math.round(couponDiscount * 100) / 100;
            appliedCouponCode = c.code;

            // Increment usedCount
            await db
              .update(coupons)
              .set({
                usedCount: c.usedCount + 1,
                updatedAt: new Date(),
              })
              .where(eq(coupons.id, c.id));
          }
        }
      }

      const totalDiscount = Math.round((progressiveDiscount + couponDiscount) * 100) / 100;
      const finalTotal = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

      // 8. Idempotency: check if an active pending order exists for this store & customer with identical items
      const existingPendingOrders = db.query.orders?.findMany
        ? await db.query.orders.findMany({
            where: and(
              eq(orders.storeId, storeId),
              eq(orders.customerId, customerId),
              eq(orders.status, "pending"),
              eq(orders.total, finalTotal.toFixed(2))
            ),
            with: {
              items: true,
            },
            orderBy: [desc(orders.createdAt)],
            limit: 3,
          })
        : [];

      const matchingExistingOrder = existingPendingOrders.find((ord) => {
        if (!ord.pixExpiresAt || new Date(ord.pixExpiresAt) <= new Date()) return false;
        if (!ord.pixQrCode) return false;
        if (!ord.items || ord.items.length !== itemsToInsert.length) return false;

        return itemsToInsert.every((ins) => {
          if (ins.productId) {
            return ord.items.some((oi: any) => oi.productId === ins.productId && oi.quantity === ins.quantity);
          }
          if (ins.comboId) {
            return ord.items.some((oi: any) => oi.comboId === ins.comboId && oi.quantity === ins.quantity);
          }
          return false;
        });
      });

      if (matchingExistingOrder) {
        return {
          success: true,
          orderId: matchingExistingOrder.id,
          subtotal: matchingExistingOrder.subtotal ? parseFloat(matchingExistingOrder.subtotal) : subtotal,
          discount: matchingExistingOrder.discount ? parseFloat(matchingExistingOrder.discount) : totalDiscount,
          progressiveDiscount: matchingExistingOrder.progressiveComboDiscount ? parseFloat(matchingExistingOrder.progressiveComboDiscount) : progressiveDiscount,
          couponDiscount: 0,
          total: finalTotal,
          paymentGateway: (matchingExistingOrder.paymentMethod as any) || "pushinpay",
          pix: {
            qrCode: matchingExistingOrder.pixQrCode || "",
            qrCodeBase64: matchingExistingOrder.pixQrCodeBase64 || "",
            expiresAt: matchingExistingOrder.pixExpiresAt
              ? matchingExistingOrder.pixExpiresAt.toISOString()
              : new Date().toISOString(),
          },
        };
      }

      // 9. Resolve effective seller commission fee at order creation (frozen immutable snapshot)
      const sellerId = storeRecord.ownerId;
      const { SellerCommissionService } = await import('@/lib/commission/seller-commission-service');
      const feeResolution = await SellerCommissionService.resolveEffectiveFee(sellerId, new Date());
      const snapshotSplitAmountCents = feeResolution.effectiveFeeCents;
      let initialSplitStatus = 'PENDING';
      let initialSplitError: string | null = null;

      if (feeResolution.isExempt) {
        initialSplitStatus = 'SKIPPED';
        initialSplitError = 'ISENCAO_TEMPORARIA';
      } else if (snapshotSplitAmountCents === 0) {
        initialSplitStatus = 'SKIPPED';
        initialSplitError = 'COMISSAO_ZERO';
      }

      // 10. CREATE ORDER
      const newOrderArr = await db
        .insert(orders)
        .values({
          storeId,
          customerId,
          status: "pending",
          subtotal: subtotal.toFixed(2),
          discount: totalDiscount.toFixed(2),
          couponCode: appliedCouponCode,
          progressiveComboId,
          progressiveComboDiscount: progressiveDiscount.toFixed(2),
          progressiveComboSnapshot,
          total: finalTotal.toFixed(2),
          currency: "BRL",
          sessionId: sessionId || null,
          splitAmountCents: snapshotSplitAmountCents,
          splitStatus: initialSplitStatus,
          splitError: initialSplitError,
        })
        .returning();

      const newOrder = newOrderArr[0];

      // 11. INSERT ITEMS
      await db.insert(orderItems).values(
        itemsToInsert.map((i) => ({
          orderId: newOrder.id,
          productId: i.productId,
          comboId: i.comboId,
          comboSnapshot: i.comboSnapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        }))
      );

      // 12. Resolve Payment Gateway Connections
      const pushinPayConn = sellerId
        ? await paymentService["pushinPayProvider"].getPushinPayConnection(sellerId, storeId)
        : null;
      const isPushinPayActive = Boolean(pushinPayConn);

      const mpConn = sellerId
        ? await paymentService.getSellerConnection(sellerId)
        : null;
      const isMpActive = Boolean(mpConn);

      let targetGateway: "mercadopago" | "pushinpay" | "syncpay" | null = null;

      if (paymentGateway) {
        if (paymentGateway === "mercadopago") {
          if (!isMpActive) {
            return {
              success: false,
              error: "O Mercado Pago não está conectado ou ativo para esta loja.",
            };
          }
          targetGateway = "mercadopago";
        } else if (paymentGateway === "pushinpay") {
          if (!isPushinPayActive) {
            return {
              success: false,
              error: "A PushinPay não está configurada ou ativa para esta loja.",
            };
          }
          targetGateway = "pushinpay";
        } else if (paymentGateway === "syncpay") {
          return {
            success: false,
            error: "A SyncPay está temporariamente indisponível para esta loja. Utilize o Pix via PushinPay ou Mercado Pago.",
          };
        }
      } else {
        // Auto-select: prioritize PushinPay if configured, otherwise Mercado Pago
        if (isPushinPayActive) {
          targetGateway = "pushinpay";
        } else if (isMpActive) {
          targetGateway = "mercadopago";
        }
      }

      if (!targetGateway) {
        return {
          success: false,
          error: "Esta loja não possui nenhum meio de pagamento ativo configurado no momento (PushinPay ou Mercado Pago).",
        };
      }

      // 1. Process PushinPay PIX
      if (targetGateway === "pushinpay") {
        const pixPayment = await paymentService.createPushinPayPix({
          sellerId: sellerId!,
          storeId: storeRecord.id,
          orderId: newOrder.id,
          amount: finalTotal,
          description: `Pedido #${newOrder.id.slice(0, 8)} - ${storeRecord?.name || "WebGran"}`,
          customer: {
            name: "Cliente Telegram",
            email: "cliente@webgran.app",
          },
        });

        await db
          .update(orders)
          .set({
            paymentId: pixPayment.paymentId,
            paymentMethod: "pushinpay",
            pixQrCode: pixPayment.qrCode,
            pixQrCodeBase64: pixPayment.qrCodeBase64 || "",
            pixExpiresAt: pixPayment.expiresAt,
            status: "pending",
          })
          .where(eq(orders.id, newOrder.id));

        return {
          success: true,
          orderId: newOrder.id,
          subtotal,
          discount: totalDiscount,
          progressiveDiscount,
          couponDiscount,
          total: finalTotal,
          paymentGateway: "pushinpay",
          pix: {
            qrCode: pixPayment.qrCode,
            qrCodeBase64: pixPayment.qrCodeBase64 || "",
            expiresAt: pixPayment.expiresAt.toISOString(),
          },
        };
      }

      // 2. Process SyncPay PIX (if ever reactivated)
      if ((targetGateway as any) === "syncpay") {
        const pixPayment = await paymentService.createSyncPayPix({
          sellerId: sellerId!,
          orderId: newOrder.id,
          amount: finalTotal,
          description: `Pedido #${newOrder.id.slice(0, 8)} - ${storeRecord?.name || "WebGran"}`,
          customer: {
            name: "Cliente Telegram",
            email: "cliente@webgran.app",
          },
        });

        await db
          .update(orders)
          .set({
            paymentId: pixPayment.paymentId,
            paymentMethod: "syncpay",
            pixQrCode: pixPayment.qrCode,
            pixQrCodeBase64: pixPayment.qrCodeBase64 || "",
            pixExpiresAt: pixPayment.expiresAt,
            status: "pending",
          })
          .where(eq(orders.id, newOrder.id));

        return {
          success: true,
          orderId: newOrder.id,
          subtotal,
          discount: totalDiscount,
          progressiveDiscount,
          couponDiscount,
          total: finalTotal,
          paymentGateway: "syncpay",
          pix: {
            qrCode: pixPayment.qrCode,
            qrCodeBase64: pixPayment.qrCodeBase64 || "",
            expiresAt: pixPayment.expiresAt.toISOString(),
          },
        };
      }

      // 3. Process Mercado Pago PIX
      if (targetGateway === "mercadopago") {
        const pixPayment = await paymentService.createPixPayment({
          sellerId: sellerId!,
          orderId: newOrder.id,
          amount: finalTotal,
          description: `Pedido #${newOrder.id.slice(0, 8)} - ${storeRecord?.name || "WebGran"}`,
          customer: {
            name: "Cliente Telegram",
            email: "cliente@webgran.app",
          },
        });

        await db
          .update(orders)
          .set({
            paymentId: pixPayment.paymentId,
            paymentMethod: "mercadopago",
            pixQrCode: pixPayment.qrCode,
            pixQrCodeBase64: pixPayment.qrCodeBase64,
            pixExpiresAt: pixPayment.expiresAt,
          })
          .where(eq(orders.id, newOrder.id));

        return {
          success: true,
          orderId: newOrder.id,
          subtotal,
          discount: totalDiscount,
          progressiveDiscount,
          couponDiscount,
          total: finalTotal,
          paymentGateway: "mercadopago",
          pix: {
            qrCode: pixPayment.qrCode,
            qrCodeBase64: pixPayment.qrCodeBase64,
            expiresAt: pixPayment.expiresAt.toISOString(),
          },
        };
      }

      // REGRA DE SEGURANÇA: Se nenhum gateway estiver ativo ou disponível, o pedido NUNCA pode ser aprovado automaticamente!
      await db
        .update(orders)
        .set({ status: "failed" })
        .where(eq(orders.id, newOrder.id));

      return {
        success: false,
        error:
          "Esta loja não possui nenhum meio de pagamento ativo configurado no momento. Entre em contato com o suporte da loja.",
      };
    } catch (error: any) {
      console.error("[CheckoutService] Checkout error:", error);
      return { success: false, error: error.message || "Erro interno ao processar pedido" };
    }
  }
}
