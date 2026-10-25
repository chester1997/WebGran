import crypto from "crypto";
import { db } from "@/db";
import { accesses, orders, orderItems, products, telegramCustomers, telegramBots, stores } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramDeliveryService } from "./telegram-delivery-service";
import { SellerSaleNotificationService } from "@/lib/notifications/seller-sale-notification-service";

export interface DeliveryResult {
  accessId: string;
  status: 'ACTIVE' | 'FAILED' | 'PENDING';
  deliveryStatus: 'DELIVERED' | 'FAILED' | 'PENDING';
  inviteLink?: string;
  error?: string;
  productId?: string;
  isComboComponent?: boolean;
}

export class AccessDeliveryService {
  /**
   * Atomically acquires a delivery lease with a dedicated cryptographic claimToken
   * to ensure single-worker execution of external side-effects (Telegram API).
   *
   * Lease rules:
   * - Succeeds if delivery_status is 'PENDING' or 'FAILED'
   * - Succeeds if delivery_status starts with 'PROCESSING' but older than 30 seconds (stale worker recovery)
   * - Fails if delivery_status is 'DELIVERED' or actively 'PROCESSING' with fresh heartbeats (< 30s)
   */
  static async acquireDeliveryLease(accessId: string, claimToken: string): Promise<boolean> {
    if (typeof (db as any).execute !== 'function') {
      return true;
    }
    try {
      const tokenStatus = `PROCESSING:${claimToken}`;
      const claimResult = await db.execute(sql`
        UPDATE accesses
        SET delivery_status = ${tokenStatus},
            updated_at = NOW()
        WHERE id = ${accessId}
          AND (
            delivery_status = 'PENDING'
            OR delivery_status = 'FAILED'
            OR (delivery_status LIKE 'PROCESSING%' AND updated_at < NOW() - INTERVAL '30 seconds')
          )
        RETURNING id
      `);

      if (!claimResult) {
        return true;
      }

      if (Array.isArray(claimResult)) {
        return claimResult.length > 0;
      } else if (Array.isArray((claimResult as any)?.rows)) {
        return (claimResult as any).rows.length > 0;
      } else {
        const rowCount = Number((claimResult as any)?.rowCount ?? (claimResult as any)?.affectedRows ?? 0);
        return rowCount > 0;
      }
    } catch (err: any) {
      console.error(`[AccessDeliveryService] Failed to acquire delivery lease for access ${accessId}:`, err.message);
      return false;
    }
  }

