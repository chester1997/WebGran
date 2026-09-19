import 'dotenv/config';
import { db } from './index';
import { sellerPaymentConnections } from './schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/encryption';

async function main() {
  console.log("=== WEBGRAN FASE 6 SEARCH MP BY EXTERNAL REF ===");

  const sellerId = "fa985b36-8fa2-4661-a4e3-364b8f8efb9b";
  const conn = await db.query.sellerPaymentConnections.findFirst({
    where: eq(sellerPaymentConnections.sellerId, sellerId)
  });

  const token = decrypt(conn!.accessTokenEncrypted!);
  const externalRef = "f6b32494-c53e-464b-97e3-de2e8dc9c80b";

  console.log(`Searching Mercado Pago payments for external_reference: ${externalRef}...`);

  // Search Payments API
  const resSearch = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${externalRef}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`GET /v1/payments/search HTTP status: ${resSearch.status}`);
  const dataSearch = await resSearch.json();
  console.log("Search Payments Result:", JSON.stringify(dataSearch, null, 2));

  // Search Merchant Orders API
  const resMO = await fetch(`https://api.mercadopago.com/merchant_orders/search?external_reference=${externalRef}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`GET /merchant_orders/search HTTP status: ${resMO.status}`);
  const dataMO = await resMO.json();
  console.log("Search Merchant Orders Result:", JSON.stringify(dataMO, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
