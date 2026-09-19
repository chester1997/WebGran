import 'dotenv/config';
import { db } from './index';
import { accesses, products } from './schema';
import { eq } from 'drizzle-orm';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';

async function testCleanDelivery() {
  const orderId = 'e776a1e1-e013-4113-a90a-3aadce3badd5';

  // Clean old accesses for this test order
  await db.delete(accesses).where(eq(accesses.orderId, orderId));

  // Update product delivery value to valid link
  await db.update(products).set({
    deliveryType: 'link',
    deliveryValue: 'https://t.me/webgran_oficial'
  }).where(eq(products.id, '81635b4f-54b5-447f-94d2-0b4c6df53188'));

  console.log('[1. RUNNING ACCESS DELIVERY PROCESS]');
  const results = await AccessDeliveryService.processOrderDelivery(orderId);
  console.log('[DELIVERY RESULTS]:', JSON.stringify(results, null, 2));

  console.log('[2. RUNNING IDEMPOTENCY SECOND CALL]');
  const repeatResults = await AccessDeliveryService.processOrderDelivery(orderId);
  console.log('[REPEAT DELIVERY RESULTS]:', JSON.stringify(repeatResults, null, 2));
}

testCleanDelivery().catch(console.error).finally(() => process.exit(0));
