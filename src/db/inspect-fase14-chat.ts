import 'dotenv/config';
import { db } from "@/db";
import { stores, products, telegramBots, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { TelegramBotService } from "@/lib/telegram/bot";

async function inspectChat() {
  console.log("==================================================");
  console.log("WEBGRAN FASE 14 — INSPEÇÃO DO CHAT E BOT REAL");
  console.log("==================================================\n");

  const store = await db.query.stores.findFirst({
    where: eq(stores.name, "teste loja"),
    with: { bots: true }
  });

  if (!store) {
    throw new Error("Store 'teste loja' não encontrada.");
  }

  console.log(`Store: ${store.name} (${store.id})`);

  const bot = store.bots?.[0] || await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id)
  });

  if (!bot || !bot.tokenEncrypted) {
    throw new Error("Bot da loja não encontrado.");
  }

  const botToken = decrypt(bot.tokenEncrypted);
  const botService = new TelegramBotService(botToken);

  const botMe = await botService.getMe();
  console.log(`Bot: @${botMe.username} (${botMe.id})`);

  const prods = await db.query.products.findMany({
    where: eq(products.storeId, store.id)
  });

  console.log("\nProdutos da Loja:");
  prods.forEach(p => {
    console.log(`- ${p.title} | ID: ${p.id} | DeliveryType: ${p.deliveryType} | ChatID: ${p.deliveryValue}`);
  });

  const customers = await db.query.telegramCustomers.findMany({
    where: eq(telegramCustomers.storeId, store.id)
  });

  console.log("\nClientes cadastrados na Loja:");
  customers.forEach(c => {
    console.log(`- ${c.firstName} ${c.lastName || ''} | Username: @${c.username || 'sem_username'} | TgUserId: ${c.telegramUserId} | ID: ${c.id}`);
  });

  const chatId = "-1003982066404";
  console.log(`\nInspecionando Chat Telegram (${chatId})...`);

  try {
    const chatInfo = await botService.getChat(chatId);
    console.log("Informações do Chat Telegram:", JSON.stringify(chatInfo, null, 2));

    // Check bot member status in chat
    const botMember = await botService.getChatMember(chatId, String(botMe.id));
    console.log("Status do Bot no Chat:", JSON.stringify(botMember, null, 2));

    // Check member status for all customers
    for (const cust of customers) {
      if (cust.telegramUserId) {
        try {
          const memberInfo = await botService.getChatMember(chatId, cust.telegramUserId);
          console.log(`\nStatus do Cliente ${cust.firstName} (TgId: ${cust.telegramUserId}): ${memberInfo.status}`);
        } catch (err: any) {
          console.log(`\nStatus do Cliente ${cust.firstName} (TgId: ${cust.telegramUserId}): ERRO (${err.message})`);
        }
      }
    }

  } catch (err: any) {
    console.error("Erro ao inspecionar chat:", err.message);
  }
}

inspectChat().catch(console.error);
