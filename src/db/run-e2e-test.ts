import 'dotenv/config';
import { db } from './index';
import { stores, telegramBots, products, orders, orderItems, telegramCustomers } from './schema';
import { eq } from 'drizzle-orm';
import { paymentService } from '../lib/payments/payment-service';

async function e2eTest() {
  console.log('=== STARTING E2E TEST ===');

  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, 'loja-teste-5737')
  });
  if (!store) throw new Error('Store not found');
  console.log('[1. STORE FOUND]:', store.id, store.name);

  const conn = await paymentService.getSellerConnection(store.ownerId);
  console.log('[2. SELLER MP CONN]:', conn ? 'ACTIVE' : 'MISSING');

  const bot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id)
  });
  console.log('[3. TELEGRAM BOT]:', bot ? bot.username : 'MISSING');

  const product = await db.query.products.findFirst({
    where: eq(products.storeId, store.id)
  });
  if (!product) throw new Error('Product not found');
  console.log('[4. PRODUCT FOUND]:', product.id, product.title, 'Price:', product.price);

  let customer = await db.query.telegramCustomers.findFirst({
    where: eq(telegramCustomers.storeId, store.id)
  });
  if (!customer) {
    const inserted = await db.insert(telegramCustomers).values({
      storeId: store.id,
      telegramUserId: '123456789',
      firstName: 'Cliente',
      lastName: 'E2E Test',
    }).returning();
    customer = inserted[0];
  }
  console.log('[5. CUSTOMER FOUND/CREATED]:', customer.id);

  // SIMULATE CHECKOUT (Create Order & Call Orders API)
  const newOrderArr = await db.insert(orders).values({
    storeId: store.id,
    customerId: customer.id,
    status: 'pending',
    subtotal: product.price,
    discount: '0',
    total: product.price,
    currency: 'BRL'
  }).returning();
  const newOrder = newOrderArr[0];
  console.log('[6. ORDER CREATED IN NEON]:', newOrder.id);

  await db.insert(orderItems).values({
    orderId: newOrder.id,
    productId: product.id,
    quantity: 1,
    unitPrice: product.price,
    total: product.price,
  });

  // CALL MERCADO PAGO ORDERS API (createPixPayment)
  const pixPayment = await paymentService.createPixPayment({
    sellerId: store.ownerId,
    orderId: newOrder.id,
    amount: Number(product.price),
    description: 'Teste E2E - ' + product.title,
    customer: {
      email: 'e2etest@webgran.app',
      name: 'Cliente E2E Test'
    }
  });

  console.log('[7. MERCADO PAGO ORDERS API RESPONSE]:');
  console.log('  PaymentId:', pixPayment.paymentId);
  console.log('  Status:', pixPayment.status);
  console.log('  QRCode Length:', pixPayment.qrCode ? pixPayment.qrCode.length : 0);
  console.log('  QRCodeBase64 Length:', pixPayment.qrCodeBase64 ? pixPayment.qrCodeBase64.length : 0);
  console.log('  ExpiresAt:', pixPayment.expiresAt);

  // SAVE TO DATABASE
  await db.update(orders).set({
    paymentId: pixPayment.paymentId,
    pixQrCode: pixPayment.qrCode,
    pixQrCodeBase64: pixPayment.qrCodeBase64,
    pixExpiresAt: pixPayment.expiresAt,
  }).where(eq(orders.id, newOrder.id));

  // VERIFY STORED DATA IN NEON
  const savedOrder = await db.query.orders.findFirst({
    where: eq(orders.id, newOrder.id)
  });
  console.log('[8. NEON VERIFICATION]:');
  console.log('  Stored paymentId:', savedOrder?.paymentId);
  console.log('  Stored pixQrCode present:', !!savedOrder?.pixQrCode);
  console.log('  Stored pixQrCodeBase64 present:', !!savedOrder?.pixQrCodeBase64);

  console.log('=== E2E COBRANÇA PIX CREATED SUCCESSFULLY ===');
}

e2eTest().catch(console.error).finally(() => process.exit(0));
