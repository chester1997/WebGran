import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { stores, products, telegramCustomers, orders, orderItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { paymentService } from '@/lib/payments/payment-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, productId, customerTelegramId, customerName, customerUsername, customerEmail } = body;

    if (!storeId || !productId || !customerTelegramId) {
      return NextResponse.json(
        { error: 'Parâmetros storeId, productId e customerTelegramId são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Retrieve Store and Owner
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      with: {
        owner: true,
      },
    });

    if (!store || !store.ownerId) {
      return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    }

    // 2. Verify Seller Mercado Pago Connection
    const connection = await paymentService.getSellerConnection(store.ownerId);
    if (!connection) {
      return NextResponse.json(
        { error: 'Esta loja ainda não configurou o recebimento via Mercado Pago.' },
        { status: 400 }
      );
    }

    // 3. Retrieve Product
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.storeId, storeId)
      ),
    });

    if (!product || product.status !== 'active') {
      return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 404 });
    }

    // 4. Create/Get Telegram Customer
    let customer = await db.query.telegramCustomers.findFirst({
      where: and(
        eq(telegramCustomers.storeId, storeId),
        eq(telegramCustomers.telegramUserId, String(customerTelegramId))
      ),
    });

    if (!customer) {
      const [newCustomer] = await db.insert(telegramCustomers).values({
        storeId,
        telegramUserId: String(customerTelegramId),
        username: customerUsername || null,
        firstName: customerName || 'Cliente',
      }).returning();
      customer = newCustomer;
    }

    // 5. Create Pending Order
    const productPrice = Number(product.price);

    const [order] = await db.insert(orders).values({
      storeId,
      customerId: customer.id,
      status: 'pending',
      subtotal: String(productPrice),
      discount: '0',
      total: String(productPrice),
      currency: 'BRL',
    }).returning();

    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      quantity: 1,
      unitPrice: String(productPrice),
      total: String(productPrice),
    });

    // 6. Create Mercado Pago Preference
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/miniapp/${store.slug}/order-status/${order.id}`;

    const preference = await paymentService.createCheckoutPreference({
      sellerId: store.ownerId,
      items: [
        {
          id: product.id,
          title: product.title,
          quantity: 1,
          unitPrice: productPrice,
        }
      ],
      customer: {
        name: customerName || customer.firstName || 'Cliente Telegram',
        email: customerEmail || 'cliente@webgran.app',
      },
      successUrl: redirectUrl,
      failureUrl: redirectUrl,
      metadata: {
        orderId: order.id,
        storeId,
        productId,
      },
    });

    // 7. Update order with preference ID
    await db.update(orders)
      .set({ preferenceId: preference.id, updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    return NextResponse.json({
      success: true,
      orderId: order.id,
      preferenceId: preference.id,
      checkoutUrl: preference.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout preference:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar o checkout.' },
      { status: 500 }
    );
  }
}
