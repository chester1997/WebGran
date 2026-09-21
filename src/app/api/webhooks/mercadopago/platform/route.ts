import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, subscriptions } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Extract payment ID from body or query params
    const paymentId = 
      body?.data?.id || 
      body?.id || 
      url.searchParams.get("data.id") || 
      url.searchParams.get("id");

    const topic = body?.type || body?.topic || url.searchParams.get("topic");

    console.log(`[MP Platform Webhook] Received notification - Topic: ${topic}, PaymentID: ${paymentId}`);

    if (!paymentId) {
      return NextResponse.json({ received: true, message: "No payment ID provided" });
    }

    // Query REAL payment status from Mercado Pago API
    const mpPayment = await mercadoPagoPlatformProvider.getInvoice(String(paymentId));
    const now = new Date();

    // Locate invoice in DB by externalId or ID
    const inv = await db.query.invoices.findFirst({
      where: or(
        eq(invoices.externalId, String(paymentId)),
        eq(invoices.id, String(paymentId))
      ),
    });

    if (inv) {
      if (mpPayment.status === 'PAID' && inv.status !== 'PAID') {
        const nextPeriodEnd = new Date(now);
        nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

        // Update Invoice -> PAID
        await db
          .update(invoices)
          .set({
            status: 'PAID',
            paidAt: now,
            updatedAt: now,
          })
          .where(eq(invoices.id, inv.id));

        // Activate Subscription for 1 Month
        if (inv.subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: 'ACTIVE',
              currentPeriodStart: now,
              currentPeriodEnd: nextPeriodEnd,
              updatedAt: now,
            })
            .where(eq(subscriptions.id, inv.subscriptionId));
        }

        console.log(`[MP Platform Webhook SUCCESS] Invoice ${inv.id} marked PAID and subscription activated!`);
      } else if ((mpPayment.status === 'EXPIRED' || mpPayment.status === 'CANCELLED') && inv.status === 'PENDING') {
        await db
          .update(invoices)
          .set({ status: 'EXPIRED', updatedAt: now })
          .where(eq(invoices.id, inv.id));
      }
    } else {
      console.log(`[MP Platform Webhook] Invoice with externalId ${paymentId} not found in DB.`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (err: any) {
    console.error("[MP Platform Webhook Error]", err);
    return NextResponse.json({ error: err.message || "Webhook error" }, { status: 200 }); // Always 200 to acknowledge MP
  }
}
