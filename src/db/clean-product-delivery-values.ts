import 'dotenv/config';
import { db } from './index';
import { products } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("=== CLEANING PRODUCT DELIVERY VALUES ===");

  // Set real telegramChatId -1004408364902 for testing products
  const channelId = "-1004408364902";

  const allProducts = await db.select().from(products);
  for (const p of allProducts) {
    if (!p.deliveryValue || p.deliveryValue.includes("webgran_oficial") || p.deliveryValue === "null") {
      console.log(`Updating product "${p.title}" (${p.id}) deliveryValue to "${channelId}"...`);
      await db.update(products).set({
        deliveryValue: channelId,
        updatedAt: new Date(),
      }).where(eq(products.id, p.id));
    }
  }

  const updatedProducts = await db.select().from(products);
  for (const p of updatedProducts) {
    console.log(`Product: "${p.title}" | deliveryType: ${p.deliveryType} | deliveryValue: ${p.deliveryValue}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
