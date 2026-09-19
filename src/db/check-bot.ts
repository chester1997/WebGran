import 'dotenv/config';
import { db } from './index';
import { telegramBots } from './schema';
import { decrypt } from '../lib/encryption';

async function main() {
  const bots = await db.select().from(telegramBots);
  for (const b of bots) {
    const token = decrypt(b.tokenEncrypted);
    console.log(`Bot: @${b.username} (ID: ${b.botId})`);
    
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const data = await res.json();
      console.log("Webhook Info:", JSON.stringify(data, null, 2));

      const menuRes = await fetch(`https://api.telegram.org/bot${token}/getMenuButton`);
      const menuData = await menuRes.json();
      console.log("Menu Button:", JSON.stringify(menuData, null, 2));
    } catch (e: any) {
      console.error("Error fetching bot info from Telegram:", e.message);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
