import 'dotenv/config';
import { db } from './index';
import { stores, sellerPaymentConnections, telegramBots, products, orders } from './schema';

async function main() {
  console.log('--- DATABASE DIAGNOSTIC AUDIT ---');
  
  const allStores = await db.select().from(stores);
  console.log('STORES COUNT:', allStores.length);
  for (const s of allStores) {
    console.log(`- Store: ${s.name} (${s.slug}) | Owner: ${s.ownerId}`);
  }

  const allConns = await db.select().from(sellerPaymentConnections);
  console.log('SELLER MP CONNECTIONS COUNT:', allConns.length);
  for (const c of allConns) {
    console.log(`- Connection: Seller ${c.sellerId} | Provider: ${c.provider} | Status: ${c.status} | HasToken: ${!!c.accessTokenEncrypted}`);
  }

  const allBots = await db.select().from(telegramBots);
  console.log('TELEGRAM BOTS COUNT:', allBots.length);
  for (const b of allBots) {
    console.log(`- Bot: @${b.username} | Store: ${b.storeId} | Status: ${b.status}`);
  }

  const allProducts = await db.select().from(products);
  console.log('PRODUCTS COUNT:', allProducts.length);
  for (const p of allProducts) {
    console.log(`- Product: ${p.title} | Price: R$ ${p.price} | Store: ${p.storeId} | DeliveryType: ${p.deliveryType}`);
  }

  const allOrders = await db.select().from(orders);
  console.log('ORDERS COUNT:', allOrders.length);
}

main().catch(console.error).finally(() => process.exit(0));
