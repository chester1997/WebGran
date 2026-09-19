import 'dotenv/config';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';
import { db } from './index';
import { accesses } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("=== WEBGRAN FASE 7 DELIVERY TEST ===");

  const targetOrderId = "f6b32494-c53e-464b-97e3-de2e8dc9c80b";
  const storeId = "09596d3e-6f66-4b61-9c09-7e4051190a10";

  // Reset access status to PENDING for testing
  await db.update(accesses).set({
    status: 'PENDING',
    deliveryStatus: 'PENDING',
    inviteLink: null,
    deliveryError: null,
  }).where(eq(accesses.orderId, targetOrderId));

  console.log(`Processing Order Delivery for ${targetOrderId}...`);
  const results = await AccessDeliveryService.processOrderDelivery(targetOrderId);
  console.log("DELIVERY RESULTS:", JSON.stringify(results, null, 2));

  const updatedAccess = await db.query.accesses.findFirst({
    where: eq(accesses.orderId, targetOrderId)
  });
  console.log("UPDATED ACCESS RECORD:", JSON.stringify(updatedAccess, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
