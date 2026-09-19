import 'dotenv/config';
import { db } from './index';
import { orders, accesses, telegramCustomers, stores } from './schema';
import { eq, desc } from 'drizzle-orm';
import { AccessService } from '../lib/orders/access-service';
import { syncOrderWithMercadoPago } from '../lib/payments/order-sync';

async function main() {
  console.log("=== WEBGRAN FASE 8 VERIFICATION TEST ===");

  // 1. Get latest paid order
  const latestPaidOrder = await db.query.orders.findFirst({
    where: eq(orders.status, 'paid'),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
      items: {
        with: {
          product: true
        }
      }
    }
  });

  if (!latestPaidOrder) {
    console.error("Nenhuma order paga encontrada para teste.");
    return;
  }

  console.log(`Testing with Order ID: ${latestPaidOrder.id}`);
  console.log(`Store ID: ${latestPaidOrder.storeId}`);
  console.log(`Customer ID: ${latestPaidOrder.customerId} (${latestPaidOrder.customer?.firstName})`);

  // 2. Query getCustomerAccesses as Meus Acessos does
  const customerAccesses = await AccessService.getCustomerAccesses(
    latestPaidOrder.storeId,
    latestPaidOrder.customerId
  );

  console.log(`\n[Meus Acessos Query Result] Total Accesses returned: ${customerAccesses.length}`);
  for (const acc of customerAccesses) {
    console.log(`- Access ID: ${acc.id}`);
    console.log(`  Product Title: "${acc.product.title}"`);
    console.log(`  Status: ${acc.status}`);
    console.log(`  Delivery Status: ${acc.deliveryStatus}`);
    console.log(`  Invite Link: ${acc.inviteLink || 'N/A'}`);
    console.log(`  Delivery Error: ${acc.deliveryError || 'None'}`);
  }

  if (customerAccesses.length > 0) {
    console.log("\n✅ WEBGRAN FASE 8 PASSED: Accesses exist and are visible in Meus Acessos query!");
  } else {
    console.error("\n❌ WEBGRAN FASE 8 FAILED: Meus Acessos query returned 0 accesses.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
