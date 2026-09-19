import 'dotenv/config';
import { db } from './index';
import { products } from './schema';

async function main() {
  const allProducts = await db.select().from(products);
  console.log("=== PRODUCTS DELIVERY VALUE AUDIT ===");
  for (const p of allProducts) {
    console.log(`Product ID: ${p.id} | Title: "${p.title}" | deliveryType: "${p.deliveryType}" | deliveryValue: "${p.deliveryValue}"`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
