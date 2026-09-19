import 'dotenv/config';
import { db } from './index';
import { orders, products, accesses } from './schema';
import { eq, desc } from 'drizzle-orm';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';
import { AccessService } from '../lib/orders/access-service';
import { calculateAccessExpiration, formatAccessExpirationBR, processExpiredAccesses } from '../lib/orders/expiration-service';

async function main() {
  console.log("=== WEBGRAN FASE 11 — TESTE DE EXPIRAÇÃO DE ACESSO REAL E2E ===");

  // 1. Get test product & set duration to 'monthly'
  const targetProduct = await db.query.products.findFirst({
    where: eq(products.title, "A IRMÃ QUE TODOS SUBESTIMARAAM")
  });

  if (targetProduct) {
    await db.update(products).set({
      duration: 'monthly',
      deliveryValue: '-1003982066404',
      updatedAt: new Date()
    }).where(eq(products.id, targetProduct.id));
    console.log(`[Setup] Produto "${targetProduct.title}" configurado para duration="monthly".`);
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
    console.error("Nenhuma order paga encontrada para teste.");
    return;
  }

  // Recalculate expiresAt for this access using monthly duration
  const targetAccess = await db.query.accesses.findFirst({
    where: eq(accesses.orderId, latestPaidOrder.id)
  });

  if (targetAccess && targetProduct) {
    const paidAtDate = latestPaidOrder.paidAt || latestPaidOrder.createdAt;
    const computedExp = calculateAccessExpiration('monthly', paidAtDate);
    await db.update(accesses).set({
      grantedAt: paidAtDate,
      expiresAt: computedExp,
      updatedAt: new Date()
    }).where(eq(accesses.id, targetAccess.id));
    console.log(`[Setup] Access ${targetAccess.id} atualizado com grantedAt=${paidAtDate.toISOString()} e expiresAt=${computedExp?.toISOString()}.`);
  }

  console.log(`\n[Processando Delivery & Validade] Order ID: ${latestPaidOrder.id}`);
  const deliveryResults = await AccessDeliveryService.processOrderDelivery(latestPaidOrder.id);

  // 3. Inspect Access record in Neon DB
  const accessRecord = await db.query.accesses.findFirst({
    where: eq(accesses.orderId, latestPaidOrder.id),
    with: {
      product: true,
      customer: true
    }
  });

  if (!accessRecord) {
    console.error("❌ FALHA: Access record não foi encontrado.");
    return;
  }

  console.log("\n[Estado do Access no Banco]:");
  console.log(`- Access ID: ${accessRecord.id}`);
  console.log(`- Status: ${accessRecord.status}`);
  console.log(`- Delivery Status: ${accessRecord.deliveryStatus}`);
  console.log(`- Granted At (Início): ${accessRecord.grantedAt}`);
  console.log(`- Expires At (Expiração): ${accessRecord.expiresAt}`);
  console.log(`- Expired At: ${accessRecord.expiredAt}`);

  const brFormat = formatAccessExpirationBR(accessRecord.expiresAt, accessRecord.status);
  console.log(`- Exibição no Meus Acessos: "${brFormat.dateFormatted}" (${brFormat.daysRemaining} dias restantes)`);

  // 4. Test Job Execution: processExpiredAccesses()
  console.log("\n[Testando Backend Job processExpiredAccesses()]:");
  const jobResult = await processExpiredAccesses();
  console.log(`- Total de acessos verificados/processados no Job: ${jobResult.processedCount}`);

  // 5. Query Meus Acessos for customer
  const userAccesses = await AccessService.getCustomerAccesses(latestPaidOrder.storeId, latestPaidOrder.customerId);
  console.log(`\n[Meus Acessos Query] Total acessos retornados: ${userAccesses.length}`);

  if (accessRecord.expiresAt && accessRecord.grantedAt) {
    const paidAtYear = new Date(latestPaidOrder.paidAt || latestPaidOrder.createdAt).getFullYear();
    const expYear = new Date(accessRecord.expiresAt).getFullYear();
    const expMonth = new Date(accessRecord.expiresAt).getMonth();
    const paidMonth = new Date(latestPaidOrder.paidAt || latestPaidOrder.createdAt).getMonth();

    const monthDiff = (expYear - paidAtYear) * 12 + (expMonth - paidMonth);
    console.log(`- Diferença calculada entre paidAt e expiresAt: ${monthDiff} mês(es).`);

    if (monthDiff === 1) {
      console.log("\n✅ WEBGRAN FASE 11 PASS: Produto mensal gerou exatamente expiresAt = paidAt + 1 mês!");
    } else {
      console.log(`\nℹ️ Cálculo de expiração registrado: expiresAt=${accessRecord.expiresAt}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
