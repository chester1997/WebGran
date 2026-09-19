import 'dotenv/config';
import { db } from "@/db";
import { stores, products, telegramCustomers, accesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

async function auditRuntime() {
  console.log("==================================================");
  console.log("WEBGRAN AUDITORIA DE RUNTIME FASE 13/14");
  console.log("==================================================\n");

  const store = await db.query.stores.findFirst({
    where: eq(stores.name, "teste loja")
  });

  if (!store) throw new Error("Loja 'teste loja' não encontrada.");

  const customerJOY = await db.query.telegramCustomers.findFirst({
    where: and(eq(telegramCustomers.storeId, store.id), eq(telegramCustomers.telegramUserId, "8126417353"))
  });

  if (!customerJOY) throw new Error("Cliente JOY não encontrado.");

  const accessJOY = await db.query.accesses.findFirst({
    where: and(eq(accesses.storeId, store.id), eq(accesses.customerId, customerJOY.id)),
    with: { product: true }
  });

  if (!accessJOY) throw new Error("Acesso do cliente JOY não encontrado no banco.");

  console.log(`Access ID REAL: ${accessJOY.id}`);
  console.log(`Produto: ${accessJOY.product?.title} (${accessJOY.product?.deliveryValue})`);
  console.log(`Access Status: ${accessJOY.status}`);
  console.log(`ExpiresAt: ${accessJOY.expiresAt}`);
  console.log(`InviteExpiresAt: ${accessJOY.inviteExpiresAt}`);

  const res = await AccessLifecycleService.resolveAccessDestination(accessJOY.id, store.slug);

  console.log("\nResultado de resolveAccessDestination REAL:");
  console.log(JSON.stringify(res, null, 2));

  console.log("\nVerificando formato de URL para canal privado Telegram:");
  console.log(`destinationUrl atual: ${res.destinationUrl}`);
}

auditRuntime().catch(console.error);