  /**
   * Periodic heartbeat to refresh updated_at = NOW() while a worker is actively processing.
   * Prevents other concurrent workers from acquiring the lease during long external calls (> 30s).
   */
  static async renewDeliveryLease(accessId: string, claimToken: string): Promise<boolean> {
    if (typeof (db as any).execute !== 'function') {
      return true;
    }
    try {
      const tokenStatus = `PROCESSING:${claimToken}`;
      const result = await db.execute(sql`
        UPDATE accesses
        SET updated_at = NOW()
        WHERE id = ${accessId}
          AND delivery_status = ${tokenStatus}
        RETURNING id
      `);

      if (!result) return true;
      if (Array.isArray(result)) return result.length > 0;
      if (Array.isArray((result as any)?.rows)) return (result as any).rows.length > 0;
      const count = Number((result as any)?.rowCount ?? (result as any)?.affectedRows ?? 0);
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Finalizes delivery success with fencing token verification.
   * Guarantees that a delayed / zombie worker cannot overwrite a newer worker's state.
   */
  static async finalizeDeliverySuccess(
    accessId: string,
    claimToken: string,
    data: {
      inviteLink: string;
      inviteExpiresAt: Date | null;
      grantedAt: Date;
      expiresAt: Date | null;
      confirmationSentAt: Date | null;
    }
  ): Promise<boolean> {
    if (typeof (db as any).execute !== 'function') {
      return true;
    }
    try {
      const tokenStatus = `PROCESSING:${claimToken}`;
      const result = await db.execute(sql`
        UPDATE accesses
        SET status = 'ACTIVE',
            delivery_status = 'DELIVERED',
            invite_link = ${data.inviteLink},
            invite_expires_at = ${data.inviteExpiresAt},
            delivery_error = NULL,
            granted_at = ${data.grantedAt},
            expires_at = ${data.expiresAt},
            confirmation_sent_at = ${data.confirmationSentAt},
            updated_at = NOW()
        WHERE id = ${accessId}
          AND delivery_status = ${tokenStatus}
        RETURNING id
      `);

      if (!result) return true;
      if (Array.isArray(result)) return result.length > 0;
      if (Array.isArray((result as any)?.rows)) return (result as any).rows.length > 0;
      const count = Number((result as any)?.rowCount ?? (result as any)?.affectedRows ?? 0);
      return count > 0;
    } catch (err: any) {
      console.error(`[AccessDeliveryService] Failed to finalize delivery success for access ${accessId}:`, err.message);
      return false;
    }
  }

  /**
   * Finalizes delivery failure with fencing token verification.
   * Guarantees that a delayed / zombie worker cannot mark a newer worker's state as FAILED.
   */
  static async finalizeDeliveryFailure(
    accessId: string,
    claimToken: string,
    errorMsg: string,
    confirmationSentAt: Date | null
  ): Promise<boolean> {
    if (typeof (db as any).execute !== 'function') {
      return true;
    }
    try {
      const tokenStatus = `PROCESSING:${claimToken}`;
      const result = await db.execute(sql`
        UPDATE accesses
        SET status = 'FAILED',
            delivery_status = 'FAILED',
            delivery_error = ${errorMsg},
            confirmation_sent_at = ${confirmationSentAt},
            updated_at = NOW()
        WHERE id = ${accessId}
          AND delivery_status = ${tokenStatus}
        RETURNING id
      `);

      if (!result) return true;
      if (Array.isArray(result)) return result.length > 0;
      if (Array.isArray((result as any)?.rows)) return (result as any).rows.length > 0;
      const count = Number((result as any)?.rowCount ?? (result as any)?.affectedRows ?? 0);
      return count > 0;
    } catch (err: any) {
      console.error(`[AccessDeliveryService] Failed to finalize delivery failure for access ${accessId}:`, err.message);
      return false;
    }
  }

  /**
   * Processes access delivery for all items in an approved Order.
   * Ensures STRICT IDEMPOTENCY: checks if Access already exists for storeId + customerId + productId + orderId.
   */
  static async processOrderDelivery(orderId: string): Promise<DeliveryResult[]> {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        customer: true,
        items: true,
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'paid') {
      console.warn(`[AccessDeliveryService] Order ${orderId} is not in 'paid' status. Skipping delivery.`);
      return [];
    }

    // Strict server-side security gate: Never deliver access without verified paymentMethod and paymentId
    if (!order.paymentMethod || !order.paymentId) {
      console.error(`[AccessDeliveryService] BLOCKED unauthorized delivery attempt for order ${orderId}: order is missing paymentMethod or paymentId.`);
      return [];
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, order.storeId)
    });

