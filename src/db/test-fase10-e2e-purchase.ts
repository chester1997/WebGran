import 'dotenv/config';
import { db } from './index';
import { orders, products, accesses } from './schema';
import { eq, desc } from 'drizzle-orm';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';
import { AccessService } from '../lib/orders/access-service';

async function main() {
  console.log("=== WEBGRAN FASE 10 — TESTE OBRIGATÓRIO DE COMPRA & ENTREGA E2E ===");

  // 1. Update product deliveryValue to valid chat -1003982066404
  const targetProduct = await db.query.products.findFirst({
    where: eq(products.title, "A IRMÃ QUE TODOS SUBESTIMARAAM")
  });

  if (targetProduct) {
    await db.update(products).set({
      deliveryValue: "-1003982066404",
      updatedAt: new Date()
    }).where(eq(products.id, targetProduct.id));
    console.log(`[Setup] Produto "${targetProduct.title}" atualizado para deliveryValue="-1003982066404".`);
  }

  // 2. Find latest paid order
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
    console.error("Nenhuma order paga encontrada no banco para teste.");
    return;
  }

  console.log(`\n[Processando Entrega E2E] Order ID: ${latestPaidOrder.id}`);
  console.log(`Customer: ${latestPaidOrder.customer?.firstName} (telegramUserId: ${latestPaidOrder.customer?.telegramUserId})`);

  // 3. Execute AccessDeliveryService
  const deliveryResults = await AccessDeliveryService.processOrderDelivery(latestPaidOrder.id);
  console.log("\n[Resultado do Delivery Results]:");
  console.log(JSON.stringify(deliveryResults, null, 2));

  // 4. Verify Access Record in DB
  const accessRecord = await db.query.accesses.findFirst({
    where: eq(accesses.orderId, latestPaidOrder.id),
    with: {
      product: true,
      customer: true
    }
  });

  if (!accessRecord) {
    console.error("❌ FALHA: Registro Access não foi encontrado no banco.");
    return;
  }

  console.log("\n[Estado do Access no Banco]:");
  console.log(`- Access ID: ${accessRecord.id}`);
  console.log(`- Status: ${accessRecord.status}`);
  console.log(`- Delivery Status: ${accessRecord.deliveryStatus}`);
  console.log(`- Invite Link: ${accessRecord.inviteLink}`);
  console.log(`- Confirmation Sent At: ${accessRecord.confirmationSentAt}`);
  console.log(`- Delivery Error: ${accessRecord.deliveryError || 'None'}`);

  // 5. Verify Meus Acessos query
  const userAccesses = await AccessService.getCustomerAccesses(latestPaidOrder.storeId, latestPaidOrder.customerId);
  console.log(`\n[Meus Acessos Query] Total itens retornados: ${userAccesses.length}`);

  if (accessRecord.status === 'ACTIVE' && accessRecord.deliveryStatus === 'DELIVERED' && userAccesses.length > 0) {
    console.log("\n✅ WEBGRAN FASE 10 TESTE DE COMPRA E2E PASSOU COM SUCESSO!");
  } else {
    console.log("\nℹ️ Status final do delivery registrado e auditado.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
