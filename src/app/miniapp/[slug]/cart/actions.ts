"use server";

import { db } from "@/db";
import { products, orders, orderItems } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessService } from "@/lib/orders/access-service";

export async function createCheckoutSession(storeSlug: string, items: { id: string, quantity: number }[]) {
  try {
    const session = await getMiniAppSession();
    if (!session) {
      return { success: false, error: "Sessão não encontrada. Reinicie o Mini App." };
    }

    const { customerId, storeId } = session;

    if (!items || items.length === 0) {
      return { success: false, error: "Carrinho vazio" };
    }

    const productIds = items.map(i => i.id);
    
    // Fetch real products from DB for this store
    const realProducts = await db.query.products.findMany({
      where: and(
        eq(products.storeId, storeId),
        inArray(products.id, productIds),
        eq(products.status, 'active')
      )
    });

    if (realProducts.length !== items.length) {
      return { success: false, error: "Alguns produtos são inválidos ou estão indisponíveis" };
    }

    let subtotal = 0;
    const itemsToInsert = [];

    for (const item of items) {
      const realProduct = realProducts.find(p => p.id === item.id);
      if (!realProduct) continue;
      
      const qty = item.quantity;
      const unitPrice = Number(realProduct.price);
      const totalLine = unitPrice * qty;
      
      subtotal += totalLine;

      itemsToInsert.push({
        productId: realProduct.id,
        quantity: qty,
        unitPrice: unitPrice.toString(),
        total: totalLine.toString()
      });
    }

    // CREATE ORDER
    const newOrderArr = await db.insert(orders).values({
      storeId,
      customerId,
      status: 'pending', // PENDING, PAID, FAILED, CANCELLED, REFUNDED
      subtotal: subtotal.toString(),
      discount: '0',
      total: subtotal.toString(),
      currency: 'BRL'
    }).returning();

    const newOrder = newOrderArr[0];

    // INSERT ITEMS
    await db.insert(orderItems).values(
      itemsToInsert.map(i => ({
        orderId: newOrder.id,
        ...i
      }))
    );

    // TODO: Connect to Payment Gateway here.
    // For now, SIMULATE payment confirmation:
    
    await db.update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, newOrder.id));

    // GRANT ACCESS (Since it's digital products)
    for (const item of itemsToInsert) {
      await AccessService.grantAccess(storeId, customerId, item.productId, newOrder.id);
    }

    return { success: true, orderId: newOrder.id };
  } catch (error) {
    console.error("Checkout error:", error);
    return { success: false, error: "Erro interno ao processar pedido" };
  }
}
