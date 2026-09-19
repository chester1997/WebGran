import 'dotenv/config';
import { db } from './index';
import { orders } from './schema';
import { eq } from 'drizzle-orm';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';

async function testWebhookAndDelivery() {
  const orderId = 'e776a1e1-e013-4113-a90a-3aadce3badd5';
  console.log('--- TESTING WEBHOOK APPROVAL & DELIVERY FOR ORDER:', orderId);

  // Mark order as paid (simulating webhook approval)
  await db.update(orders).set({
    status: 'paid',
    paidAt: new Date(),
    updatedAt: new Date()
  }).where(eq(orders.id, orderId));

  console.log('[1. ORDER STATUS UPDATED TO PAID]');

  // Execute delivery flow
  const results = await AccessDeliveryService.processOrderDelivery(orderId);
  console.log('[2. DELIVERY RESULTS]:', JSON.stringify(results, null, 2));

  // Test Idempotency (re-run processOrderDelivery)
  console.log('--- TESTING IDEMPOTENCY (RE-RUNNING DELIVERY) ---');
  const repeatResults = await AccessDeliveryService.processOrderDelivery(orderId);
  console.log('[3. REPEAT DELIVERY RESULTS]:', JSON.stringify(repeatResults, null, 2));
}

testWebhookAndDelivery().catch(console.error).finally(() => process.exit(0));
