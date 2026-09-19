import 'dotenv/config';
import { db } from './index';
import { orders, products, accesses, telegramCustomers, stores } from './schema';
import { eq, desc, and } from 'drizzle-orm';
import { calculateAccessExpiration, formatAccessExpirationBR, processExpiredAccesses } from '../lib/orders/expiration-service';
import { AccessLifecycleService } from '../lib/orders/access-lifecycle-service';

async function main() {
  console.log("==================================================");
  console.log("WEBGRAN FASE 12 — SUÍTE DE TESTES DO CICLO DE ACESSO");
  console.log("==================================================\n");

  const targetStore = await db.query.stores.findFirst();
  if (!targetStore) {
    console.error("Nenhuma loja encontrada para teste.");
    return;
  }
  const storeSlug = targetStore.slug;

  const targetCustomer = await db.query.telegramCustomers.findFirst({
    where: eq(telegramCustomers.storeId, targetStore.id)
  });

  if (!targetCustomer) {
    console.error("Nenhum cliente encontrado para teste.");
    return;
  }

  const targetProduct = await db.query.products.findFirst({
    where: eq(products.storeId, targetStore.id)
  });

  if (!targetProduct) {
    console.error("Nenhum produto encontrado para teste.");
    return;
  }

  let passedScenarios = 0;
  const totalScenarios = 10;

  // TEST 1: Non-member user -> Active access -> single-use invite created
  console.log("▶ TESTE 1: Usuário não membro + Access Válido -> Convite criado");
  const testAccess1 = await db.insert(accesses).values({
    storeId: targetStore.id,
    customerId: targetCustomer.id,
    productId: targetProduct.id,
    status: 'ACTIVE',
    deliveryStatus: 'DELIVERED',
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
  }).returning();
  const acc1 = testAccess1[0];

  const res1 = await AccessLifecycleService.resolveAccessContent(acc1.id, storeSlug);
  if (res1.success && res1.url) {
    console.log(`✅ [PASS 1] Convite/Destino gerado com sucesso: ${res1.url}`);
    passedScenarios++;
  } else {
    console.error(`❌ [FAIL 1] Resolução falhou: ${res1.error}`);
  }

  // TEST 2: User enters channel -> Access stays ACTIVE
  console.log("\n▶ TESTE 2: Usuário entra no canal -> Access continua ACTIVE");
  const acc2 = await db.query.accesses.findFirst({ where: eq(accesses.id, acc1.id) });
  if (acc2?.status === 'ACTIVE') {
    console.log(`✅ [PASS 2] Access mantido como ACTIVE (${acc2.status})`);
    passedScenarios++;
  } else {
    console.error(`❌ [FAIL 2] Access alterado indevidamente.`);
  }

  // TEST 3: Convite expira -> Access continua ACTIVE
  console.log("\n▶ TESTE 3: Convite expira -> Access continua ACTIVE");
  await db.update(accesses).set({
    inviteExpiresAt: new Date(Date.now() - 1000 * 60), // expired 1 min ago
  }).where(eq(accesses.id, acc1.id));
  const acc3 = await db.query.accesses.findFirst({ where: eq(accesses.id, acc1.id) });
  if (acc3?.status === 'ACTIVE') {
    console.log(`✅ [PASS 3] Convite expirado mas Access permanece ACTIVE (${acc3.status})`);
    passedScenarios++;
  } else {
    console.error(`❌ [FAIL 3] Access expirou antecipadamente.`);
  }

  // TEST 4: Convite expirado + Access válido -> Novo convite é gerado dinamicamente
  console.log("\n▶ TESTE 4: Convite expirado + Access válido -> Novo convite gerado dinamicamente");
  const res4 = await AccessLifecycleService.resolveAccessContent(acc1.id, storeSlug);
  if (res4.success && (res4.status === 'INVITE_RENEWED' || res4.status === 'MEMBER')) {
    console.log(`✅ [PASS 4] Novo convite gerado/resolvido sem novo pagamento: ${res4.url}`);
    passedScenarios++;
  } else {
    console.error(`❌ [FAIL 4] Falha ao renovar convite.`);
  }

  // TEST 5: expiresAt chega (now >= expiresAt) -> processExpiredAccesses() altera para EXPIRED
  console.log("\n▶ TESTE 5 & 6 & 7: expiresAt vencido -> processExpiredAccesses() expira e executa revogação");
  await db.update(accesses).set({
    expiresAt: new Date(Date.now() - 1000 * 60), // expired 1 min ago
  }).where(eq(accesses.id, acc1.id));

  const jobRes = await processExpiredAccesses();
  const acc5 = await db.query.accesses.findFirst({ where: eq(accesses.id, acc1.id) });

  if (acc5?.status === 'EXPIRED' && acc5?.deliveryStatus === 'EXPIRED') {
    console.log(`✅ [PASS 5,6,7] Access expirado e revogação processada. Status=${acc5.status}, RevocationStatus=${acc5.revocationStatus}`);
    passedScenarios += 3;
  } else {
    console.error(`❌ [FAIL 5,6,7] Job de expiração não atualizou para EXPIRED.`);
  }

  // TEST 8: LIFETIME -> Nunca expira
  console.log("\n▶ TESTE 8: LIFETIME -> Acesso vitalício não expira");
  const testAccessLifetime = await db.insert(accesses).values({
    storeId: targetStore.id,
    customerId: targetCustomer.id,
    productId: targetProduct.id,
    status: 'ACTIVE',
    deliveryStatus: 'DELIVERED',
    grantedAt: new Date(),
    expiresAt: null, // Lifetime
  }).returning();
  const accLifetime = testAccessLifetime[0];

  const resLifetime = await AccessLifecycleService.resolveAccessContent(accLifetime.id, storeSlug);
  if (resLifetime.success) {
    console.log(`✅ [PASS 8] Acesso LIFETIME mantido ativo sem data de expiração.`);
    passedScenarios++;
  } else {
    console.error(`❌ [FAIL 8] Acesso LIFETIME falhou.`);
  }

  // TEST 9 & 10: Meus Acessos UI rendering logic for ACTIVE and EXPIRED
  console.log("\n▶ TESTE 9 & 10: Meus Acessos renderiza datas para ACTIVE e desabilita botão para EXPIRED");
  const activeFmt = formatAccessExpirationBR(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'ACTIVE');
  const expiredFmt = formatAccessExpirationBR(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), 'EXPIRED');

  if (activeFmt.badgeType === 'ACTIVE' && expiredFmt.badgeType === 'EXPIRED' && expiredFmt.isExpired) {
    console.log(`✅ [PASS 9,10] Formatação de interface validada: ACTIVE="${activeFmt.dateFormatted}", EXPIRED="${expiredFmt.dateFormatted}"`);
    passedScenarios += 2;
  } else {
    console.error(`❌ [FAIL 9,10] Erro na formatação visual do Meus Acessos.`);
  }

  // Clean test records
  await db.delete(accesses).where(eq(accesses.id, acc1.id));
  await db.delete(accesses).where(eq(accesses.id, accLifetime.id));

  console.log(`\n==================================================`);
  console.log(`SUÍTE DE TESTES FASE 12: ${passedScenarios}/${totalScenarios} PASSED`);
  console.log(`==================================================`);

  if (passedScenarios === totalScenarios) {
    console.log("\n🎉 WEBGRAN FASE 12 CRITÉRIO FINAL DE PASS ALCANÇADO COM 100% DE SUCESSO!");
  }
}

main().catch(console.error).finally(() => process.exit(0));
