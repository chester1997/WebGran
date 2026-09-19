import 'dotenv/config';
import { db } from "@/db";
import { stores, telegramCustomers, accesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyProductionDeployment() {
  console.log("==================================================");
  console.log("VERIFICAÇÃO DE PRODUÇÃO REAL — WEBGRAN ONLINE");
  console.log("==================================================\n");

  const store = await db.query.stores.findFirst({
    where: eq(stores.name, "teste loja")
  });

  if (!store) throw new Error("Loja não encontrada.");

  const customerJOY = await db.query.telegramCustomers.findFirst({
    where: and(eq(telegramCustomers.storeId, store.id), eq(telegramCustomers.telegramUserId, "8126417353"))
  });

  if (!customerJOY) throw new Error("Cliente JOY não encontrado.");

  const accessJOY = await db.query.accesses.findFirst({
    where: and(eq(accesses.storeId, store.id), eq(accesses.customerId, customerJOY.id)),
    with: { product: true }
  });

  if (!accessJOY) throw new Error("Acesso de JOY não encontrado.");

  const prodAppUrl = "https://www.webgran.online";

  console.log(`1. Testando endpoint de produção: ${prodAppUrl}/miniapp/${store.slug}...`);
  const resHome = await fetch(`${prodAppUrl}/miniapp/${store.slug}`);
  console.log(`   Status HTTP: ${resHome.status} ${resHome.statusText}`);

  console.log(`\n2. Testando API de produção: POST ${prodAppUrl}/api/telegram/access/open...`);
  const resOpen = await fetch(`${prodAppUrl}/api/telegram/access/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessId: accessJOY.id, storeSlug: store.slug })
  });

  console.log(`   Status HTTP: ${resOpen.status} ${resOpen.statusText}`);
  const dataOpen = await resOpen.json();
  console.log("   Resposta JSON de Produção:", JSON.stringify(dataOpen, null, 2));

  console.log(`\n3. Testando Endpoint Redirect: GET ${prodAppUrl}/api/telegram/access/redirect?accessId=${accessJOY.id}...`);
  const resRedirect = await fetch(`${prodAppUrl}/api/telegram/access/redirect?accessId=${accessJOY.id}`, {
    redirect: "manual"
  });

  console.log(`   Status HTTP Redirect: ${resRedirect.status}`);
  console.log(`   Header Location: ${resRedirect.headers.get("location")}`);

  if (dataOpen.destinationUrl && dataOpen.destinationUrl.includes("t.me/c/3982066404/1")) {
    console.log("\n✅ PRODUÇÃO REAL CONFIRMADA: Código com deep link /1 está ATIVO e OPERACIONAL no Vercel Production!");
  } else {
    console.log("\n⏳ Aguardando Vercel finalizar o deploy...");
  }
}

verifyProductionDeployment().catch(console.error);
