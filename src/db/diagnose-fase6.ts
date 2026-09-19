import 'dotenv/config';
import { db } from './index';
import { orders, stores, telegramCustomers, products, orderItems, sellerPaymentConnections } from './schema';
import { eq, like, sql } from 'drizzle-orm';
import { decrypt } from '../lib/encryption';

async function main() {
  console.log("=== WEBGRAN FASE 6 DIAGNOSTIC ===");
  
  // Search for order starting with f6b32494 or all recent orders
  const allOrders = await db.select().from(orders);
  console.log(`Total orders in DB: ${allOrders.length}`);
  
  for (const o of allOrders) {
    console.log(`Order ID: ${o.id} | StoreId: ${o.storeId} | CustomerId: ${o.customerId} | Status: ${o.status} | Total: R$ ${o.total} | PaymentId: ${o.paymentId} | CreatedAt: ${o.createdAt}`);
    if (o.id.startsWith('f6b32494') || o.id.includes('f6b32494')) {
      console.log(">>> MATCHING TARGET ORDER FOUND <<<");
      console.log(JSON.stringify(o, null, 2));
    }
  }

  // Also query Mercado Pago connection for store owner
  const connections = await db.select().from(sellerPaymentConnections);
  console.log(`Seller Payment Connections count: ${connections.length}`);
  for (const c of connections) {
    console.log(`SellerId: ${c.sellerId} | Provider: ${c.provider} | Status: ${c.status} | TokenEncryptedLength: ${c.accessTokenEncrypted?.length}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
