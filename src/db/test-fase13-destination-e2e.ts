import 'dotenv/config';
import { db } from "@/db";
import { stores, products, telegramBots, telegramCustomers, orders, orderItems, accesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";
import { TelegramDeliveryService } from "@/lib/delivery/telegram-delivery-service";
import { encrypt } from "@/lib/encryption";

async function runFase13Tests() {
  console.log("==================================================");
  console.log("WEBGRAN — FASE 13: TESTE COMPLETO DE DESTINO DE ACESSO");
  console.log("==================================================\n");

  // 1. Fetch real store
  const store = await db.query.stores.findFirst({
    where: eq(stores.name, "teste loja"),
    with: { bots: true }
  });

  if (!store) {
    throw new Error("Loja 'teste loja' não encontrada no banco.");
  }

  console.log(`✅ Store encontrada: ${store.name} (${store.id})`);

  // 2. Fetch real product
  const product = await db.query.products.findFirst({
    where: and(eq(products.storeId, store.id), eq(products.title, "A IRMÃ QUE TODOS SUBESTIMARAAM"))
  });

  if (!product) {
    throw new Error("Produto 'A IRMÃ QUE TODOS SUBESTIMARAAM' não encontrado.");
  }

  console.log(`✅ Produto encontrado: ${product.title} (${product.id})`);
  console.log(`   deliveryValue (Chat ID): ${product.deliveryValue}`);

  // 3. Create or fetch test customer
  const testTgUserId = "99988877713";
  let customer = await db.query.telegramCustomers.findFirst({
    where: and(eq(telegramCustomers.storeId, store.id), eq(telegramCustomers.telegramUserId, testTgUserId))
  });

  if (!customer) {
    const inserted = await db.insert(telegramCustomers).values({
      storeId: store.id,
      telegramUserId: testTgUserId,
      firstName: "TestUserFase13",
      username: "testuser_fase13",
    }).returning();
    customer = inserted[0];
  }

  console.log(`✅ Customer de teste: ${customer.firstName} (ID: ${customer.id})`);

  // 4. Create test order
  const orderId = crypto.randomUUID();
  const insertedOrder = await db.insert(orders).values({
    id: orderId,
    storeId: store.id,
    customerId: customer.id,
    status: "paid",
    subtotal: "0.99",
    total: "0.99",
    paidAt: new Date(),
  }).returning();
  const order = insertedOrder[0];

  console.log(`✅ Order de teste criada: ${order.id}`);

  const now = new Date();
  const futureExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const pastExpiration = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday

  // --------------------------------------------------
  // TEST SCENARIO A: Already a member in channel
  // --------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO A: User ALREADY a member of channel");
  console.log("--------------------------------------------------");

  const accessA = await db.insert(accesses).values({
    storeId: store.id,
    customerId: customer.id,
    productId: product.id,
    orderId: order.id,
    deliveryType: "telegram",
    telegramChatId: product.deliveryValue,
    status: "ACTIVE",
    deliveryStatus: "DELIVERED",
    expiresAt: futureExpiration,
    inviteLink: "https://t.me/+old_expired_invite_link_A",
    inviteExpiresAt: new Date(now.getTime() - 10000), // invite link expired
  }).returning();

  // Mock membership check to return true
  const originalCheckMembership = TelegramDeliveryService.checkBuyerMembership;
  TelegramDeliveryService.checkBuyerMembership = async () => true;

  const resA = await AccessLifecycleService.resolveAccessDestination(accessA[0].id, store.slug);

  console.log("Resultado Cenário A:", resA);

  if (resA.status !== "ACTIVE" || resA.destinationType !== "DIRECT_CHAT") {
    throw new Error(`Cenário A falhou! Esperado ACTIVE + DIRECT_CHAT, recebido: ${resA.status} / ${resA.destinationType}`);
  }
  if (!resA.destinationUrl || !resA.destinationUrl.includes("t.me/c/")) {
    throw new Error(`Cenário A falhou! URL deve ser link direto do canal (t.me/c/...), recebido: ${resA.destinationUrl}`);
  }
  if (resA.destinationUrl.includes("+old_expired_invite_link_A")) {
    throw new Error("Cenário A falhou! Não deveria ter retornado o link de convite antigo expirado!");
  }
  console.log("✅ CENÁRIO A PASSOU: Retornou DIRECT_CHAT sem usar convite expirado.");

  // --------------------------------------------------
  // TEST SCENARIO B: Not a member, valid invite link
  // --------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO B: User NOT a member, valid invite link");
  console.log("--------------------------------------------------");

  TelegramDeliveryService.checkBuyerMembership = async () => false;

  const validInviteUrl = "https://t.me/+valid_invite_link_B";
  const accessB = await db.insert(accesses).values({
    storeId: store.id,
    customerId: customer.id,
    productId: product.id,
    orderId: order.id,
    deliveryType: "telegram",
    telegramChatId: product.deliveryValue,
    status: "ACTIVE",
    deliveryStatus: "DELIVERED",
    expiresAt: futureExpiration,
    inviteLink: validInviteUrl,
    inviteExpiresAt: new Date(now.getTime() + 600000), // 10 mins valid
  }).returning();

  const resB = await AccessLifecycleService.resolveAccessDestination(accessB[0].id, store.slug);

  console.log("Resultado Cenário B:", resB);

  if (resB.status !== "ACTIVE" || resB.destinationType !== "INVITE" || resB.destinationUrl !== validInviteUrl) {
    throw new Error(`Cenário B falhou! Esperado INVITE com URL ${validInviteUrl}, recebido: ${resB.destinationUrl}`);
  }
  console.log("✅ CENÁRIO B PASSOU: Retornou o inviteLink válido existente.");

  // --------------------------------------------------
  // TEST SCENARIO C: Not a member, invite expired, access active -> generate fresh invite
  // --------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO C: Not a member, invite expired, access active");
  console.log("--------------------------------------------------");

  const freshInviteUrl = "https://t.me/+fresh_renewed_invite_link_C";
  const originalCreateInvite = TelegramDeliveryService.createTelegramInvite;
  TelegramDeliveryService.createTelegramInvite = async () => ({ inviteLink: freshInviteUrl });

  const accessC = await db.insert(accesses).values({
    storeId: store.id,
    customerId: customer.id,
    productId: product.id,
    orderId: order.id,
    deliveryType: "telegram",
    telegramChatId: product.deliveryValue,
    status: "ACTIVE",
    deliveryStatus: "DELIVERED",
    expiresAt: futureExpiration,
    inviteLink: "https://t.me/+expired_invite_link_C",
    inviteExpiresAt: new Date(now.getTime() - 60000), // expired invite
  }).returning();

  const resC = await AccessLifecycleService.resolveAccessDestination(accessC[0].id, store.slug);

  console.log("Resultado Cenário C:", resC);

  if (resC.status !== "ACTIVE" || resC.destinationType !== "INVITE" || resC.destinationUrl !== freshInviteUrl) {
    throw new Error(`Cenário C falhou! Esperado novo invite link ${freshInviteUrl}, recebido: ${resC.destinationUrl}`);
  }

  // Verify DB updated with fresh invite link
  const updatedAccessC = await db.query.accesses.findFirst({ where: eq(accesses.id, accessC[0].id) });
  if (updatedAccessC?.inviteLink !== freshInviteUrl) {
    throw new Error(`Cenário C falhou! Banco de dados não atualizou inviteLink para novo convite.`);
  }
  console.log("✅ CENÁRIO C PASSOU: Renovou inviteLink expirado e manteve Access ACTIVE sem duplicar pagamentos.");

  // --------------------------------------------------
  // TEST SCENARIO D: Expired Access
  // --------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("SCENARIO D: Expired Access (now >= expiresAt)");
  console.log("--------------------------------------------------");

  const accessD = await db.insert(accesses).values({
    storeId: store.id,
    customerId: customer.id,
    productId: product.id,
    orderId: order.id,
    deliveryType: "telegram",
    telegramChatId: product.deliveryValue,
    status: "ACTIVE",
    deliveryStatus: "DELIVERED",
    expiresAt: pastExpiration,
  }).returning();

  const resD = await AccessLifecycleService.resolveAccessDestination(accessD[0].id, store.slug);

  console.log("Resultado Cenário D:", resD);

  if (resD.status !== "EXPIRED" || resD.destinationType !== "EXPIRED" || resD.destinationUrl !== null) {
    throw new Error(`Cenário D falhou! Esperado EXPIRED com destinationUrl null, recebido: ${resD.status} / ${resD.destinationUrl}`);
  }

  const updatedAccessD = await db.query.accesses.findFirst({ where: eq(accesses.id, accessD[0].id) });
  if (updatedAccessD?.status !== "EXPIRED") {
    throw new Error("Cenário D falhou! Status no banco de dados deveria ter sido atualizado para EXPIRED.");
  }
  console.log("✅ CENÁRIO D PASSOU: Access expirado atualizado para EXPIRED e retornado destinationType EXPIRED.");

  // Restore mocks
  TelegramDeliveryService.checkBuyerMembership = originalCheckMembership;
  TelegramDeliveryService.createTelegramInvite = originalCreateInvite;

  // Cleanup test records
  await db.delete(accesses).where(eq(accesses.orderId, order.id));
  await db.delete(orders).where(eq(orders.id, order.id));

  console.log("\n==================================================");
  console.log("🎉 TODOS OS TESTES DA FASE 13 PASSARAM COM SUCESSO!");
  console.log("==================================================");
}

runFase13Tests().catch((err) => {
  console.error("❌ ERRO NO TESTE DA FASE 13:", err);
  process.exit(1);
});
