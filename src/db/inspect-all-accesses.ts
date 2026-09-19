import 'dotenv/config';
import { db } from "@/db";
import { stores, accesses, telegramCustomers, products } from "@/db/schema";
import { eq } from "drizzle-orm";

async function inspectAllAccesses() {
  console.log("==================================================");
  console.log("INSPEÇÃO COMPLETA DE ACCESSES DO BANCO NEON");
  console.log("==================================================\n");

  const store = await db.query.stores.findFirst({
    where: eq(stores.name, "teste loja")
  });

  if (!store) throw new Error("Loja não encontrada.");

  const allAccesses = await db.query.accesses.findMany({
    where: eq(accesses.storeId, store.id),
    with: {
      customer: true,
      product: true,
    }
  });

  console.log(`Total de Accesses encontrados: ${allAccesses.length}\n`);

  allAccesses.forEach((acc, index) => {
    console.log(`--- Access #${index + 1} ---`);
    console.log(`ID: ${acc.id}`);
    console.log(`Customer: ${acc.customer?.firstName} (TgUserId: ${acc.customer?.telegramUserId})`);
    console.log(`Product: ${acc.product?.title} (ChatId: ${acc.product?.deliveryValue})`);
    console.log(`Status: ${acc.status} | DeliveryStatus: ${acc.deliveryStatus}`);
    console.log(`ExpiresAt: ${acc.expiresAt}`);
    console.log(`InviteExpiresAt: ${acc.inviteExpiresAt}`);
    console.log(`InviteLink no Banco: ${acc.inviteLink}`);
    console.log(`ConfirmationSentAt: ${acc.confirmationSentAt}`);
    console.log("-------------------------------------------\n");
  });
}

inspectAllAccesses().catch(console.error);
