import 'dotenv/config';
import { db } from './index';
import { orders, orderItems, products, accesses, telegramCustomers, stores, users } from './schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  console.log("=== WEBGRAN FASE 8 DIAGNOSTIC AUDIT ===");

  const allOrders = await db.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    with: {
      items: {
        with: {
          product: true
        }
      },
      customer: true
    }
  });

  console.log(`Total Orders in DB: ${allOrders.length}`);
  for (const o of allOrders) {
    console.log(`\n--------------------------------------------------`);
    console.log(`ORDER ID: ${o.id}`);
    console.log(`StoreId: ${o.storeId}`);
    console.log(`CustomerId (Order.customerId): ${o.customerId}`);
    console.log(`Status: ${o.status}`);
    console.log(`Total: R$ ${o.total}`);
    console.log(`PaymentId: ${o.paymentId}`);
    console.log(`PaidAt: ${o.paidAt}`);
    console.log(`CreatedAt: ${o.createdAt}`);

    if (o.customer) {
      console.log(`Customer Record (telegramCustomers): ID=${o.customer.id}, telegramUserId="${o.customer.telegramUserId}", firstName="${o.customer.firstName}", username="${o.customer.username}"`);
    } else {
      console.log(`Customer Record NOT FOUND for customerId ${o.customerId}!`);
    }

    if (o.items && o.items.length > 0) {
      for (const item of o.items) {
        console.log(`  OrderItem: ID=${item.id}, ProductId=${item.productId}, Quantity=${item.quantity}, UnitPrice=R$ ${item.unitPrice}`);
        if (item.product) {
          console.log(`    Product: Title="${item.product.title}", deliveryType="${item.product.deliveryType}", deliveryValue="${item.product.deliveryValue}"`);
        }
      }
    } else {
      console.log(`  No OrderItems found for order ${o.id}!`);
    }

    // Find accesses for this order
    const orderAccesses = await db.query.accesses.findMany({
      where: eq(accesses.orderId, o.id),
      with: {
        product: true,
        customer: true
      }
    });

    console.log(`  Accesses Count for Order: ${orderAccesses.length}`);
    for (const a of orderAccesses) {
      console.log(`    Access: ID=${a.id}, customerId=${a.customerId}, status="${a.status}", deliveryStatus="${a.deliveryStatus}", inviteLink="${a.inviteLink}", deliveryError="${a.deliveryError}"`);
    }
  }

  console.log(`\n=== ALL TELEGRAM CUSTOMERS ===`);
  const allCustomers = await db.select().from(telegramCustomers);
  for (const c of allCustomers) {
    console.log(`Customer: ID=${c.id}, storeId=${c.storeId}, telegramUserId="${c.telegramUserId}", firstName="${c.firstName}"`);
  }

  console.log(`\n=== ALL ACCESSES IN DB ===`);
  const allAccesses = await db.query.accesses.findMany({
    with: {
      customer: true,
      product: true
    }
  });
  for (const a of allAccesses) {
    console.log(`Access: ID=${a.id}, storeId=${a.storeId}, customerId=${a.customerId}, orderId=${a.orderId}, productId=${a.productId}, status="${a.status}", deliveryStatus="${a.deliveryStatus}", inviteLink="${a.inviteLink}", deliveryError="${a.deliveryError}"`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
