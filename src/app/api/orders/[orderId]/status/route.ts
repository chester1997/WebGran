import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, accesses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncOrderWithMercadoPago } from '@/lib/payments/order-sync';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let orderStatus = order.status;
    let accessList: any[] = [];

    if (orderStatus !== 'paid') {
      const syncRes = await syncOrderWithMercadoPago(order.id);
      if (syncRes.status === 'paid') {
        orderStatus = 'paid';
        accessList = syncRes.accesses || [];
      }
    } else {
      accessList = await db.query.accesses.findMany({
        where: eq(accesses.orderId, order.id),
      });
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: order.total,
      paidAt: order.paidAt,
      pixQrCode: order.pixQrCode,
      pixQrCodeBase64: order.pixQrCodeBase64,
      pixExpiresAt: order.pixExpiresAt,
      accesses: accessList.map((a) => ({
        id: a.id,
        inviteLink: a.inviteLink,
        status: a.status,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching order status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
