import 'dotenv/config';
import { db } from './index';
import { sellerPaymentConnections } from './schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/encryption';

async function main() {
  console.log("=== WEBGRAN FASE 6 MERCADO PAGO DIRECT QUERY ===");

  const sellerId = "fa985b36-8fa2-4661-a4e3-364b8f8efb9b";
  const conn = await db.query.sellerPaymentConnections.findFirst({
    where: eq(sellerPaymentConnections.sellerId, sellerId)
  });

  if (!conn || !conn.accessTokenEncrypted) {
    console.error("Seller connection or token not found!");
    return;
  }

  const token = decrypt(conn.accessTokenEncrypted);
  const paymentId = "PAY01M2WNGYXE88N4HD9C5SZ6SA16";

  console.log(`Checking Mercado Pago for Payment/Order ID: ${paymentId}...`);

  // Query /v1/orders/{id}
  try {
    const resOrder = await fetch(`https://api.mercadopago.com/v1/orders/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`GET /v1/orders/${paymentId} HTTP status: ${resOrder.status}`);
    const dataOrder = await resOrder.json();
    console.log("Response /v1/orders:", JSON.stringify(dataOrder, null, 2));
  } catch (e: any) {
    console.error("Error querying /v1/orders:", e.message);
  }

  // Query /v1/payments/{id}
  try {
    const resPayment = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`GET /v1/payments/${paymentId} HTTP status: ${resPayment.status}`);
    const dataPayment = await resPayment.json();
    console.log("Response /v1/payments:", JSON.stringify(dataPayment, null, 2));
  } catch (e: any) {
    console.error("Error querying /v1/payments:", e.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