    // Multi-tenant check: Get active default bot strictly bound to this store for global products
    const defaultStoreBot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.storeId, order.storeId), eq(telegramBots.status, 'active'))
    });

    const items = order.items || await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id)
    });

    const results: DeliveryResult[] = [];

    for (const item of items) {
      if (!item.productId) {
        // Combo Multi-Product Delivery from Immutable Snapshot
        const snapshot = item.comboSnapshot as any;
        if (!snapshot || typeof snapshot !== 'object') {
          console.error(`[AccessDeliveryService] Missing or invalid comboSnapshot for item ${item.id} in order ${order.id}`);
          results.push({
            accessId: `err-${item.id}`,
            status: 'FAILED',
            deliveryStatus: 'FAILED',
            error: "Snapshot do combo ausente ou inválido no pedido.",
            isComboComponent: true,
          });
          continue;
        }

        const components = snapshot.products;
        if (!Array.isArray(components) || components.length === 0) {
          console.error(`[AccessDeliveryService] Empty components in comboSnapshot for item ${item.id} in order ${order.id}`);
          results.push({
            accessId: `err-${item.id}`,
            status: 'FAILED',
            deliveryStatus: 'FAILED',
            error: "Composição de produtos vazia ou inválida no snapshot do combo.",
            isComboComponent: true,
          });
          continue;
        }

        for (const comp of components) {
          if (!comp || !comp.id) {
            console.error(`[AccessDeliveryService] Component missing id in combo for order ${order.id}`);
            results.push({
              accessId: `err-comp-${item.id}`,
              status: 'FAILED',
              deliveryStatus: 'FAILED',
              error: "Componente do combo sem identificador de produto.",
              isComboComponent: true,
            });
            continue;
          }

          const compProductId = comp.id;

          // Multi-tenant check: ensure component product belongs to order's store
          if (comp.storeId && comp.storeId !== order.storeId) {
            console.error(`[AccessDeliveryService] Multi-tenant violation: component ${compProductId} storeId ${comp.storeId} does not match order storeId ${order.storeId}`);
            results.push({
              accessId: `err-comp-${item.id}`,
              status: 'FAILED',
              deliveryStatus: 'FAILED',
              error: "Violação de isolamento: produto pertence a outra loja.",
              productId: compProductId,
              isComboComponent: true,
            });
            continue;
          }

          // Check live product for latest configuration or fallback to frozen snapshot data
          const liveProduct = await db.query.products.findFirst({
            where: and(eq(products.id, compProductId), eq(products.storeId, order.storeId))
          });

          const productData = {
            id: compProductId,
            storeId: order.storeId,
            title: comp.title || liveProduct?.title || "Produto Combo",
            slug: comp.slug || liveProduct?.slug,
            deliveryType: liveProduct?.deliveryType || comp.deliveryType || 'telegram',
            deliveryValue: liveProduct?.deliveryValue || comp.deliveryValue,
            duration: liveProduct?.duration || null,
            botId: liveProduct?.botId || comp.botId || null,
          };

          // IDEMPOTENCY CHECK
          // Check if an Access record already exists for storeId + customerId + compProductId + orderId
          const existingAccess = await db.query.accesses.findFirst({
            where: and(
              eq(accesses.storeId, order.storeId),
              eq(accesses.customerId, order.customerId),
              eq(accesses.productId, compProductId),
              eq(accesses.orderId, order.id)
            )
          });

          if (existingAccess && existingAccess.status === 'ACTIVE' && existingAccess.deliveryStatus === 'DELIVERED') {
            console.log(`[AccessDeliveryService] Combo component ${compProductId} already DELIVERED for order ${order.id}. Idempotent skip.`);
            results.push({
              accessId: existingAccess.id,
              status: 'ACTIVE',
              deliveryStatus: 'DELIVERED',
              inviteLink: existingAccess.inviteLink || undefined,
              productId: compProductId,
              isComboComponent: true,
            });
            continue;
          }

          // Create or reuse pending/failed access record with atomic claim lease
          let accessRecord = existingAccess;
          let isClaimOwner = false;
          const claimToken = crypto.randomUUID();

          if (accessRecord) {
            isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
            if (!isClaimOwner) {
              console.log(`[AccessDeliveryService] Combo component ${compProductId} already claimed or being processed. Polling for resolution...`);
              for (let i = 0; i < 6; i++) {
                await new Promise(r => setTimeout(r, 400));
                const recheck = await db.query.accesses.findFirst({
                  where: eq(accesses.id, accessRecord.id)
                });
                if (recheck && recheck.status === 'ACTIVE' && recheck.deliveryStatus === 'DELIVERED') {
                  accessRecord = recheck;
                  break;
                }
              }

              if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED') {
                console.log(`[AccessDeliveryService] Combo component ${compProductId} resolved to DELIVERED by concurrent worker. Idempotent skip.`);
                results.push({
                  accessId: accessRecord.id,
                  status: 'ACTIVE',
                  deliveryStatus: 'DELIVERED',
                  inviteLink: accessRecord.inviteLink || undefined,
                  productId: compProductId,
                  isComboComponent: true,
                });
                continue;
              }

              isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
              if (!isClaimOwner) {
                console.warn(`[AccessDeliveryService] Active delivery lease still held by concurrent worker for access ${accessRecord.id}. Skipping duplicate external side effect.`);
                results.push({
                  accessId: accessRecord.id,
                  status: (accessRecord.status || 'PENDING') as any,
                  deliveryStatus: (accessRecord.deliveryStatus || 'PENDING') as any,
                  productId: compProductId,
                  isComboComponent: true,
                });
                continue;
              }
            }
          } else {
            try {
              const inserted = await db.insert(accesses).values({
                storeId: order.storeId,
                customerId: order.customerId,
                productId: compProductId,
                orderId: order.id,
                deliveryType: productData.deliveryType || 'telegram',
                telegramChatId: productData.deliveryValue,
                status: 'PENDING',
                deliveryStatus: `PROCESSING:${claimToken}`,
              }).returning();
              accessRecord = inserted[0];
              isClaimOwner = true;
            } catch (insertErr: any) {
              // Concurrency race: another process inserted simultaneously
              accessRecord = await db.query.accesses.findFirst({
                where: and(
                  eq(accesses.storeId, order.storeId),
                  eq(accesses.customerId, order.customerId),
                  eq(accesses.productId, compProductId),
                  eq(accesses.orderId, order.id)
                )
              });
              if (!accessRecord) throw insertErr;

              isClaimOwner = false;
              for (let i = 0; i < 6; i++) {
                await new Promise(r => setTimeout(r, 400));
                const recheck = await db.query.accesses.findFirst({
                  where: eq(accesses.id, accessRecord.id)
                });
                if (recheck && recheck.status === 'ACTIVE' && recheck.deliveryStatus === 'DELIVERED') {
                  accessRecord = recheck;
                  break;
                }
              }

              if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED') {
                console.log(`[AccessDeliveryService] Combo component ${compProductId} already DELIVERED by concurrent process for order ${order.id}. Idempotent skip.`);
                results.push({
                  accessId: accessRecord.id,
                  status: 'ACTIVE',
                  deliveryStatus: 'DELIVERED',
                  inviteLink: accessRecord.inviteLink || undefined,
                  productId: compProductId,
                  isComboComponent: true,
                });
                continue;
              }

              isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
              if (!isClaimOwner) {
                console.warn(`[AccessDeliveryService] Concurrent worker actively processing access ${accessRecord.id}. Skipping duplicate external side effect.`);
                results.push({
                  accessId: accessRecord.id,
                  status: (accessRecord.status || 'PENDING') as any,
                  deliveryStatus: (accessRecord.deliveryStatus || 'PENDING') as any,
                  productId: compProductId,
                  isComboComponent: true,
                });
                continue;
              }
            }
          }

          // Resolve bot strictly for this component product
          let itemBot = null;
          if (productData.botId) {
            itemBot = await db.query.telegramBots.findFirst({
              where: and(
                eq(telegramBots.id, productData.botId),
                eq(telegramBots.storeId, order.storeId),
                eq(telegramBots.status, 'active')
              )
            });
            if (!itemBot) {
              itemBot = defaultStoreBot;
            }
          } else {
            itemBot = defaultStoreBot;
          }

          // Execute delivery for component
          try {
            const deliveryRes = await AccessDeliveryService.executeSingleDelivery(
              accessRecord,
              productData,
              order.customer,
              itemBot,
              store?.slug,
              claimToken
            );
            results.push({
              ...deliveryRes,
              productId: compProductId,
              isComboComponent: true,
            });
          } catch (compErr: any) {
            const errorMsg = compErr.message || "Falha na entrega do componente do combo.";
            console.error(`[AccessDeliveryService] Delivery error for component ${compProductId} in combo:`, errorMsg);
            results.push({
              accessId: accessRecord.id,
              status: 'FAILED',
              deliveryStatus: 'FAILED',
              error: errorMsg,
              productId: compProductId,
              isComboComponent: true,
            });
          }
        }

        continue;
      }

      const product = await db.query.products.findFirst({
        where: and(eq(products.id, item.productId), eq(products.storeId, order.storeId))
      });

      if (!product) {
        console.error(`[AccessDeliveryService] Product ${item.productId} not found for store ${order.storeId}`);
        continue;
      }

      // IDEMPOTENCY CHECK
      // Check if an Access record already exists for storeId + customerId + productId + orderId
      const existingAccess = await db.query.accesses.findFirst({
        where: and(
          eq(accesses.storeId, order.storeId),
          eq(accesses.customerId, order.customerId),
          eq(accesses.productId, product.id),
          eq(accesses.orderId, order.id)
        )
      });

      if (existingAccess && existingAccess.status === 'ACTIVE' && existingAccess.deliveryStatus === 'DELIVERED') {
        console.log(`[AccessDeliveryService] Access already DELIVERED for order ${order.id}, product ${product.id}. Idempotent skip.`);
        results.push({
          accessId: existingAccess.id,
          status: 'ACTIVE',
          deliveryStatus: 'DELIVERED',
          inviteLink: existingAccess.inviteLink || undefined,
        });
        continue;
      }

      // Create or reuse pending/failed access record with atomic claim lease
      let accessRecord = existingAccess;
      let isClaimOwner = false;
      const claimToken = crypto.randomUUID();

      if (accessRecord) {
        isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
        if (!isClaimOwner) {
          console.log(`[AccessDeliveryService] Product access ${accessRecord.id} already claimed or being processed. Polling for resolution...`);
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 400));
            const recheck = await db.query.accesses.findFirst({
              where: eq(accesses.id, accessRecord.id)
            });
            if (recheck && recheck.status === 'ACTIVE' && recheck.deliveryStatus === 'DELIVERED') {
              accessRecord = recheck;
              break;
            }
          }

          if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED') {
            console.log(`[AccessDeliveryService] Product access ${accessRecord.id} resolved to DELIVERED by concurrent worker. Idempotent skip.`);
            results.push({
              accessId: accessRecord.id,
              status: 'ACTIVE',
              deliveryStatus: 'DELIVERED',
              inviteLink: accessRecord.inviteLink || undefined,
            });
            continue;
          }

          isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
          if (!isClaimOwner) {
            console.warn(`[AccessDeliveryService] Active delivery lease still held by concurrent worker for access ${accessRecord.id}. Skipping duplicate external side effect.`);
            results.push({
              accessId: accessRecord.id,
              status: (accessRecord.status || 'PENDING') as any,
              deliveryStatus: (accessRecord.deliveryStatus || 'PENDING') as any,
            });
            continue;
          }
        }
      } else {
        try {
          const inserted = await db.insert(accesses).values({
            storeId: order.storeId,
            customerId: order.customerId,
            productId: product.id,
            orderId: order.id,
            deliveryType: product.deliveryType || 'telegram',
            telegramChatId: product.deliveryValue,
            status: 'PENDING',
            deliveryStatus: `PROCESSING:${claimToken}`,
          }).returning();
          accessRecord = inserted[0];
          isClaimOwner = true;
        } catch (insertErr: any) {
          // Concurrency race: another process inserted simultaneously
          accessRecord = await db.query.accesses.findFirst({
            where: and(
              eq(accesses.storeId, order.storeId),
              eq(accesses.customerId, order.customerId),
              eq(accesses.productId, product.id),
              eq(accesses.orderId, order.id)
            )
          });
          if (!accessRecord) throw insertErr;

          isClaimOwner = false;
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 400));
            const recheck = await db.query.accesses.findFirst({
              where: eq(accesses.id, accessRecord.id)
            });
            if (recheck && recheck.status === 'ACTIVE' && recheck.deliveryStatus === 'DELIVERED') {
              accessRecord = recheck;
              break;
            }
          }

          if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED') {
            console.log(`[AccessDeliveryService] Access already DELIVERED by concurrent process for order ${order.id}, product ${product.id}. Idempotent skip.`);
            results.push({
              accessId: accessRecord.id,
              status: 'ACTIVE',
              deliveryStatus: 'DELIVERED',
              inviteLink: accessRecord.inviteLink || undefined,
            });
            continue;
          }

          isClaimOwner = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
          if (!isClaimOwner) {
            console.warn(`[AccessDeliveryService] Concurrent worker actively processing access ${accessRecord.id}. Skipping duplicate external side effect.`);
            results.push({
              accessId: accessRecord.id,
              status: (accessRecord.status || 'PENDING') as any,
              deliveryStatus: (accessRecord.deliveryStatus || 'PENDING') as any,
            });
            continue;
          }
        }
      }

      // Resolve bot strictly for this product: if product has botId, use that specific active bot of the store;
      // if botId is null, use the store's global/default active bot.
      let itemBot = null;
      if (product.botId) {
        itemBot = await db.query.telegramBots.findFirst({
          where: and(
            eq(telegramBots.id, product.botId),
            eq(telegramBots.storeId, order.storeId),
            eq(telegramBots.status, 'active')
          )
        });
        if (!itemBot) {
          throw new Error(`Bot vinculado ao produto (${product.botId}) não encontrado ou não está ativo nesta loja.`);
        }
      } else {
        itemBot = defaultStoreBot;
      }

      // Execute Delivery
      const deliveryRes = await AccessDeliveryService.executeSingleDelivery(
        accessRecord,
        product,
        order.customer,
        itemBot,
        store?.slug,
        claimToken
      );

      results.push(deliveryRes);
    }

    // Trigger seller sale notification asynchronously / non-blocking
    try {
      await SellerSaleNotificationService.notifySellerOfSale(orderId);
    } catch (err) {
      console.error("[AccessDeliveryService] Seller notification trigger failed:", err);
    }

    // Trigger seller PWA push notification asynchronously / non-blocking
    try {
      const { SellerPushService } = await import("@/lib/push/seller-push-service");
      await SellerPushService.notifySellerOfSale(orderId);
    } catch (err) {
      console.error("[AccessDeliveryService] Seller push notification trigger failed:", err);
    }

    return results;
  }

  /**
   * Safe retry mechanism for a failed Access delivery without repeating payments or creating duplicate Access records.
   */
  static async retryAccessDelivery(accessId: string, sellerStoreId: string): Promise<DeliveryResult> {
    const accessRecord = await db.query.accesses.findFirst({
      where: and(eq(accesses.id, accessId), eq(accesses.storeId, sellerStoreId)),
      with: {
        customer: true,
        product: true,
      }
    });

    if (!accessRecord) {
      throw new Error("Acesso não encontrado ou sem permissão.");
    }

    if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED') {
      return {
        accessId: accessRecord.id,
        status: 'ACTIVE',
        deliveryStatus: 'DELIVERED',
        inviteLink: accessRecord.inviteLink || undefined,
      };
    }

    const claimToken = crypto.randomUUID();
    const acquired = await AccessDeliveryService.acquireDeliveryLease(accessRecord.id, claimToken);
    if (!acquired) {
      throw new Error("A entrega deste acesso já está sendo processada por outro processo concorrente.");
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, sellerStoreId)
    });

    let productData: any = accessRecord.product;
    if (!productData && accessRecord.orderId) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, accessRecord.orderId),
        with: { items: true },
      });
      if (order?.items) {
        for (const item of order.items) {
          if (item.comboSnapshot && typeof item.comboSnapshot === 'object') {
            const snap = item.comboSnapshot as any;
            const comp = snap.products?.find((p: any) => p.id === accessRecord.productId);
            if (comp) {
              productData = {
                id: comp.id,
                storeId: sellerStoreId,
                title: comp.title,
                slug: comp.slug,
                deliveryType: comp.deliveryType || 'telegram',
                deliveryValue: comp.deliveryValue,
                botId: comp.botId,
              };
              break;
            }
          }
        }
      }
    }

    if (!productData) {
      throw new Error("Produto vinculado ao acesso não encontrado.");
    }

    let itemBot = null;
    const productBotId = productData.botId;
    if (productBotId) {
      itemBot = await db.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, productBotId),
          eq(telegramBots.storeId, sellerStoreId),
          eq(telegramBots.status, 'active')
        )
      });
      if (!itemBot) {
        throw new Error("Bot vinculado ao produto não encontrado ou não está ativo nesta loja.");
      }
    } else {
      itemBot = await db.query.telegramBots.findFirst({
        where: and(eq(telegramBots.storeId, sellerStoreId), eq(telegramBots.status, 'active'))
      });
    }

    return AccessDeliveryService.executeSingleDelivery(
      accessRecord,
      productData,
      accessRecord.customer,
      itemBot,
      store?.slug,
      claimToken
    );
  }

  /**
   * Checks whether all components and items in the delivery results have been successfully DELIVERED.
   */
  static isOrderFullyDelivered(results: DeliveryResult[]): boolean {
    return results.length > 0 && results.every(r => r.deliveryStatus === 'DELIVERED');
  }

  private static async executeSingleDelivery(
    accessRecord: any,
    product: any,
    customer: any,
    bot: any,
    storeSlug?: string,
    claimToken?: string
  ): Promise<DeliveryResult> {
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let isRenewing = false;
    if (claimToken && typeof (db as any).execute === 'function') {
      heartbeatTimer = setInterval(async () => {
        if (isRenewing) return;
        isRenewing = true;
        try {
          await AccessDeliveryService.renewDeliveryLease(accessRecord.id, claimToken);
        } catch {
          // non-blocking
        } finally {
          isRenewing = false;
        }
      }, 5000);
    }

    try {
      if (!bot && product.deliveryType !== 'product_video') {
        throw new Error("Nenhum bot do Telegram está vinculado a esta loja.");
      }

      const telegramChatId = product.deliveryValue ? String(product.deliveryValue).trim() : null;

      if (product.deliveryType !== 'product_video' && (!telegramChatId || telegramChatId === "null" || telegramChatId === "")) {
        throw new Error(
          product.deliveryType === 'telegram' || product.deliveryType === 'TELEGRAM_CHAT'
            ? "Produto sem telegramChatId configurado."
            : "Produto sem link externo configurado."
        );
      }

      const { calculateAccessExpiration } = await import("@/lib/orders/expiration-service");
      const paidAtDate = accessRecord.grantedAt || new Date();
      const accessExpiresAt = calculateAccessExpiration(product.duration, paidAtDate);

      const botToken = bot?.tokenEncrypted ? decrypt(bot.tokenEncrypted) : null;
      let deliveryUrl = accessRecord.inviteLink || '';
      let inviteExpiresAtDate: Date | null = accessRecord.inviteExpiresAt || null;
      let isAlreadyMember = false;

      if (product.deliveryType === 'product_video') {
        let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
        if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
        const appUrl = rawAppUrl.replace(/\/+$/, "");
        deliveryUrl = accessRecord.inviteLink || `${appUrl}/miniapp/${storeSlug || ''}/product/${product.slug || ''}`;
      } else if (product.deliveryType === 'telegram' || product.deliveryType === 'TELEGRAM_CHAT') {
        if (!botToken || !telegramChatId) {
          throw new Error("Configuração do bot ou canal do Telegram inválida.");
        }
        if (telegramChatId.startsWith('http://') || telegramChatId.startsWith('https://')) {
          deliveryUrl = telegramChatId;
        } else {
          // 1. Validate Bot Admin Permissions in Target Chat
          const permCheck = await TelegramDeliveryService.validateBotAndChatPermission(botToken, telegramChatId, bot.botId);
          if (!permCheck.success) {
            throw new Error(`Validação do Telegram Chat (${telegramChatId}) falhou: ${permCheck.error}`);
          }

          // 2. Check if Buyer is Already a Member of the Group/Channel
          if (customer?.telegramUserId) {
            isAlreadyMember = await TelegramDeliveryService.checkBuyerMembership(
              botToken,
              telegramChatId,
              customer.telegramUserId
            );
          }

          if (isAlreadyMember) {
            console.log(`[AccessDeliveryService] Customer ${customer?.telegramUserId} is ALREADY a member of chat ${telegramChatId}.`);
            const cleanedId = telegramChatId.replace('-100', '');
            deliveryUrl = `https://t.me/c/${cleanedId}/1`;
          } else if (!deliveryUrl) {
            // 3. Generate Single-Use Invite Link for New Buyer if no existing link
            const expireTimestamp = accessExpiresAt ? Math.floor(accessExpiresAt.getTime() / 1000) : undefined;
            const invite = await TelegramDeliveryService.createTelegramInvite(
              botToken,
              telegramChatId,
              product.title,
              accessRecord.orderId,
              expireTimestamp
            );
            deliveryUrl = invite.inviteLink;
            if (invite.expireDate) {
              inviteExpiresAtDate = new Date(invite.expireDate * 1000);
            }
          }
        }
      } else {
        deliveryUrl = telegramChatId || '';
      }

      // 4. Send Automated Notification Message to Buyer (Idempotent: check confirmationSentAt)
      let confirmationSent = Boolean(accessRecord.confirmationSentAt);

      if (!confirmationSent && customer && customer.telegramUserId && botToken) {
        try {
          let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
          if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
          const appUrl = rawAppUrl.replace(/\/+$/, "");

          let botUsername = bot?.username ? String(bot.username).replace(/^@/, '') : null;
          if (!botUsername && accessRecord.storeId) {
            const botRecord = await db.query.telegramBots.findFirst({
              where: eq(telegramBots.storeId, accessRecord.storeId)
            });
            if (botRecord?.username) {
              botUsername = botRecord.username.replace(/^@/, '');
            }
          }

          let redirectUrl = "";
          if (product.deliveryType === 'product_video' && accessRecord?.id) {
            redirectUrl = `${appUrl}/miniapp/${storeSlug || ''}?access=${accessRecord.id}`;
          } else {
            redirectUrl = accessRecord?.id ? `${appUrl}/api/telegram/access/redirect?accessId=${accessRecord.id}${storeSlug ? `&storeSlug=${storeSlug}` : ''}` : deliveryUrl;
          }

          // Resolve store support contact URL strictly on server side (multi-tenant isolated)
          let supportContactUrl: string | null = null;
          const targetStoreId = accessRecord.storeId || product?.storeId;
          if (targetStoreId) {
            try {
              const storeRecord = await db.query.stores.findFirst({
                where: eq(stores.id, targetStoreId),
                columns: { supportValue: true }
              });
              if (storeRecord?.supportValue) {
                supportContactUrl = storeRecord.supportValue;
              }
            } catch {
              // Non-blocking fallback
            }
          }

          if (supportContactUrl) {
            await TelegramDeliveryService.sendPaymentConfirmationMessage(
              botToken,
              customer.telegramUserId,
              product.title,
              redirectUrl,
              isAlreadyMember,
              false,
              storeSlug,
              supportContactUrl
            );
          } else {
            await TelegramDeliveryService.sendPaymentConfirmationMessage(
              botToken,
              customer.telegramUserId,
              product.title,
              redirectUrl,
              isAlreadyMember,
              false,
              storeSlug
            );
          }

          confirmationSent = true;
        } catch (msgErr: any) {
          console.error(`[AccessDeliveryService] Erro ao enviar mensagem no bot para ${customer.telegramUserId}:`, msgErr.message);
        }
      }

      const now = new Date();

      // 5. Save Access Record as ACTIVE and DELIVERED with real grantedAt & expiresAt and fencing protection
      let finalized = true;
      if (claimToken && typeof (db as any).execute === 'function') {
        finalized = await AccessDeliveryService.finalizeDeliverySuccess(
          accessRecord.id,
          claimToken,
          {
            inviteLink: deliveryUrl,
            inviteExpiresAt: inviteExpiresAtDate || accessRecord.inviteExpiresAt || null,
            grantedAt: accessRecord.grantedAt || paidAtDate,
            expiresAt: accessExpiresAt,
            confirmationSentAt: confirmationSent ? (accessRecord.confirmationSentAt || now) : null,
          }
        );
      } else {
        await db.update(accesses).set({
          status: 'ACTIVE',
          deliveryStatus: 'DELIVERED',
          inviteLink: deliveryUrl,
          inviteExpiresAt: inviteExpiresAtDate || accessRecord.inviteExpiresAt || null,
          deliveryError: null,
          grantedAt: accessRecord.grantedAt || paidAtDate,
          expiresAt: accessExpiresAt,
          confirmationSentAt: confirmationSent ? (accessRecord.confirmationSentAt || now) : null,
          updatedAt: now,
        }).where(eq(accesses.id, accessRecord.id));
      }

      if (!finalized) {
        console.warn(`[AccessDeliveryService] Worker lost lease ownership for access ${accessRecord.id} (stale write prevented by fencing token).`);
        const latest = await db.query.accesses.findFirst({ where: eq(accesses.id, accessRecord.id) });
        return {
          accessId: accessRecord.id,
          status: (latest?.status || 'ACTIVE') as any,
          deliveryStatus: (latest?.deliveryStatus || 'DELIVERED') as any,
          inviteLink: latest?.inviteLink || deliveryUrl,
        };
      }

      // 6. Structured Audit Log (Section 20)
      console.log(JSON.stringify({
        event: "ACCESS_DELIVERY_SUCCESS",
        orderId: accessRecord.orderId,
        accessId: accessRecord.id,
        storeId: accessRecord.storeId,
        productId: product.id,
        telegramUserId: customer?.telegramUserId,
        telegramChatId: telegramChatId,
        botId: bot?.id || bot?.botId,
        paymentStatus: "paid",
        accessStatus: "ACTIVE",
        deliveryStatus: "DELIVERED",
        confirmationMessageSent: confirmationSent
      }));

      return {
        accessId: accessRecord.id,
        status: 'ACTIVE',
        deliveryStatus: 'DELIVERED',
        inviteLink: deliveryUrl,
      };
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido na entrega de acesso.";
      console.error(`[AccessDeliveryService] Delivery failed for access ${accessRecord.id}:`, errorMsg);

      let confirmationSent = Boolean(accessRecord.confirmationSentAt);

      // Attempt sending failed notification to buyer if not sent yet
      if (!confirmationSent && customer && customer.telegramUserId && bot) {
        try {
          const botToken = decrypt(bot.tokenEncrypted);

          let supportContactUrl: string | null = null;
          const targetStoreId = accessRecord.storeId || product?.storeId;
          if (targetStoreId) {
            try {
              const storeRecord = await db.query.stores.findFirst({
                where: eq(stores.id, targetStoreId),
                columns: { supportValue: true }
              });
              if (storeRecord?.supportValue) {
                supportContactUrl = storeRecord.supportValue;
              }
            } catch {
              // Non-blocking fallback
            }
          }

          if (supportContactUrl) {
            await TelegramDeliveryService.sendPaymentConfirmationMessage(
              botToken,
              customer.telegramUserId,
              product.title,
              "",
              false,
              true,
              storeSlug,
              supportContactUrl
            );
          } else {
            await TelegramDeliveryService.sendPaymentConfirmationMessage(
              botToken,
              customer.telegramUserId,
              product.title,
              "",
              false,
              true,
              storeSlug
            );
          }

          confirmationSent = true;
        } catch {
          // Non-blocking fallback
        }
      }

      const now = new Date();

      // Mark Access as FAILED with fencing protection against delayed writes
      if (claimToken && typeof (db as any).execute === 'function') {
        await AccessDeliveryService.finalizeDeliveryFailure(
          accessRecord.id,
          claimToken,
          errorMsg,
          confirmationSent ? (accessRecord.confirmationSentAt || now) : null
        );
      } else {
        await db.update(accesses).set({
          status: 'FAILED',
          deliveryStatus: 'FAILED',
          deliveryError: errorMsg,
          confirmationSentAt: confirmationSent ? (accessRecord.confirmationSentAt || now) : null,
          updatedAt: now,
        }).where(eq(accesses.id, accessRecord.id));
      }

      // Structured Audit Log (Section 20)
      console.log(JSON.stringify({
        event: "ACCESS_DELIVERY_FAILED",
        orderId: accessRecord.orderId,
        accessId: accessRecord.id,
        storeId: accessRecord.storeId,
        productId: product?.id,
        telegramUserId: customer?.telegramUserId,
        telegramChatId: product?.deliveryValue,
        botId: bot?.id || bot?.botId,
        paymentStatus: "paid",
        accessStatus: "FAILED",
        deliveryStatus: "FAILED",
        confirmationMessageSent: confirmationSent,
        error: errorMsg
      }));

      return {
        accessId: accessRecord.id,
        status: 'FAILED',
        deliveryStatus: 'FAILED',
        error: errorMsg,
      };
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    }
  }
}
